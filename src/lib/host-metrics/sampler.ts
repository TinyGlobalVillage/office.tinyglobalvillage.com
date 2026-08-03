/**
 * Box Usage Monitor — the sampler. Reads the host on a cadence and writes one
 * row per tick.
 *
 * IN-PROCESS, NOT A SYSTEM CRON. The delta metrics decide this: CPU and
 * bandwidth only exist as a difference between two readings, so the process
 * that samples has to remember the previous one. A crontab line shelling into a
 * one-shot script would start cold every time and report 0% CPU forever unless
 * it persisted counters somewhere — which is a cache file plus its staleness
 * rules, to replace a `setTimeout`.
 *
 * SELF-RESCHEDULING setTimeout, not setInterval. Two reasons: a tick that
 * outruns the cadence (a stalled DB) can never overlap itself, and the cadence
 * is re-read from config on every tick, so changing it in the Hardening modal
 * takes effect at the next tick instead of at the next deploy.
 *
 * ONE WRITER. Under pm2 cluster mode every worker would run this and the table
 * would get N identical rows per tick — so only instance 0 samples.
 *
 * All mutable state lives in state.ts on `globalThis`, not in module-level
 * `let`s: Next bundles instrumentation and each route separately, so a module
 * variable is not one variable across them. See that file for the UAT that
 * caught it.
 */
import "server-only";
import {
  insertSample,
  pruneOlderThan,
  tableExists,
  type HostMetricRow,
} from "../db-host-metrics";
import { evaluateAlert } from "./alerts";
import { computeCapacity, type HostSample } from "./compute";
import { hostName, readConfig } from "./config";
import { readSample, resetBaseline } from "./read";
import { hostMetricsState, type SkipReason } from "./state";

const PRUNE_EVERY_MS = 24 * 60 * 60_000;

export type SamplerStatus = {
  running: boolean;
  /** Why the last tick wrote nothing, if it didn't. */
  lastSkip: SkipReason | null;
  lastSampleAt: string | null;
  lastSample: HostSample | null;
  lastError: string | null;
  lastPruneAt: string | null;
  lastPruneDeleted: number | null;
  /** When an alert last went out — the modal shows it beside the thresholds. */
  lastAlertAt: string | null;
  nextRunAt: string | null;
  host: string;
};

/**
 * pm2 sets NODE_APP_INSTANCE per worker; fork mode leaves it unset. Absent or
 * "0" means this is the one process allowed to write.
 */
function isWriterInstance(): boolean {
  const id = process.env.NODE_APP_INSTANCE;
  return id === undefined || id === "" || id === "0";
}

/**
 * One tick. Returns the row it wrote, or null with a reason on `lastSkip`.
 *
 * `force` is the modal's "sample now": it bypasses the priming skip so a human
 * pressing the button gets a row, accepting that its CPU and bandwidth are
 * measured against whenever the last read happened rather than a clean window.
 */
export async function sampleOnce(force = false): Promise<HostMetricRow | null> {
  const s = hostMetricsState();
  const cfg = readConfig();

  if (!force && !cfg.samplingEnabled) {
    s.lastSkip = "disabled";
    return null;
  }

  // Re-checked every tick rather than once at boot, so applying the DDL starts
  // collection without a restart.
  if (!(await tableExists())) {
    s.lastSkip = "no-table";
    return null;
  }

  const sample = await readSample(cfg.nicCapMbps);
  s.lastSample = sample;

  if (s.priming && !force) {
    s.priming = false;
    s.lastSkip = "priming";
    return null;
  }
  s.priming = false;

  const host = hostName();
  await insertSample(host, sample);
  s.lastSampleAt = Date.now();
  s.lastSkip = null;
  const { worstPct, worst } = computeCapacity(sample);

  // Alerting can't be allowed to lose the row we just wrote. The history is the
  // thing that survives; a missed notification is recoverable, a missing sample
  // is not.
  try {
    const { fired } = await evaluateAlert(host, worstPct, worst, s.lastSampleAt);
    if (fired) s.lastAlertAt = s.lastSampleAt;
  } catch {
    /* see above */
  }

  return { ts: new Date(s.lastSampleAt), host, ...sample, worstPct, worst };
}

/** Retention prune, at most once a day. */
async function maybePrune(retentionDays: number): Promise<void> {
  const s = hostMetricsState();
  if (s.lastPruneAt !== null && Date.now() - s.lastPruneAt < PRUNE_EVERY_MS) return;
  if (!(await tableExists())) return;
  s.lastPruneDeleted = await pruneOlderThan(retentionDays);
  s.lastPruneAt = Date.now();
}

async function tick(): Promise<void> {
  const s = hostMetricsState();
  const cfg = readConfig();
  try {
    await sampleOnce();
    await maybePrune(cfg.retentionDays);
    s.lastError = null;
  } catch (err) {
    // A DB blip must not kill the timer — record it and try again next tick.
    s.lastError = err instanceof Error ? err.message : String(err);
  } finally {
    schedule(readConfig().sampleIntervalMs);
  }
}

function schedule(delayMs: number): void {
  const s = hostMetricsState();
  if (!s.started) return;
  s.nextRunAt = Date.now() + delayMs;
  s.timer = setTimeout(() => void tick(), delayMs);
  // Don't hold the event loop open on this alone.
  s.timer.unref?.();
}

/** Idempotent. Safe to call from instrumentation on every boot. */
export function startSampler(): void {
  const s = hostMetricsState();
  if (s.started) return;
  if (!isWriterInstance()) return;
  s.started = true;
  s.priming = true;
  resetBaseline();
  // First tick immediately: it establishes the delta baseline and answers
  // "does the table exist yet" without waiting out a whole interval.
  schedule(0);
}

export function stopSampler(): void {
  const s = hostMetricsState();
  s.started = false;
  if (s.timer) clearTimeout(s.timer);
  s.timer = null;
  s.nextRunAt = null;
}

export function samplerStatus(): SamplerStatus {
  const s = hostMetricsState();
  return {
    running: s.started,
    lastSkip: s.lastSkip,
    lastSampleAt: s.lastSampleAt === null ? null : new Date(s.lastSampleAt).toISOString(),
    lastSample: s.lastSample,
    lastError: s.lastError,
    lastPruneAt: s.lastPruneAt === null ? null : new Date(s.lastPruneAt).toISOString(),
    lastPruneDeleted: s.lastPruneDeleted,
    lastAlertAt: s.lastAlertAt === null ? null : new Date(s.lastAlertAt).toISOString(),
    nextRunAt: s.nextRunAt === null ? null : new Date(s.nextRunAt).toISOString(),
    host: hostName(),
  };
}
