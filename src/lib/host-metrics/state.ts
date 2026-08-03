/**
 * Box Usage Monitor — the sampler's mutable state, parked on `globalThis`.
 *
 * WHY NOT MODULE-LEVEL `let`. Next bundles `instrumentation.ts` and each route
 * handler separately, so a plain module variable is not one variable — the copy
 * `startSampler()` writes at boot is a different object from the one
 * `/api/admin/host-metrics` reads. Caught in UAT: five samples had been written
 * and the modal still said "last sample: never", because the API was reading a
 * second, untouched copy of the module.
 *
 * Everything mutable therefore lives here, behind a single global key. It also
 * survives dev HMR, so editing the sampler doesn't silently start a second
 * timer alongside the first.
 */
import type { HostSample } from "./compute";

type CpuCounters = { idle: number; total: number };
type NetCounters = { rx: number; tx: number };

export type SkipReason = "disabled" | "no-table" | "priming";

export type HostMetricsState = {
  // sampler
  timer: ReturnType<typeof setTimeout> | null;
  started: boolean;
  nextRunAt: number | null;
  lastSkip: SkipReason | null;
  lastSampleAt: number | null;
  lastSample: HostSample | null;
  lastError: string | null;
  lastPruneAt: number | null;
  lastPruneDeleted: number | null;
  lastAlertAt: number | null;
  priming: boolean;
  // delta baseline for the shared reader
  prevCpu: CpuCounters | null;
  prevNet: NetCounters | null;
  prevAt: number | null;
};

const KEY = Symbol.for("tgv.host-metrics.state");

function fresh(): HostMetricsState {
  return {
    timer: null,
    started: false,
    nextRunAt: null,
    lastSkip: null,
    lastSampleAt: null,
    lastSample: null,
    lastError: null,
    lastPruneAt: null,
    lastPruneDeleted: null,
    lastAlertAt: null,
    priming: true,
    prevCpu: null,
    prevNet: null,
    prevAt: null,
  };
}

export function hostMetricsState(): HostMetricsState {
  const g = globalThis as unknown as Record<symbol, HostMetricsState | undefined>;
  if (!g[KEY]) g[KEY] = fresh();
  return g[KEY];
}
