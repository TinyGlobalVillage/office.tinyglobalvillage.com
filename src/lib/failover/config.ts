// Failover (RCS1 warm standby) — shared shapes + CLAMPS (no node imports, so client components can use it).
// The server side (fs) is ./state.ts. Keys and value rules mirror mono
// utils/scripts/system/failover/failover.env, which parses settings.env (never sources it).
export type FailoverSettings = {
  /** Off: RCS1 only watches and emails; a takeover then needs failover-promote.sh by hand. */
  autoTakeover: boolean;
  /** On: never take over and skip the scheduled drill (maintenance on RCS2). */
  hold: boolean;
  downMinutes: number;
  warnMinute: number;
  maxLagMinutes: number;
  alertTo: string;
  /** Months (1–12) whose first Sunday runs the sealed drill. */
  drillMonths: number[];
};
export type NumericKey = "downMinutes" | "warnMinute" | "maxLagMinutes";

export const DEFAULTS: FailoverSettings = {
  autoTakeover: true,
  hold: false,
  downMinutes: 5,
  warnMinute: 2,
  maxLagMinutes: 60,
  alertTo: "admin@tinyglobalvillage.com",
  drillMonths: [2, 5, 8, 11],
};

export const CLAMPS: Record<NumericKey, [number, number]> = {
  downMinutes: [3, 60],
  warnMinute: [1, 30],
  maxLagMinutes: [5, 1440],
};

export const TUNABLE = ["autoTakeover", "hold", "downMinutes", "warnMinute", "maxLagMinutes", "alertTo", "drillMonths"] as const;

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$/;
const clamp = (k: NumericKey, v: unknown, fb: number) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fb;
  return Math.min(CLAMPS[k][1], Math.max(CLAMPS[k][0], n));
};

/** Validate + clamp; anything invalid falls back to `base`. The warning always comes before the takeover. */
export function coerce(raw: Partial<Record<keyof FailoverSettings, unknown>>, base: FailoverSettings = DEFAULTS): FailoverSettings {
  const months = Array.isArray(raw.drillMonths)
    ? [...new Set(raw.drillMonths.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b)
    : base.drillMonths;
  const s: FailoverSettings = {
    autoTakeover: typeof raw.autoTakeover === "boolean" ? raw.autoTakeover : base.autoTakeover,
    hold: typeof raw.hold === "boolean" ? raw.hold : base.hold,
    downMinutes: clamp("downMinutes", raw.downMinutes ?? base.downMinutes, base.downMinutes),
    warnMinute: clamp("warnMinute", raw.warnMinute ?? base.warnMinute, base.warnMinute),
    maxLagMinutes: clamp("maxLagMinutes", raw.maxLagMinutes ?? base.maxLagMinutes, base.maxLagMinutes),
    alertTo: typeof raw.alertTo === "string" && EMAIL_RE.test(raw.alertTo.trim()) ? raw.alertTo.trim() : base.alertTo,
    drillMonths: months.length ? months : base.drillMonths,
  };
  if (s.warnMinute >= s.downMinutes) s.warnMinute = Math.max(1, s.downMinutes - 1);
  return s;
}

export type DrillResult = {
  at: string;
  kind: string;
  seconds: number;
  failed: number;
  passed: number;
  db_lag_s?: string;
  full_sync_age_h?: string;
  memory?: string;
  results: string[];
};

/** RCS1's watcher status (failover-watch.py), relayed by RCS2 every 5 min. */
export type Rcs1Status = {
  at: string;
  role: "standby" | "primary" | string;
  action: string;
  witness?: { rcs2_https: boolean; rcs2_mesh_ssh: boolean; public: boolean; self_online: boolean };
  down_minutes?: number;
  replica?: { replay_age_s?: number; receiver?: string; last_receipt?: number; in_recovery?: boolean; error?: string };
  prepare?: { at?: string; ok?: boolean; [k: string]: unknown };
  drill_last?: DrillResult;
  takeover?: { at?: string; [k: string]: unknown };
};
export type SyncResult = { mode: "data" | "full"; at: string; ok: boolean; failures: number; seconds: number };

export type FailoverSnapshot = {
  installed: boolean;
  settings: FailoverSettings;
  rcs1: Rcs1Status | null;
  health: { at: string; problems: string[] } | null;
  nextDrill: string | null;
  sync: { data: SyncResult | null; full: SyncResult | null };
  drillRequested: boolean;
};
