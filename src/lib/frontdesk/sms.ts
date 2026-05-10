import type { SmsMessage, SmsDirection } from "./types";
import { readJson, writeJson, shortId } from "./store";

const FILE = "sms.json";
const TRASH_RETENTION_DAYS = 30;
const TRASH_RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type DeletedThread = {
  messages: SmsMessage[];
  deletedAt: string; // ISO
};

type Db = {
  /** Keyed by the remote party's E.164 — our-side DID is elsewhere. */
  threads: Record<string, SmsMessage[]>;
  /** Soft-deleted threads, kept for TRASH_RETENTION_DAYS then hard-purged. */
  deletedThreads?: Record<string, DeletedThread>;
};

function read(): Db {
  const db = readJson<Db>(FILE, { threads: {}, deletedThreads: {} });
  if (!db.deletedThreads) db.deletedThreads = {};
  return db;
}

function write(db: Db): void {
  writeJson(FILE, db);
}

/**
 * Lazy purge: drop any soft-deleted thread older than 30 days. Called at the
 * top of every read of trash state — no cron needed. Returns the number of
 * threads actually purged.
 */
function purgeStaleTrash(db: Db): number {
  const now = Date.now();
  let purged = 0;
  const dt = db.deletedThreads ?? {};
  for (const [peer, entry] of Object.entries(dt)) {
    const age = now - new Date(entry.deletedAt).getTime();
    if (age > TRASH_RETENTION_MS) {
      delete dt[peer];
      purged += 1;
    }
  }
  if (purged > 0) write(db);
  return purged;
}

function otherParty(msg: { direction: SmsDirection; fromE164: string; toE164: string }): string {
  return msg.direction === "inbound" ? msg.fromE164 : msg.toE164;
}

export function listThreads(): Array<{
  peerE164: string;
  lastMessage: SmsMessage | null;
  /**
   * The Front-Desk DID this thread is currently associated with — derived
   * from the most recent message's our-side number (toE164 for inbound,
   * fromE164 for outbound). Used by the UI's DID toggle to filter threads.
   */
  ourDid: string | null;
  unreadFor: (username: string) => number;
  count: number;
}> {
  const db = read();
  return Object.entries(db.threads).map(([peerE164, msgs]) => {
    const sorted = msgs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = sorted[sorted.length - 1] ?? null;
    const ourDid = last
      ? (last.direction === "inbound" ? last.toE164 : last.fromE164)
      : null;
    return {
      peerE164,
      lastMessage: last,
      ourDid,
      count: msgs.length,
      unreadFor: (username: string) =>
        sorted.filter(m => m.direction === "inbound" && !m.readBy.includes(username)).length,
    };
  }).sort((a, b) => {
    const aT = a.lastMessage?.createdAt ?? "";
    const bT = b.lastMessage?.createdAt ?? "";
    return bT.localeCompare(aT);
  });
}

export function listThreadMessages(peerE164: string): SmsMessage[] {
  const db = read();
  return (db.threads[peerE164] ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function appendMessage(msg: Omit<SmsMessage, "id" | "createdAt" | "readBy"> & { readBy?: string[] }): SmsMessage {
  const full: SmsMessage = {
    id: shortId("sms"),
    createdAt: new Date().toISOString(),
    readBy: msg.readBy ?? [],
    ...msg,
  };
  const key = otherParty(full);
  const db = read();
  if (!db.threads[key]) db.threads[key] = [];
  db.threads[key].push(full);
  // Trim per-thread history to the last 1000 messages.
  if (db.threads[key].length > 1000) db.threads[key] = db.threads[key].slice(-1000);
  write(db);
  return full;
}

export function deleteMessage(peerE164: string, messageId: string): boolean {
  const db = read();
  const list = db.threads[peerE164];
  if (!list) return false;
  const before = list.length;
  db.threads[peerE164] = list.filter((m) => m.id !== messageId);
  if (db.threads[peerE164].length === before) return false;
  // Drop the thread entry entirely if no messages remain.
  if (db.threads[peerE164].length === 0) {
    delete db.threads[peerE164];
  }
  write(db);
  return true;
}

/**
 * Soft-delete a thread: move it to deletedThreads with a timestamp. The
 * thread will auto-purge after TRASH_RETENTION_DAYS unless the admin
 * restores it via restoreThread() or hard-deletes via permanentDeleteThread().
 */
export function deleteThread(peerE164: string): boolean {
  const db = read();
  const list = db.threads[peerE164];
  if (!list) return false;
  if (!db.deletedThreads) db.deletedThreads = {};
  db.deletedThreads[peerE164] = {
    messages: list,
    deletedAt: new Date().toISOString(),
  };
  delete db.threads[peerE164];
  write(db);
  return true;
}

export type TrashedThread = {
  peerE164: string;
  deletedAt: string;
  messageCount: number;
  lastMessage: SmsMessage | null;
  expiresAt: string; // ISO — when the auto-purge will fire
};

export function listTrash(): TrashedThread[] {
  const db = read();
  purgeStaleTrash(db);
  const dt = db.deletedThreads ?? {};
  return Object.entries(dt)
    .map(([peerE164, entry]) => {
      const sorted = entry.messages.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const last = sorted[sorted.length - 1] ?? null;
      const deletedAtMs = new Date(entry.deletedAt).getTime();
      return {
        peerE164,
        deletedAt: entry.deletedAt,
        messageCount: entry.messages.length,
        lastMessage: last,
        expiresAt: new Date(deletedAtMs + TRASH_RETENTION_MS).toISOString(),
      };
    })
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export function restoreThread(peerE164: string): boolean {
  const db = read();
  const trashed = db.deletedThreads?.[peerE164];
  if (!trashed) return false;
  // Merge: if the user re-created the thread while soft-deleted, preserve both
  // sets of messages (de-dupe by id).
  const existing = db.threads[peerE164] ?? [];
  const seen = new Set(existing.map((m) => m.id));
  const merged = [...existing];
  for (const m of trashed.messages) {
    if (!seen.has(m.id)) merged.push(m);
  }
  merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  db.threads[peerE164] = merged;
  delete db.deletedThreads![peerE164];
  write(db);
  return true;
}

export function permanentDeleteThread(peerE164: string): boolean {
  const db = read();
  if (!db.deletedThreads?.[peerE164]) return false;
  delete db.deletedThreads[peerE164];
  write(db);
  return true;
}

export function trashRetentionDays(): number {
  return TRASH_RETENTION_DAYS;
}

export function markThreadRead(peerE164: string, username: string): void {
  const db = read();
  const list = db.threads[peerE164];
  if (!list) return;
  let mutated = false;
  for (const m of list) {
    if (m.direction === "inbound" && !m.readBy.includes(username)) {
      m.readBy.push(username);
      mutated = true;
    }
  }
  if (mutated) write(db);
}
