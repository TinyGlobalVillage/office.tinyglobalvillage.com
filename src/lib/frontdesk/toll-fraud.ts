// Toll-fraud audit log — telephony-security Item 5 / Tier 2.1 (2026-05-02).
//
// Persistent record of every SIP attack attempt the FS dialplan (or our
// log-scanner cron) catches. Lets us see attacker IPs, target numbers,
// time-of-day distribution, and fan-out trends. Useful as evidence if
// anything ever does slip through (ToS / criminal-complaint forensics).
//
// Storage: flat JSON array at data/frontdesk/toll-fraud-attempts.json,
// same convention as the rest of frontdesk/*.json. Capped at 5000 rows
// (older trimmed) — for archival, the observability cron rolls older
// rows into a daily-aggregated summary file (future).

import { readJson, writeJson } from "./store";

const FILE = "toll-fraud-attempts.json";
const MAX_ROWS = 5000;

export type TollFraudOutcome =
  | "rejected_dialplan_regex"  // FS dialplan regex didn't match
  | "rejected_authgate"        // sip_authorized != "true" (Item 5 dialplan gate)
  | "banned_fail2ban"          // fail2ban-toll-fraud added to ufw
  | "banned_manual"            // manual ufw block by operator
  | "rate_limit_hit"           // ringing rate-limiter dropped (Tier 2.2)
  | "telnyx_billing_spike";    // Telnyx anomaly webhook fired

export type TollFraudAttempt = {
  id: string;                  // tf_<ts>_<rand>
  ts: string;                  // ISO timestamp
  sourceIp: string | null;     // network-layer source (if known)
  fromUri: string | null;      // SIP From header (often spoofed)
  targetNumber: string | null; // destination_number the attacker tried
  outcome: TollFraudOutcome;
  detail: string | null;       // free-form: callId, log line excerpt, etc.
};

type Db = { attempts: TollFraudAttempt[] };

function read(): Db {
  return readJson<Db>(FILE, { attempts: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

function shortRand(len = 6): string {
  const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

export function recordTollFraudAttempt(
  params: Omit<TollFraudAttempt, "id" | "ts"> & { ts?: string },
): TollFraudAttempt {
  const ts = params.ts ?? new Date().toISOString();
  const row: TollFraudAttempt = {
    id: `tf_${Date.now()}_${shortRand()}`,
    ts,
    sourceIp: params.sourceIp ?? null,
    fromUri: params.fromUri ?? null,
    targetNumber: params.targetNumber ?? null,
    outcome: params.outcome,
    detail: params.detail ?? null,
  };
  const db = read();
  db.attempts.push(row);
  if (db.attempts.length > MAX_ROWS) db.attempts = db.attempts.slice(-MAX_ROWS);
  write(db);
  return row;
}

export function listTollFraudAttempts(limit = 500): TollFraudAttempt[] {
  return read().attempts.slice().reverse().slice(0, limit);
}

/**
 * Count attempts in the last `windowMs` ms, optionally filtered by outcome.
 * Used by the observability cron to detect attack-rate spikes.
 */
export function countRecentAttempts(
  windowMs: number,
  outcome?: TollFraudOutcome,
): number {
  const cutoff = Date.now() - windowMs;
  let n = 0;
  for (const row of read().attempts) {
    if (Date.parse(row.ts) < cutoff) continue;
    if (outcome && row.outcome !== outcome) continue;
    n += 1;
  }
  return n;
}

/**
 * Group recent attempts by source IP, sorted by hit count desc. Used by the
 * Front Desk admin UI (future) to show top offenders.
 */
export function topSourceIps(
  windowMs: number,
  limit = 10,
): Array<{ ip: string; count: number; lastSeen: string }> {
  const cutoff = Date.now() - windowMs;
  const counts = new Map<string, { count: number; lastSeen: string }>();
  for (const row of read().attempts) {
    if (Date.parse(row.ts) < cutoff) continue;
    if (!row.sourceIp) continue;
    const cur = counts.get(row.sourceIp) ?? { count: 0, lastSeen: row.ts };
    cur.count += 1;
    if (row.ts > cur.lastSeen) cur.lastSeen = row.ts;
    counts.set(row.sourceIp, cur);
  }
  return Array.from(counts.entries())
    .map(([ip, v]) => ({ ip, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
