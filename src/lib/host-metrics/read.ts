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
 * Baseline for the delta metrics. Module-level on purpose: the sampler is a
 * long-lived process, so consecutive ticks share it. A cold start (or a
 * process restart) yields one zero-delta sample, which is the honest answer.
 */
let prevCpu: CpuCounters | null = null;
let prevNet: NetCounters | null = null;
let prevAt: number | null = null;

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

/**
 * One sample. `cpuPct` and `bwPct` are 0 on the first call after start —
 * they need two readings to exist at all.
 */
export async function readSample(
  nicCapMbps: number = DEFAULTS.nicCapMbps,
  now: number = Date.now(),
): Promise<HostSample> {
  const [cpu, ramPct, net, diskPct] = await Promise.all([
    readCpu(),
    readRamPct(),
    readNet(),
    readDiskPct(),
  ]);

  let cpuPct = 0;
  if (cpu && prevCpu) cpuPct = cpuPctFromDelta(prevCpu, cpu);
  if (cpu) prevCpu = cpu;

  let bwPct = 0;
  if (net && prevNet && prevAt !== null) {
    bwPct = bwPctFromDelta(net.rx - prevNet.rx, net.tx - prevNet.tx, now - prevAt, nicCapMbps);
  }
  if (net) prevNet = net;
  prevAt = now;

  return { cpuPct, ramPct, diskPct, bwPct };
}

/** Drop the delta baseline — for tests, and for a sampler restarting cleanly. */
export function resetBaseline(): void {
  prevCpu = null;
  prevNet = null;
  prevAt = null;
}
