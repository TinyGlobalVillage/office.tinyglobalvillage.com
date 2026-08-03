/**
 * Box Usage Monitor — the pure arithmetic. No I/O, no DB, no `server-only`, so
 * it can be unit-tested with plain `node --test` (see compute.test.mjs).
 *
 * Two decisions from the plan drive everything here:
 *
 * WORST-OF, not an average of resources. A box dies from whichever resource
 * fills FIRST, so the headline is `max(cpu, ram, disk, bandwidth)`. Blending
 * them would let a maxed disk hide behind three idle resources — the one
 * number that matters would go down as the box got closer to falling over.
 *
 * ROLLING AVERAGE, not the instant reading. "Should we upgrade?" is a question
 * about sustained load; a backup job pinning the CPU for ninety seconds is not
 * a reason to buy a second box. The bar reads a multi-day mean and the live
 * values sit underneath it.
 */

export type Resource = "cpu" | "ram" | "disk" | "bandwidth";

export type HostSample = {
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  bwPct: number;
};

export type Capacity = {
  worstPct: number;
  /** Which resource is closest to full — the one to fix. */
  worst: Resource;
};

export type ThresholdStatus = "ok" | "warn" | "critical";

/** Locked in the plan: amber at 75, red at 90 (+ an Office alert). */
export const WARN_PCT = 75;
export const CRITICAL_PCT = 90;

/** Defaults; every one is meant to be overridable from the Hardening modal. */
export const DEFAULTS = {
  /** Sampler cadence. */
  sampleIntervalMs: 5 * 60_000,
  /** Prune samples older than this. */
  retentionDays: 90,
  /** NIC line rate used to turn bytes/sec into a percentage. */
  nicCapMbps: 1000,
} as const;

const RESOURCES: Resource[] = ["cpu", "ram", "disk", "bandwidth"];

/** Clamp to a sane percentage — a bad reading must never poison the headline. */
export function clampPct(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * Worst-of across the four resources. Ties resolve in RESOURCES order, which
 * puts cpu first — arbitrary, but stable, so the reported `worst` doesn't
 * flicker between two equally-full resources on consecutive samples.
 */
export function computeCapacity(sample: HostSample): Capacity {
  const byResource: Record<Resource, number> = {
    cpu: clampPct(sample.cpuPct),
    ram: clampPct(sample.ramPct),
    disk: clampPct(sample.diskPct),
    bandwidth: clampPct(sample.bwPct),
  };
  let worst: Resource = "cpu";
  for (const r of RESOURCES) {
    if (byResource[r] > byResource[worst]) worst = r;
  }
  return { worstPct: byResource[worst], worst };
}

/** ok / warn(≥75) / critical(≥90). */
export function evaluateThreshold(worstPct: number): ThresholdStatus {
  const pct = clampPct(worstPct);
  if (pct >= CRITICAL_PCT) return "critical";
  if (pct >= WARN_PCT) return "warn";
  return "ok";
}

/**
 * Mean of the samples inside `windowMs` counting back from `now`.
 *
 * Returns null for an empty window rather than 0: "no data" and "the box is
 * idle" are different claims, and a monitor that renders a missing 30-day
 * history as a reassuring 0% is worse than one that admits it doesn't know.
 */
export function rollingAverage(
  samples: Array<{ ts: number | Date; worstPct: number }>,
  windowMs: number,
  now: number = Date.now(),
): number | null {
  const cutoff = now - windowMs;
  let total = 0;
  let count = 0;
  for (const s of samples) {
    const ts = s.ts instanceof Date ? s.ts.getTime() : s.ts;
    if (!Number.isFinite(ts) || ts < cutoff || ts > now) continue;
    total += clampPct(s.worstPct);
    count += 1;
  }
  return count === 0 ? null : total / count;
}

export const WINDOWS = {
  "24h": 24 * 60 * 60_000,
  "7d": 7 * 24 * 60 * 60_000,
  "30d": 30 * 24 * 60 * 60_000,
} as const;

export type WindowKey = keyof typeof WINDOWS;

/** The three windows the modal shows, each null when that window has no data. */
export function rollingAverages(
  samples: Array<{ ts: number | Date; worstPct: number }>,
  now: number = Date.now(),
): Record<WindowKey, number | null> {
  return {
    "24h": rollingAverage(samples, WINDOWS["24h"], now),
    "7d": rollingAverage(samples, WINDOWS["7d"], now),
    "30d": rollingAverage(samples, WINDOWS["30d"], now),
  };
}

// ── Raw readings → percentages ──────────────────────────────────────────

/**
 * CPU busy % between two /proc/stat readings. CPU is only meaningful as a
 * DELTA — /proc/stat counts jiffies since boot, so a single reading tells you
 * the average since the machine started, not what it is doing now.
 */
export function cpuPctFromDelta(
  prev: { idle: number; total: number },
  next: { idle: number; total: number },
): number {
  const dTotal = next.total - prev.total;
  const dIdle = next.idle - prev.idle;
  if (dTotal <= 0) return 0; // counter reset / same reading
  return clampPct(((dTotal - dIdle) / dTotal) * 100);
}

/**
 * RAM % from MemAvailable — NOT MemFree. Linux spends free memory on cache and
 * gives it back under pressure, so MemFree reads alarmingly low on a perfectly
 * healthy box. MemAvailable is the kernel's own estimate of what a new process
 * could actually get.
 */
export function ramPctFromMeminfo(totalKb: number, availableKb: number): number {
  if (!(totalKb > 0)) return 0;
  return clampPct(((totalKb - availableKb) / totalKb) * 100);
}

/** Disk % used from a filesystem's used/total bytes. */
export function diskPctFromBytes(usedBytes: number, totalBytes: number): number {
  if (!(totalBytes > 0)) return 0;
  return clampPct((usedBytes / totalBytes) * 100);
}

/**
 * Bandwidth % of the NIC line rate, from a bytes-delta over an elapsed window.
 * rx+tx are summed against a full-duplex cap, so this over-reports a link doing
 * heavy traffic in both directions at once — deliberately, since the headline
 * should lean pessimistic about when to add a box.
 */
export function bwPctFromDelta(
  rxBytesDelta: number,
  txBytesDelta: number,
  elapsedMs: number,
  nicCapMbps: number = DEFAULTS.nicCapMbps,
): number {
  if (!(elapsedMs > 0) || !(nicCapMbps > 0)) return 0;
  const bytes = Math.max(0, rxBytesDelta) + Math.max(0, txBytesDelta);
  const bitsPerSec = (bytes * 8) / (elapsedMs / 1000);
  return clampPct((bitsPerSec / (nicCapMbps * 1_000_000)) * 100);
}
