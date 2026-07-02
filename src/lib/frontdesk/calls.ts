import type { CallRecord, CallDirection, CallOutcome } from "./types";
import { readJson, writeJson, shortId } from "./store";
import { readTelephonyConfig } from "./telephony-config";

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

/**
 * Rate-limit window for ringing-record creation per (direction, fromE164).
 * Defense against SIP-flood attacks creating thousands of zombie records —
 * the fraudulent INVITE burst seen 2026-05-02 produced ~50 ringing records
 * per second from the same spoofed origin before this guard existed.
 *
 * The window is admin-tunable from the Telephony modal (writes
 * data/frontdesk/telephony-config.json). Reads are per-call so changes
 * take effect immediately without restart.
 */

export function createCall(params: {
  didId: string | null;
  direction: CallDirection;
  fromE164: string;
  toE164: string;
  telnyxCallControlId?: string | null;
  ringTarget?: string | "*" | null;
}): CallRecord {
  // Rate-limit: if there's already a ringing record from this origin within
  // the window, return it instead of creating a duplicate. Inbound only —
  // outbound CDRs are user-initiated and not abusable from outside.
  if (params.direction === "inbound") {
    const { ringingRateLimitMs } = readTelephonyConfig();
    const cutoff = Date.now() - ringingRateLimitMs;
    const existing = read().calls.find(c =>
      c.direction === "inbound" &&
      c.fromE164 === params.fromE164 &&
      c.answeredAt === null &&
      c.endedAt === null &&
      Date.parse(c.startedAt) >= cutoff,
    );
    if (existing) return existing;
  }

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
    notes: "",
  };
  const db = read();
  db.calls.push(record);
  if (db.calls.length > 2000) db.calls = db.calls.slice(-2000);
  write(db);
  return record;
}

/**
 * Currently-ringing inbound calls targeted at `username` or ring-all ("*").
 *
 * Hardening: only treat a call as "ringing" if it ALSO started within the
 * last RING_MAX_AGE_MS. This is a defense against stale records driving the
 * IncomingCallOverlay forever (e.g. if a webhook crashes mid-flow and never
 * sets endedAt, or under SIP-flood attack where the FS-side cleanup races
 * with the database write).
 *
 * Real ring-all timeout in our dialplan is 25s (call_timeout), so 60s here
 * is a safe ceiling that won't cut off legitimate slow rings.
 */
const RING_MAX_AGE_MS = 60 * 1000;
export function ringingForUser(username: string): CallRecord[] {
  const now = Date.now();
  return read().calls.filter(c => {
    if (c.direction !== "inbound") return false;
    if (c.answeredAt !== null || c.endedAt !== null) return false;
    if (c.ringTarget !== username && c.ringTarget !== "*") return false;
    const startedMs = c.startedAt ? new Date(c.startedAt).getTime() : 0;
    if (!startedMs || now - startedMs > RING_MAX_AGE_MS) return false;
    return true;
  });
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

/**
 * Attach a finished mid-call recording segment to the open (answered, not
 * yet ended) inbound CDR from `fromE164`. Inbound CDRs exist during the call
 * (created at ring by the webhook path) but nothing posts recording fields
 * for them at hangup — without this, an inbound segment stopped from the
 * REC toggle would exist on disk yet never appear in Saved Recordings.
 * Newest match wins. No-op when no open inbound call matches.
 */
export function appendSegmentToOpenInboundCall(fromE164: string, segmentPath: string): CallRecord | null {
  const db = read();
  const open = db.calls
    .filter(c =>
      c.direction === "inbound" &&
      c.fromE164 === fromE164 &&
      c.answeredAt !== null &&
      c.endedAt === null,
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  if (!open) return null;
  const paths = open.recordingPaths?.length
    ? open.recordingPaths
    : (open.recordingPath ? [open.recordingPath] : []);
  if (!paths.includes(segmentPath)) paths.push(segmentPath);
  open.recordingPaths = paths;
  open.recordingPath = open.recordingPath ?? paths[0] ?? null;
  write(db);
  return open;
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
