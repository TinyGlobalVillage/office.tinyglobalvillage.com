import type { SmsMessage, SmsDirection } from "./types";
import { readJson, writeJson, shortId } from "./store";

const FILE = "sms.json";

type Db = {
  /** Keyed by the remote party's E.164 — our-side DID is elsewhere. */
  threads: Record<string, SmsMessage[]>;
};

function read(): Db {
  return readJson<Db>(FILE, { threads: {} });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

function otherParty(msg: { direction: SmsDirection; fromE164: string; toE164: string }): string {
  return msg.direction === "inbound" ? msg.fromE164 : msg.toE164;
}

export function listThreads(): Array<{
  peerE164: string;
  lastMessage: SmsMessage | null;
  unreadFor: (username: string) => number;
  count: number;
}> {
  const db = read();
  return Object.entries(db.threads).map(([peerE164, msgs]) => {
    const sorted = msgs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = sorted[sorted.length - 1] ?? null;
    return {
      peerE164,
      lastMessage: last,
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
