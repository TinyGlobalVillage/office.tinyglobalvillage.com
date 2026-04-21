import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE     = path.join(DATA_DIR, "sessions.json");

export type SessionKind = "lounge" | "study" | "pair" | "user";

/**
 * A single live device-seat. Each browser tab generates its own `deviceId`,
 * so one user on two devices occupies two seats (two presence rows).
 */
export type Presence = {
  username: string;
  deviceId: string;
  lastBeatAt: string;
};

export type Session = {
  id: string;
  kind: SessionKind;
  name: string;
  createdBy: string | null;
  createdAt: string;
  cap: number | null;
  /** Derived from `presences` — unique usernames currently live. Kept for UI callers. */
  memberIds: string[];
  /** Authoritative live-seat roster. One entry per (user, device). */
  presences: Presence[];
  admins: string[];
  banned: string[];
  invisible: string[];
  /** `updatedAt` bumps on every presence heartbeat; used by the auto-delete sweeper. */
  updatedAt: string;
};

type Db = { sessions: Session[] };

/** Heartbeat interval is 15s; TTL of 30s tolerates one missed beat before sweeping. */
const PRESENCE_TTL_MS = 30_000;

const ISO_EPOCH = "2026-04-20T00:00:00.000Z";

const SEED: Session[] = [
  {
    id: "lounge",        kind: "lounge", name: "TGV Lounge", createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], presences: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "study-1",       kind: "study",  name: "Study 1",    createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], presences: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "study-2",       kind: "study",  name: "Study 2",    createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], presences: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "pair-1",        kind: "pair",   name: "Pair 1",     createdBy: null, createdAt: ISO_EPOCH,
    cap: 4, memberIds: [], presences: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "pair-2",        kind: "pair",   name: "Pair 2",     createdBy: null, createdAt: ISO_EPOCH,
    cap: 4, memberIds: [], presences: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
];

export function isExec(username: string | null | undefined): boolean {
  return username === "admin" || username === "marmar";
}

function read(): Db {
  try {
    if (!fs.existsSync(FILE)) return { sessions: [...SEED] };
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    // Migrate any pre-presence rows on the fly.
    for (const s of sessions) {
      if (!Array.isArray(s.presences)) s.presences = [];
    }
    for (const seed of SEED) {
      if (!sessions.some(s => s.id === seed.id)) sessions.push({ ...seed });
    }
    return { sessions };
  } catch {
    return { sessions: [...SEED] };
  }
}

function write(db: Db): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

/**
 * Drop presence rows older than `PRESENCE_TTL_MS`, re-derive `memberIds` from
 * the surviving rows, and auto-delete user rooms that have gone quiet. Called
 * on every read path so stale state can't outlive a missed heartbeat.
 */
function sweep(db: Db): Db {
  const cutoffMs = Date.now() - PRESENCE_TTL_MS;
  const keep: Session[] = [];
  let mutated = false;
  for (const s of db.sessions) {
    const before = s.presences.length;
    const beforeMemberCount = s.memberIds.length;
    s.presences = s.presences.filter(p => {
      const t = new Date(p.lastBeatAt).getTime();
      return Number.isFinite(t) && t > cutoffMs;
    });
    const nextMembers = Array.from(new Set(s.presences.map(p => p.username)));
    if (s.presences.length !== before || nextMembers.length !== beforeMemberCount) {
      mutated = true;
    }
    s.memberIds = nextMembers;
    // User-created rooms are cleaned up once they've been idle past the TTL.
    // Seeded rooms (lounge/study/pair) are never swept out.
    if (s.kind === "user" && s.presences.length === 0) {
      const idleSince = new Date(s.updatedAt).getTime();
      if (Number.isFinite(idleSince) && idleSince < cutoffMs) {
        mutated = true;
        continue;
      }
    }
    keep.push(s);
  }
  if (mutated) {
    db.sessions = keep;
    write(db);
  } else {
    db.sessions = keep;
  }
  return db;
}

export function listSessions(viewer: string): Session[] {
  const { sessions } = sweep(read());
  const viewerIsExec = isExec(viewer);
  return sessions
    .filter(s => viewerIsExec || !s.banned.includes(viewer))
    .map(s => {
      if (viewerIsExec || s.admins.includes(viewer)) return s;
      // Non-admins: hide `invisible[]` members + don't leak the invisible list itself.
      const memberIds = s.memberIds.filter(m => !s.invisible.includes(m));
      return { ...s, memberIds, invisible: [] };
    });
}

export function getSession(id: string): Session | null {
  const { sessions } = sweep(read());
  return sessions.find(s => s.id === id) ?? null;
}

export function createUserSession(params: {
  name: string;
  cap?: number | null;
  createdBy: string;
}): Session {
  const db = read();
  const id = `user-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const session: Session = {
    id,
    kind: "user",
    name: params.name.slice(0, 60),
    createdBy: params.createdBy,
    createdAt: now,
    cap: params.cap ?? null,
    memberIds: [],
    presences: [],
    admins: [params.createdBy],
    banned: [],
    invisible: [],
    updatedAt: now,
  };
  db.sessions.push(session);
  write(db);
  return session;
}

export type AccessCheck =
  | { ok: true }
  | { ok: false; code: "not-found" | "banned" | "full" | "forbidden"; message: string };

/** Authoritative check used by /api/livekit/token and /api/sessions/[id]/presence. */
export function checkJoinAccess(sessionId: string, username: string): AccessCheck {
  const session = getSession(sessionId);
  if (!session) return { ok: false, code: "not-found", message: "Session not found" };
  if (session.banned.includes(username)) {
    return { ok: false, code: "banned", message: "You were removed from this room" };
  }
  const viewerIsAdmin = isExec(username) || session.admins.includes(username);
  // Pair-cap: hard 4-seat limit for non-admins. Each live device counts as one
  // seat, so the cap is enforced against active presences (excluding invisible
  // users). Admins can always monitor as an overflow participant.
  if (
    session.kind === "pair" &&
    session.cap != null &&
    !viewerIsAdmin
  ) {
    const visibleSeats = session.presences.filter(p => !session.invisible.includes(p.username)).length;
    const userIsAlreadyIn = session.presences.some(p => p.username === username);
    if (visibleSeats >= session.cap && !userIsAlreadyIn) {
      return { ok: false, code: "full", message: "This pair room is full" };
    }
  }
  return { ok: true };
}

/**
 * Heartbeat: records that the (`username`, `deviceId`) pair is currently live
 * in `sessionId`. Each tab generates its own `deviceId`, so two tabs from one
 * user occupy two seats. Returns the updated session (or `null` if auto-deleted).
 */
export function heartbeatPresence(
  sessionId: string,
  username: string,
  deviceId: string,
  present: boolean,
): Session | null {
  const db = sweep(read());
  const idx = db.sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return null;

  const s = db.sessions[idx];
  const now = new Date().toISOString();

  if (present) {
    const existing = s.presences.find(p => p.username === username && p.deviceId === deviceId);
    if (existing) {
      existing.lastBeatAt = now;
    } else {
      s.presences.push({ username, deviceId, lastBeatAt: now });
    }
  } else {
    s.presences = s.presences.filter(p => !(p.username === username && p.deviceId === deviceId));
  }
  s.memberIds = Array.from(new Set(s.presences.map(p => p.username)));
  s.updatedAt = now;

  // Auto-delete user-created rooms the moment the last seat explicitly leaves.
  if (s.kind === "user" && s.presences.length === 0 && !present) {
    db.sessions.splice(idx, 1);
    write(db);
    return null;
  }

  db.sessions[idx] = s;
  write(db);
  return s;
}

export type AdminOp =
  | { op: "rename"; name: string }
  | { op: "setCap"; cap: number | null }
  | { op: "ban"; user: string }
  | { op: "unban"; user: string }
  | { op: "addInvisible"; user: string }
  | { op: "removeInvisible"; user: string }
  | { op: "addAdmin"; user: string }
  | { op: "removeAdmin"; user: string }
  | { op: "forceEnd" };

export type AdminResult =
  | { ok: true; session: Session | null }
  | { ok: false; code: "not-found" | "forbidden" | "invalid"; message: string };

export function applyAdminOp(sessionId: string, actor: string, op: AdminOp): AdminResult {
  const db = read();
  const idx = db.sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return { ok: false, code: "not-found", message: "Session not found" };

  const s = db.sessions[idx];
  const canAdmin = isExec(actor) || s.admins.includes(actor);
  if (!canAdmin) return { ok: false, code: "forbidden", message: "Admin only" };

  switch (op.op) {
    case "rename": {
      if (!op.name?.trim()) return { ok: false, code: "invalid", message: "Name required" };
      s.name = op.name.trim().slice(0, 60);
      break;
    }
    case "setCap": {
      if (op.cap != null && (op.cap < 2 || op.cap > 50)) {
        return { ok: false, code: "invalid", message: "Cap must be 2-50" };
      }
      s.cap = op.cap;
      break;
    }
    case "ban": {
      if (!s.banned.includes(op.user)) s.banned.push(op.user);
      s.presences = s.presences.filter(p => p.username !== op.user);
      s.memberIds = Array.from(new Set(s.presences.map(p => p.username)));
      s.admins   = s.admins.filter(m => m !== op.user);
      break;
    }
    case "unban": {
      s.banned = s.banned.filter(m => m !== op.user);
      break;
    }
    case "addInvisible": {
      if (!s.invisible.includes(op.user)) s.invisible.push(op.user);
      break;
    }
    case "removeInvisible": {
      s.invisible = s.invisible.filter(m => m !== op.user);
      break;
    }
    case "addAdmin": {
      if (!s.admins.includes(op.user)) s.admins.push(op.user);
      break;
    }
    case "removeAdmin": {
      s.admins = s.admins.filter(m => m !== op.user);
      break;
    }
    case "forceEnd": {
      s.presences = [];
      s.memberIds = [];
      if (s.kind === "user") {
        db.sessions.splice(idx, 1);
        write(db);
        return { ok: true, session: null };
      }
      break;
    }
  }

  s.updatedAt = new Date().toISOString();
  db.sessions[idx] = s;
  write(db);
  return { ok: true, session: s };
}

/**
 * Map a LiveKit room name back to a session id. Used by /api/livekit/token.
 * - `session:<id>` → `<id>` (primary convention)
 * - `<id>` bare → treated as session id as-is (tolerates legacy callers)
 * Returns null for non-session channels (`dm:*`, `group:*`).
 */
export function roomNameToSessionId(roomName: string): string | null {
  if (roomName.startsWith("session:")) return roomName.slice("session:".length);
  if (roomName.startsWith("dm:") || roomName.startsWith("group:")) return null;
  return roomName;
}
