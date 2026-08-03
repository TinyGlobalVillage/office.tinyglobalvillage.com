/**
 * Box Usage Monitor — the Office-side tunables.
 *
 * Every knob the plan says the Hardening modal should own lives here, in
 * `data/host-metrics/host-metrics-config.json`, matching the mesh-vpn and
 * keycloak tiles. The file is Office's preferences, not a mirror of anything:
 * unlike Headscale there is no external source of truth to drift from — the
 * sampler is the only reader and this is the only writer.
 *
 * Reads never throw. A missing or corrupt file yields the defaults, because a
 * monitor that refuses to start over an unparseable preferences file is worse
 * than one running at 5 minutes when someone asked for 2.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import os from "os";
import path from "path";
import { CRITICAL_PCT, DEFAULTS, WARN_PCT } from "./compute";

const DIR = path.join(process.cwd(), "data", "host-metrics");
const FILE = path.join(DIR, "host-metrics-config.json");

export type HostMetricsConfig = {
  /** Sampler cadence in ms. Floored at 60s — see clamps below. */
  sampleIntervalMs: number;
  /** Samples older than this are pruned once a day. */
  retentionDays: number;
  /** NIC line rate that turns bytes/sec into a percentage. */
  nicCapMbps: number;
  /** Amber. */
  warnPct: number;
  /** Red — and, from phase 4, an Office alert. */
  criticalPct: number;
  /** Master switch for the sampler itself. Off = no rows, no alerts. */
  samplingEnabled: boolean;
  /** Whether crossing a threshold raises an Office alert (phase 4). */
  alertsEnabled: boolean;
  lastUpdated: string | null;
  /** Orientation for whoever opens the raw file. Carried through writes. */
  _note?: string;
};

export const CONFIG_DEFAULTS: HostMetricsConfig = {
  sampleIntervalMs: DEFAULTS.sampleIntervalMs,
  retentionDays: DEFAULTS.retentionDays,
  nicCapMbps: DEFAULTS.nicCapMbps,
  warnPct: WARN_PCT,
  criticalPct: CRITICAL_PCT,
  samplingEnabled: true,
  alertsEnabled: true,
  lastUpdated: null,
};

/**
 * Bounds, not validation-with-an-error. A 5-second cadence would hammer the
 * shared prod DB with 17k rows a day per box; a 400-day retention would keep
 * them. Out-of-range input is pulled to the nearest sane value rather than
 * rejected, so a typo in the modal can't leave the box unmonitored.
 */
const CLAMPS = {
  sampleIntervalMs: [60_000, 60 * 60_000],
  retentionDays: [1, 365],
  nicCapMbps: [1, 100_000],
  warnPct: [1, 99],
  criticalPct: [1, 100],
} as const;

function clampNum(key: keyof typeof CLAMPS, value: unknown, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const [lo, hi] = CLAMPS[key];
  return Math.min(hi, Math.max(lo, n));
}

function coerce(raw: unknown): HostMetricsConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Partial<HostMetricsConfig>;
  const warnPct = clampNum("warnPct", o.warnPct, CONFIG_DEFAULTS.warnPct);
  let criticalPct = clampNum("criticalPct", o.criticalPct, CONFIG_DEFAULTS.criticalPct);
  // Red below amber would make the amber band unreachable and every warn
  // instantly critical. Push red up rather than dropping the setting.
  if (criticalPct < warnPct) criticalPct = warnPct;
  return {
    sampleIntervalMs: clampNum("sampleIntervalMs", o.sampleIntervalMs, CONFIG_DEFAULTS.sampleIntervalMs),
    retentionDays: clampNum("retentionDays", o.retentionDays, CONFIG_DEFAULTS.retentionDays),
    nicCapMbps: clampNum("nicCapMbps", o.nicCapMbps, CONFIG_DEFAULTS.nicCapMbps),
    warnPct,
    criticalPct,
    samplingEnabled: o.samplingEnabled !== false,
    alertsEnabled: o.alertsEnabled !== false,
    lastUpdated: typeof o.lastUpdated === "string" ? o.lastUpdated : null,
    ...(typeof o._note === "string" ? { _note: o._note } : {}),
  };
}

export function readConfig(): HostMetricsConfig {
  try {
    return coerce(JSON.parse(readFileSync(FILE, "utf8")));
  } catch {
    return { ...CONFIG_DEFAULTS };
  }
}

/** Merge a partial update over the current config and persist it. */
export function writeConfig(patch: Partial<HostMetricsConfig>): HostMetricsConfig {
  const next = coerce({ ...readConfig(), ...patch, lastUpdated: new Date().toISOString() });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}

/**
 * Which box these samples describe. `TGV_HOST_NAME` wins so a box can report
 * under a stable name across rebuilds and hostname changes; otherwise the
 * kernel's hostname, which on RCS is already the name everyone uses.
 */
export function hostName(): string {
  return process.env.TGV_HOST_NAME || os.hostname() || "unknown";
}
