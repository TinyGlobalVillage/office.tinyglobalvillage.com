// Runtime-tunable telephony hardening config — telephony-security Item 5
// modal (2026-05-02).
//
// Stored at data/frontdesk/telephony-config.json. Read at request-time by
// `createCall()` (ringing rate-limit) and by the `sip-attack-watch` cron
// (threshold + cooldown). Changes via the Telephony modal take effect on
// the next call into either consumer — no PM2 reload needed.
//
// Defaults are applied if the file is missing or malformed; no exceptions
// are thrown. We never fail-closed here — the hardened defaults are safe
// even if the runtime config is unreadable.

import { readJson, writeJson } from "./store";

const FILE = "telephony-config.json";

export type TelephonyConfig = {
  /** Max age (ms) before a "ringing" CDR is dropped from the polling endpoint. */
  ringingRateLimitMs: number;
  /** sip-attack-watch fires an announcement when total INVITEs in 5min exceed this. */
  attackWatchThreshold: number;
  /** Minimum gap (ms) between consecutive sip-attack-watch announcements. */
  attackWatchCooldownMs: number;
};

export const DEFAULT_TELEPHONY_CONFIG: TelephonyConfig = {
  ringingRateLimitMs: 30_000,
  attackWatchThreshold: 30,
  attackWatchCooldownMs: 60 * 60 * 1000,
};

/**
 * Read the current runtime config. Always returns a complete object —
 * unknown fields fall back to defaults so callers can use any field
 * without null-guarding.
 */
export function readTelephonyConfig(): TelephonyConfig {
  const stored = readJson<Partial<TelephonyConfig>>(FILE, {});
  return {
    ringingRateLimitMs:
      typeof stored.ringingRateLimitMs === "number" && stored.ringingRateLimitMs > 0
        ? stored.ringingRateLimitMs
        : DEFAULT_TELEPHONY_CONFIG.ringingRateLimitMs,
    attackWatchThreshold:
      typeof stored.attackWatchThreshold === "number" && stored.attackWatchThreshold > 0
        ? stored.attackWatchThreshold
        : DEFAULT_TELEPHONY_CONFIG.attackWatchThreshold,
    attackWatchCooldownMs:
      typeof stored.attackWatchCooldownMs === "number" && stored.attackWatchCooldownMs > 0
        ? stored.attackWatchCooldownMs
        : DEFAULT_TELEPHONY_CONFIG.attackWatchCooldownMs,
  };
}

export function writeTelephonyConfig(patch: Partial<TelephonyConfig>): TelephonyConfig {
  const current = readTelephonyConfig();
  const next: TelephonyConfig = { ...current, ...patch };
  // Sanity bounds — refuse obviously-broken values rather than persist them.
  if (next.ringingRateLimitMs < 1_000 || next.ringingRateLimitMs > 5 * 60_000) {
    throw new Error(`ringingRateLimitMs out of bounds (1000..300000): ${next.ringingRateLimitMs}`);
  }
  if (next.attackWatchThreshold < 1 || next.attackWatchThreshold > 10_000) {
    throw new Error(`attackWatchThreshold out of bounds (1..10000): ${next.attackWatchThreshold}`);
  }
  if (next.attackWatchCooldownMs < 60_000 || next.attackWatchCooldownMs > 24 * 60 * 60_000) {
    throw new Error(`attackWatchCooldownMs out of bounds (60000..86400000): ${next.attackWatchCooldownMs}`);
  }
  writeJson(FILE, next);
  return next;
}
