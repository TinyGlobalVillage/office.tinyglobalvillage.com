// In-memory sliding-window rate limiter. Office runs as a single PM2 process,
// so a module-level Map suffices; counters reset on restart, which is fine for
// abuse-blunting (not billing). Keyed by an arbitrary string, e.g.
// "passkey-assert:<username>" or "recovery-ip:<ip>".

const buckets = new Map<string, number[]>();
const PRUNE_HORIZON_MS = 60 * 60 * 1000; // drop keys idle for >1h
let callsSinceSweep = 0;

export type RateVerdict = { ok: boolean; retryAfterMs: number };

// Opportunistic sweep so the Map can't grow unbounded across many distinct
// keys (usernames/IPs) whose windows have long since expired.
function sweep(now: number): void {
  const horizon = now - PRUNE_HORIZON_MS;
  for (const [k, arr] of buckets) {
    if (arr.length === 0 || arr[arr.length - 1] < horizon) buckets.delete(k);
  }
}

export function rateLimit(key: string, max: number, windowMs: number): RateVerdict {
  const now = Date.now();
  if (++callsSinceSweep >= 1000) {
    callsSinceSweep = 0;
    sweep(now);
  }
  const cutoff = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (hits.length >= max) {
    buckets.set(key, hits);
    return { ok: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
  }
  hits.push(now);
  buckets.set(key, hits);
  return { ok: true, retryAfterMs: 0 };
}

/** Clear a key's window after a successful auth, so a user isn't penalised for
 *  earlier failed attempts once they get in. */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
