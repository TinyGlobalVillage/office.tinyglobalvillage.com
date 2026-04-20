import fs from "fs";
import path from "path";
import { getUserDisplayName } from "./users-config";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE     = path.join(DATA_DIR, "ring-calls.json");

/** Rings older than this are stale and get swept on every read. */
const STALE_MS = 45_000;

export type RingChannel = {
  type: "dm" | "group" | "session";
  id: string;
  name: string;
};

export type RingFrom = {
  id: string;
  name: string;
  avatar?: string | null;
};

export type Ring = {
  /** Deterministic id — we keep at most one active ring per (from, channel). */
  id: string;
  from: RingFrom;
  /** Who is being rung. For DMs and custom sessions, a single user id. For groups/seed sessions, the full member list. */
  to: string[];
  channel: RingChannel;
  startedAt: string;
};

type Db = { rings: Ring[] };

function read(): Db {
  try {
    if (!fs.existsSync(FILE)) return { rings: [] };
    const parsed = JSON.parse(fs.readFileSync(FILE, "utf8")) as Db;
    const rings = Array.isArray(parsed.rings) ? parsed.rings : [];
    const now = Date.now();
    const fresh = rings.filter(r => now - new Date(r.startedAt).getTime() < STALE_MS);
    return { rings: fresh };
  } catch {
    return { rings: [] };
  }
}

function write(db: Db): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function ringId(fromId: string, channel: RingChannel): string {
  return `${fromId}::${channel.type}:${channel.id}`;
}

export function startRing(params: {
  from: string;
  to: string[];
  channel: RingChannel;
}): Ring {
  const db = read();
  const id = ringId(params.from, params.channel);
  const ring: Ring = {
    id,
    from: { id: params.from, name: getUserDisplayName(params.from) || params.from },
    to: params.to,
    channel: params.channel,
    startedAt: new Date().toISOString(),
  };
  const existingIdx = db.rings.findIndex(r => r.id === id);
  if (existingIdx >= 0) db.rings[existingIdx] = ring;
  else db.rings.push(ring);
  write(db);
  return ring;
}

export function cancelRing(fromId: string, channel: RingChannel): boolean {
  const db = read();
  const id = ringId(fromId, channel);
  const before = db.rings.length;
  db.rings = db.rings.filter(r => r.id !== id);
  if (db.rings.length === before) return false;
  write(db);
  return true;
}

/**
 * Called by the recipient's DELETE (reject / accept / accept-notify) — clears the
 * ring targeting this user only; other recipients (in a group ring) stay ringing.
 */
export function resolveRingForUser(fromId: string, channel: RingChannel, recipient: string): boolean {
  const db = read();
  const id = ringId(fromId, channel);
  const idx = db.rings.findIndex(r => r.id === id);
  if (idx < 0) return false;
  const ring = db.rings[idx];
  ring.to = ring.to.filter(u => u !== recipient);
  if (ring.to.length === 0) db.rings.splice(idx, 1);
  else db.rings[idx] = ring;
  write(db);
  return true;
}

export function getRingFor(username: string): Ring | null {
  const { rings } = read();
  // Surface the newest ring the user is a target of (if multiple, toast shows most recent).
  const candidates = rings
    .filter(r => r.to.includes(username) && r.from.id !== username)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  return candidates[0] ?? null;
}
