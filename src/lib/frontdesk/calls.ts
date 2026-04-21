import type { CallRecord, CallDirection, CallOutcome } from "./types";
import { readJson, writeJson, shortId } from "./store";

const FILE = "calls.json";

type Db = { calls: CallRecord[] };

function read(): Db {
  return readJson<Db>(FILE, { calls: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

/** Most recent first, capped at `limit` (default 200). */
export function listCalls(limit = 200): CallRecord[] {
  return read().calls
    .slice()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export function getCall(id: string): CallRecord | null {
  return read().calls.find(c => c.id === id) ?? null;
}

export function createCall(params: {
  didId: string | null;
  direction: CallDirection;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string | null;
  ringTarget?: string | "*" | null;
}): CallRecord {
  const now = new Date().toISOString();
  const record: CallRecord = {
    id: shortId("call"),
    didId: params.didId,
    direction: params.direction,
    fromE164: params.fromE164,
    toE164: params.toE164,
    answeredBy: null,
    startedAt: now,
    answeredAt: null,
    endedAt: null,
    durationSec: 0,
    outcome: "missed",
    recordingPath: null,
    voicemailPath: null,
    telnyxCallControlId: params.telnyxCallControlId ?? null,
    consentAcknowledged: false,
    ringTarget: params.ringTarget ?? null,
    ringStartedAt: params.ringTarget ? now : null,
  };
  const db = read();
  db.calls.push(record);
  if (db.calls.length > 2000) db.calls = db.calls.slice(-2000);
  write(db);
  return record;
}

/** Currently-ringing inbound calls targeted at `username` or ring-all ("*"). */
export function ringingForUser(username: string): CallRecord[] {
  return read().calls.filter(c =>
    c.direction === "inbound" &&
    c.answeredAt === null &&
    c.endedAt === null &&
    (c.ringTarget === username || c.ringTarget === "*"),
  );
}

/** Promote a direct ring to ring-all ("*"). Called after 30s of no pickup. */
export function promoteRingToAll(id: string): CallRecord | null {
  return patchCall(id, { ringTarget: "*", ringStartedAt: new Date().toISOString() });
}

export function patchCall(id: string, patch: Partial<Omit<CallRecord, "id" | "startedAt">>): CallRecord | null {
  const db = read();
  const call = db.calls.find(c => c.id === id);
  if (!call) return null;
  Object.assign(call, patch);
  if (patch.endedAt && call.answeredAt) {
    call.durationSec = Math.max(
      0,
      Math.round((new Date(patch.endedAt).getTime() - new Date(call.answeredAt).getTime()) / 1000),
    );
  }
  write(db);
  return call;
}

export function markOutcome(id: string, outcome: CallOutcome): CallRecord | null {
  return patchCall(id, { outcome });
}

export function deleteCall(id: string): boolean {
  const db = read();
  const before = db.calls.length;
  db.calls = db.calls.filter(c => c.id !== id);
  const removed = before !== db.calls.length;
  if (removed) write(db);
  return removed;
}

export function deleteAllCalls(): number {
  const db = read();
  const n = db.calls.length;
  db.calls = [];
  write(db);
  return n;
}
