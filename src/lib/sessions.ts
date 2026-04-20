import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE     = path.join(DATA_DIR, "sessions.json");

export type SessionKind = "lounge" | "study" | "pair" | "user";

export type Session = {
  id: string;
  kind: SessionKind;
  name: string;
  createdBy: string | null;
  createdAt: string;
  cap: number | null;
  memberIds: string[];
  admins: string[];
  banned: string[];
  invisible: string[];
  /** `updatedAt` bumps on every presence heartbeat; used by the auto-delete sweeper. */
  updatedAt: string;
};

type Db = { sessions: Session[] };

const ISO_EPOCH = "2026-04-20T00:00:00.000Z";

const SEED: Session[] = [
  {
    id: "lounge",        kind: "lounge", name: "TGV Lounge", createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "study-1",       kind: "study",  name: "Study 1",    createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "study-2",       kind: "study",  name: "Study 2",    createdBy: null, createdAt: ISO_EPOCH,
    cap: null, memberIds: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "pair-1",        kind: "pair",   name: "Pair 1",     createdBy: null, createdAt: ISO_EPOCH,
    cap: 4, memberIds: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
  },
  {
    id: "pair-2",        kind: "pair",   name: "Pair 2",     createdBy: null, createdAt: ISO_EPOCH,
    cap: 4, memberIds: [], admins: [], banned: [], invisible: [], updatedAt: ISO_EPOCH,
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

export function listSessions(viewer: string): Session[] {
  const { sessions } = read();
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
  const { sessions } = read();
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
  // Pair-cap: hard 4-member limit for non-admins. Admins can join as a 5th occupant to monitor.
  if (
    session.kind === "pair" &&
    session.cap != null &&
    !viewerIsAdmin &&
    session.memberIds.filter(m => !session.invisible.includes(m)).length >= session.cap &&
    !session.memberIds.includes(username)
  ) {
    return { ok: false, code: "full", message: "This pair room is full" };
  }
  return { ok: true };
}

/**
 * Heartbeat: records that `username` is currently in `sessionId`. Also runs the
 * last-member-leaves sweep for user-created rooms. Returns the updated session
 * (or `null` if auto-deleted).
 */
export function heartbeatPresence(sessionId: string, username: string, present: boolean): Session | null {
  const db = read();
  const idx = db.sessions.findIndex(s => s.id === sessionId);
  if (idx < 0) return null;

  const s = db.sessions[idx];
  const had = s.memberIds.includes(username);
  if (present && !had) s.memberIds.push(username);
  if (!present && had) s.memberIds = s.memberIds.filter(m => m !== username);
  s.updatedAt = new Date().toISOString();

  // Auto-delete user-created rooms when the last member leaves.
  if (s.kind === "user" && s.memberIds.length === 0 && !present) {
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
      s.memberIds = s.memberIds.filter(m => m !== op.user);
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
