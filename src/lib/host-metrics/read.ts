/**
 * Box Usage Monitor — the host reader. Everything that touches the machine
 * lives here; the arithmetic lives in compute.ts and stays testable.
 *
 * No root required: /proc is world-readable and statfs works on any path the
 * process can see. Linux-only by design — these are RCS's numbers, and on a
 * Mac dev box the /proc reads simply fail and the sample reports zeros rather
 * than inventing plausible ones.
 *
 * CPU and bandwidth are DELTAS, so a single call can't produce them: the first
 * call establishes a baseline and returns zeros for both. The sampler runs on
 * a fixed cadence, so from its second tick onward every sample is real.
 */
import "server-only";
import { readFile, statfs } from "fs/promises";
import {
  type HostSample,
  DEFAULTS,
  bwPctFromDelta,
  cpuPctFromDelta,
  diskPctFromBytes,
  ramPctFromMeminfo,
} from "./compute";
import { hostMetricsState } from "./state";

/** Filesystems that count toward the disk headline — worst-of across them. */
const DISK_PATHS = ["/", "/srv"];

/**
 * Loopback, container and overlay interfaces are not the uplink.
 *
 * `tailscale0` is excluded for a subtler reason than the rest: mesh traffic is
 * real, but it RIDES OVER eth0, so counting both would bill every mesh byte
 * twice against the NIC cap. Verified on RCS 2026-08-03 — the box reports
 * exactly eth0 + tailscale0.
 */
const SKIP_IFACES = /^(lo|docker|br-|veth|tun|tap|wg|virbr|tailscale|ts\d)/;

type CpuCounters = { idle: number; total: number };
type NetCounters = { rx: number; tx: number };

/**
 * Baseline for the delta metrics. Kept on the shared global (see state.ts) so
 * every bundle that samples differences against the SAME previous reading — a
 * per-module copy would silently restart the window on each route. A cold start
 * yields one zero-delta sample, which is the honest answer.
 */

/** Parse the aggregate `cpu` line of /proc/stat into idle + total jiffies. */
export function parseProcStat(text: string): CpuCounters | null {
  const line = text.split("\n").find((l) => l.startsWith("cpu "));
  if (!line) return null;
  const parts = line.trim().split(/\s+/).slice(1).map(Number);
  if (parts.length < 5 || parts.some((n) => !Number.isFinite(n))) return null;
  // user nice system idle iowait irq softirq steal …
  const idle = parts[3] + (parts[4] ?? 0); // idle + iowait
  const total = parts.reduce((a, b) => a + b, 0);
  return { idle, total };
}

/** MemTotal + MemAvailable (kB) out of /proc/meminfo. */
export function parseMeminfo(text: string): { totalKb: number; availableKb: number } | null {
  const grab = (key: string) => {
    const m = new RegExp(`^${key}:\\s+(\\d+) kB`, "m").exec(text);
    return m ? Number(m[1]) : NaN;
  };
  const totalKb = grab("MemTotal");
  const availableKb = grab("MemAvailable");
  if (!Number.isFinite(totalKb) || !Number.isFinite(availableKb)) return null;
  return { totalKb, availableKb };
}

/** Sum rx/tx bytes across the real interfaces in /proc/net/dev. */
export function parseNetDev(text: string): NetCounters {
  let rx = 0;
  let tx = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const iface = line.slice(0, colon).trim();
    if (SKIP_IFACES.test(iface)) continue;
    const cols = line.slice(colon + 1).trim().split(/\s+/).map(Number);
    // receive: bytes packets … (0) | transmit: bytes at index 8
    if (cols.length < 9) continue;
    if (Number.isFinite(cols[0])) rx += cols[0];
    if (Number.isFinite(cols[8])) tx += cols[8];
  }
  return { rx, tx };
}

async function readCpu(): Promise<CpuCounters | null> {
  try {
    return parseProcStat(await readFile("/proc/stat", "utf8"));
  } catch {
    return null; // not Linux, or /proc unavailable
  }
}

async function readRamPct(): Promise<number> {
  try {
    const parsed = parseMeminfo(await readFile("/proc/meminfo", "utf8"));
    return parsed ? ramPctFromMeminfo(parsed.totalKb, parsed.availableKb) : 0;
  } catch {
    return 0;
  }
}

async function readNet(): Promise<NetCounters | null> {
  try {
    return parseNetDev(await readFile("/proc/net/dev", "utf8"));
  } catch {
    return null;
  }
}

/**
 * Worst-of disk across DISK_PATHS. statfs beats shelling out to `df`: no
 * subprocess, no output parsing, no locale surprises. Paths that don't exist
 * (a box without a separate /srv) are skipped rather than counted as 0%.
 */
async function readDiskPct(): Promise<number> {
  let worst = 0;
  for (const path of DISK_PATHS) {
    try {
      const fs = await statfs(path);
      const total = Number(fs.blocks) * Number(fs.bsize);
      const free = Number(fs.bavail) * Number(fs.bsize);
      const pct = diskPctFromBytes(total - free, total);
      if (pct > worst) worst = pct;
    } catch {
      // filesystem absent on this box — not a reading of zero
    }
  }
  return worst;
}

export type Baseline = { cpu: CpuCounters | null; net: NetCounters | null; at: number | null };

/** One reading, differenced against `base`. Returns the sample and the new base. */
async function readAgainst(
  base: Baseline,
  nicCapMbps: number,
  now: number,
): Promise<{ sample: HostSample; base: Baseline }> {
  const [cpu, ramPct, net, diskPct] = await Promise.all([
    readCpu(),
    readRamPct(),
    readNet(),
    readDiskPct(),
  ]);

  let cpuPct = 0;
  if (cpu && base.cpu) cpuPct = cpuPctFromDelta(base.cpu, cpu);

  let bwPct = 0;
  if (net && base.net && base.at !== null) {
    bwPct = bwPctFromDelta(net.rx - base.net.rx, net.tx - base.net.tx, now - base.at, nicCapMbps);
  }

  return {
    sample: { cpuPct, ramPct, diskPct, bwPct },
    base: { cpu: cpu ?? base.cpu, net: net ?? base.net, at: now },
  };
}

/**
 * One sample against the SHARED baseline — the sampler's call.
 *
 * `cpuPct` and `bwPct` are 0 on the first call after start: they need two
 * readings to exist at all. Every later call measures the window since the
 * previous one, which for the sampler is exactly its cadence.
 */
export async function readSample(
  nicCapMbps: number = DEFAULTS.nicCapMbps,
  now: number = Date.now(),
): Promise<HostSample> {
  const s = hostMetricsState();
  const { sample, base } = await readAgainst(
    { cpu: s.prevCpu, net: s.prevNet, at: s.prevAt },
    nicCapMbps,
    now,
  );
  s.prevCpu = base.cpu;
  s.prevNet = base.net;
  s.prevAt = base.at;
  return sample;
}

/**
 * A sample with its OWN baseline, taken over a short window — what a UI asking
 * "what is the box doing right now" wants.
 *
 * It exists so the modal can't damage the history. Calling readSample() to
 * paint a live gauge would advance the shared baseline, and the sampler's next
 * row would then describe the seconds since the last UI poll instead of the
 * five minutes it claims to. Two reads a beat apart cost one extra /proc pass
 * and keep the two consumers independent.
 */
export async function readSampleIsolated(
  nicCapMbps: number = DEFAULTS.nicCapMbps,
  gapMs = 250,
): Promise<HostSample> {
  const t0 = Date.now();
  const first = await readAgainst({ cpu: null, net: null, at: null }, nicCapMbps, t0);
  await new Promise((r) => setTimeout(r, gapMs));
  const second = await readAgainst(first.base, nicCapMbps, Date.now());
  return second.sample;
}

/** Drop the delta baseline — for tests, and for a sampler restarting cleanly. */
export function resetBaseline(): void {
  const s = hostMetricsState();
  s.prevCpu = null;
  s.prevNet = null;
  s.prevAt = null;
}
