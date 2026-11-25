/**
 * Cockpit — one live frame of the box Office runs on (RCS2), read straight from /proc, /sys and
 * pm2, plus the state of every surface folded into the Cockpit (health, pool governor, pipeline,
 * workshop DB). Polled by the Cockpit modal every 1–10 s (the viewer picks), so it is cheap:
 * rates come from the delta to the previous call (kept in module memory), pm2 is cached 5 s.
 *
 * Not a sampler — nothing is stored. History stays with host-metrics (Box Usage → History).
 * Plan: ~/.claude/checklist/rcs2-cockpit.md (P1 instruments, P2 annunciators). Multi-box comes
 * with rcs-probe (P0); until then the frame is "this box".
 */
import "server-only";
import { execFile } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { statfs } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { hostName, readConfig } from "@/lib/host-metrics/config";
import { healthStatus } from "@/lib/host-metrics/health";
import { prodMemPsi, workshopMemPsi, workshopUsage } from "@/lib/host-metrics/psi";
import { readStatus as readGov } from "@/lib/rcs-gov/state";
import { readStatus as readWorkshopDb } from "@/lib/workshop-db/state";
import { readReleases } from "@/lib/workshop-deploy";

const execFileP = promisify(execFile);

export type Light = {
  id: string;
  label: string;
  level: "ok" | "warn" | "critical" | "off";
  detail: string;
  /** Which Cockpit panel explains it. */
  panel: CockpitPanel;
};
export type CockpitPanel = "deck" | "box-usage" | "rcs-gov" | "pipeline" | "workshop-db" | "migration-snapshots" | "rcs-maintenance";

/** capMb = pm2's max_memory_restart (pm2 restarts the app past it); heapMb = node --max-old-space-size (V8's heap
 *  ceiling, from NODE_OPTIONS or node_args). Either is null when the app runs without one. */
export type Pm2App = { name: string; status: string; memMb: number; cpu: number; restarts: number; uptimeMs: number | null; capMb: number | null; heapMb: number | null; cron: boolean };

export type LiveFrame = {
  at: number;
  host: string;
  uptimeSec: number;
  cores: number[];          // % busy per core since the previous frame
  cpuPct: number;           // all cores
  /** The kernel's load averages (1 / 5 / 15 min). An estimate sampled every 5 s — on this box it reads
   *  well above the truth, because many sessions wake on the same ticks. Kept for reference only. */
  load: [number, number, number];
  /** Measured, not sampled: the scheduler's own accounting of how many tasks were on a CPU and how
   *  many were waiting for one, averaged over `windowSec`. `total` is the true load. Null on a host
   *  without /proc/schedstat. */
  runq: { running: number; waiting: number; total: number; windowSec: number } | null;
  ram: { totalMb: number; usedMb: number; pct: number };
  swap: { totalMb: number; usedMb: number; pct: number };
  disk: { totalGb: number; usedGb: number; pct: number };
  psiMemSome: number | null; // prod (system.slice) memory PSI some avg10
  psiWorkshopSome: number | null; // workshop slice memory PSI some avg10
  /** The workshop slice on its own (lanes, builds, dev servers), so the deck can show it apart from the server. */
  workshop: { cpuPct: number | null; cpuCapPct: number | null; memMb: number | null; swapMb: number | null; swapMaxMb: number | null } | null;
  temps: { cpuC: number | null; disks: Array<{ name: string; c: number }> };
  net: { iface: string | null; rxMbps: number; txMbps: number };
  io: { readMBs: number; writeMBs: number };
  apps: Pm2App[];
  slice: { usedMb: number; highMb: number | null; maxMb: number | null; triggerMb: number; enabled: boolean } | null;
  thresholds: { warnPct: number; criticalPct: number };
  lights: Light[];
};

type Prev = { at: number; wsCpuUsec: number | null; cpu: number[][]; net: { rx: number; tx: number } | null; io: { r: number; w: number } | null };
let prev: Prev | null = null;

// Cumulative scheduler time (ns): tasks' time on a CPU, and time spent runnable but waiting for one.
// /proc/schedstat, per-cpu line: fields 7 and 8 after the name. Their growth over an interval, divided
// by the interval, is exactly the average number of tasks running / waiting — no sampling involved.
type Sched = { at: number; run: number; wait: number };
let schedRing: Sched[] = [];
const RUNQ_WINDOW_MS = 60_000;

function schedNow(at: number): Sched | null {
  const lines = read("/proc/schedstat").split("\n").filter((l) => /^cpu\d+ /.test(l));
  if (!lines.length) return null;
  let run = 0, wait = 0;
  for (const l of lines) {
    const f = l.trim().split(/\s+/);
    run += Number(f[7] ?? 0);
    wait += Number(f[8] ?? 0);
  }
  return Number.isFinite(run) && Number.isFinite(wait) ? { at, run, wait } : null;
}

/** Average tasks running / waiting over (up to) the last minute of frames. */
function measuredLoad(now: number): LiveFrame["runq"] {
  const cur = schedNow(now);
  if (!cur) return null;
  schedRing = schedRing.filter((x) => now - x.at <= RUNQ_WINDOW_MS + 15_000 && x.run <= cur.run);
  // The oldest snapshot still inside the window is the baseline; a lone first frame has none yet.
  const base = schedRing.find((x) => now - x.at <= RUNQ_WINDOW_MS) ?? schedRing[schedRing.length - 1];
  schedRing.push(cur);
  if (!base || cur.at - base.at < 500) return null;
  const secs = (cur.at - base.at) / 1000;
  const running = (cur.run - base.run) / 1e9 / secs;
  const waiting = (cur.wait - base.wait) / 1e9 / secs;
  return { running, waiting, total: running + waiting, windowSec: Math.round(secs) };
}

let pm2Cache: { at: number; apps: Pm2App[] } | null = null;

const read = (p: string) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

function cpuTimes(): number[][] {
  return read("/proc/stat").split("\n").filter((l) => /^cpu\d* /.test(l)).map((l) => l.trim().split(/\s+/).slice(1).map(Number));
}
const busyPct = (a: number[], b: number[]) => {
  const idle = (x: number[]) => (x[3] ?? 0) + (x[4] ?? 0);
  const total = (x: number[]) => x.slice(0, 8).reduce((s, v) => s + v, 0);
  const dt = total(b) - total(a);
  return dt > 0 ? Math.max(0, Math.min(100, (1 - (idle(b) - idle(a)) / dt) * 100)) : 0;
};

function meminfo() {
  const t = read("/proc/meminfo");
  const kb = (k: string) => Number(t.match(new RegExp(`^${k}:\\s+(\\d+)`, "m"))?.[1] ?? 0);
  const total = kb("MemTotal"), avail = kb("MemAvailable"), st = kb("SwapTotal"), sf = kb("SwapFree");
  return {
    ram: { totalMb: total / 1024, usedMb: (total - avail) / 1024, pct: total ? ((total - avail) / total) * 100 : 0 },
    swap: { totalMb: st / 1024, usedMb: (st - sf) / 1024, pct: st ? ((st - sf) / st) * 100 : 0 },
  };
}

function defaultIface(): string | null {
  const line = read("/proc/net/route").split("\n").find((l) => l.split("\t")[1] === "00000000");
  return line ? line.split("\t")[0] : null;
}
function netBytes(iface: string | null) {
  if (!iface) return null;
  const l = read("/proc/net/dev").split("\n").find((x) => x.trim().startsWith(`${iface}:`));
  if (!l) return null;
  const f = l.split(":")[1].trim().split(/\s+/).map(Number);
  return { rx: f[0], tx: f[8] };
}
/** Sectors read/written on whole disks (not partitions, not md — md would double count). */
function ioSectors() {
  let r = 0, w = 0;
  for (const l of read("/proc/diskstats").split("\n")) {
    const f = l.trim().split(/\s+/);
    if (f.length < 10) continue;
    if (!/^(nvme\d+n\d+|sd[a-z]+|vd[a-z]+)$/.test(f[2])) continue;
    r += Number(f[5]); w += Number(f[9]);
  }
  return { r, w };
}

function temps() {
  let cpuC: number | null = null;
  const disks: Array<{ name: string; c: number }> = [];
  let dirs: string[] = [];
  try { dirs = readdirSync("/sys/class/hwmon"); } catch { /* not Linux */ }
  for (const d of dirs) {
    const name = read(`/sys/class/hwmon/${d}/name`).trim();
    const t = Number(read(`/sys/class/hwmon/${d}/temp1_input`).trim()) / 1000;
    if (!Number.isFinite(t) || t <= 0) continue;
    if (name === "k10temp" || name === "coretemp") cpuC = Math.round(t);
    else if (name === "nvme" || name === "drivetemp") disks.push({ name: `disk${disks.length}`, c: Math.round(t) });
  }
  return { cpuC, disks };
}

async function pm2Apps(): Promise<Pm2App[]> {
  if (pm2Cache && Date.now() - pm2Cache.at < 5000) return pm2Cache.apps;
  try {
    const { stdout } = await execFileP("pm2", ["jlist"], { timeout: 10_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, PM2_SILENT: "true" } });
    const rows = JSON.parse(stdout.slice(Math.max(0, stdout.indexOf("[")))) as Array<{
      name?: string; monit?: { memory?: number; cpu?: number };
      pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number; max_memory_restart?: number | string; cron_restart?: string; autorestart?: boolean; node_args?: string[] | string; env?: Record<string, unknown> };
    }>;
    const heapOf = (e: NonNullable<(typeof rows)[number]["pm2_env"]>) => {
      const args = [String(e.env?.NODE_OPTIONS ?? ""), ...(Array.isArray(e.node_args) ? e.node_args : [String(e.node_args ?? "")])].join(" ");
      const m = args.match(/--max-old-space-size=(\d+)/);
      return m ? Number(m[1]) : null;
    };
    const capOf = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n / 1048576) : null; };
    const apps = rows.filter((r) => r.name).map((r) => ({
      name: r.name as string,
      status: r.pm2_env?.status ?? "unknown",
      memMb: Math.round((r.monit?.memory ?? 0) / 1048576),
      cpu: r.monit?.cpu ?? 0,
      restarts: r.pm2_env?.restart_time ?? 0,
      uptimeMs: r.pm2_env?.status === "online" && r.pm2_env.pm_uptime ? Date.now() - r.pm2_env.pm_uptime : null,
      capMb: capOf(r.pm2_env?.max_memory_restart),
      heapMb: r.pm2_env ? heapOf(r.pm2_env) : null,
      cron: Boolean(r.pm2_env?.cron_restart) && r.pm2_env?.autorestart === false,
    })).sort((a, b) => b.memMb - a.memMb);
    pm2Cache = { at: Date.now(), apps };
    return apps;
  } catch {
    return pm2Cache?.apps ?? [];
  }
}

const LEVEL_OF: Record<string, Light["level"]> = { ok: "ok", warn: "warn", critical: "critical" };

async function lights(frame: Omit<LiveFrame, "lights">): Promise<Light[]> {
  const out: Light[] = [];
  const t = frame.thresholds;
  const band = (pct: number): Light["level"] => (pct >= t.criticalPct ? "critical" : pct >= t.warnPct ? "warn" : "ok");
  out.push({ id: "cpu", label: "CPU", level: band(frame.cpuPct), detail: `${frame.cpuPct.toFixed(0)}% busy across ${frame.cores.length} threads`, panel: "deck" });
  out.push({ id: "ram", label: "RAM", level: band(frame.ram.pct), detail: `${(frame.ram.usedMb / 1024).toFixed(1)} of ${(frame.ram.totalMb / 1024).toFixed(0)} GB in use`, panel: "deck" });
  if (frame.psiMemSome !== null) {
    out.push({ id: "pressure", label: "MEM PRESSURE", level: frame.psiMemSome >= 20 ? "critical" : frame.psiMemSome >= 5 ? "warn" : "ok", detail: `prod stalled ${frame.psiMemSome.toFixed(1)}% (PSI avg10)`, panel: "deck" });
  }
  if (frame.temps.cpuC !== null) {
    out.push({ id: "temp", label: "CPU TEMP", level: frame.temps.cpuC >= 90 ? "critical" : frame.temps.cpuC >= 80 ? "warn" : "ok", detail: `${frame.temps.cpuC} °C`, panel: "deck" });
  }
  const crash = frame.apps.filter((a) => a.status === "errored" || (a.status !== "online" && a.status !== "stopped"));
  out.push({ id: "apps", label: "PM2 APPS", level: crash.length ? "critical" : "ok", detail: crash.length ? `${crash.map((a) => `${a.name} ${a.status}`).join(", ")}` : `${frame.apps.filter((a) => a.status === "online").length} online`, panel: "deck" });

  try {
    const h = await healthStatus();
    for (const f of h?.findings ?? []) {
      out.push({ id: `health-${f.check}`, label: ({ diskFree: "DISK FREE", swap: "SWAP", reboot: "REBOOT", restarts: "RESTARTS", errorLog: "ERROR LOGS", raid: "RAID", disks: "SMART" } as Record<string, string>)[f.check] ?? f.check.toUpperCase(), level: LEVEL_OF[f.level] ?? "ok", detail: f.detail, panel: f.check === "reboot" ? "rcs-maintenance" : "box-usage" });
    }
  } catch { /* health off */ }

  const gov = readGov();
  if (gov.installed) {
    const s = gov.status;
    out.push({
      id: "pool", label: "DEV POOL",
      level: gov.stale ? "warn" : s?.over || (frame.psiWorkshopSome ?? 0) >= 20 ? "warn" : "ok",
      detail: gov.stale ? "governor daemon not reporting" : s?.slice ? `workshop ${(s.slice.usedMb / 1024).toFixed(1)} GB of ${((s.slice.maxMb ?? 0) / 1024).toFixed(0)} GB${s.over ? " — over the trigger" : ""}${frame.psiWorkshopSome !== null && frame.psiWorkshopSome >= 5 ? ` · lanes stalled ${frame.psiWorkshopSome.toFixed(0)}%` : ""}` : "no reading",
      panel: "rcs-gov",
    });
  }

  try {
    const rel = readReleases();
    const failed = rel.filter((r) => r.state === "failed" || r.state === "blocked");
    const busy = rel.filter((r) => r.state === "promoting" || r.state === "building" || r.state === "queued");
    out.push({
      id: "pipeline", label: "PIPELINE",
      level: failed.length ? "critical" : busy.length ? "warn" : "ok",
      detail: failed.length ? `${failed.map((r) => `${r.client} ${r.state}`).join(", ")}` : busy.length ? `${busy.map((r) => `${r.client} ${r.state}`).join(", ")}` : "every app live",
      panel: "pipeline",
    });
  } catch { /* no pipeline files */ }

  const wdb = readWorkshopDb();
  if (wdb.installed) {
    const last = wdb.status?.last;
    const age = wdb.status?.lastSuccessAt ? Date.now() - Date.parse(wdb.status.lastSuccessAt) : Infinity;
    out.push({
      id: "workshop-db", label: "WORKSHOP DB",
      level: last && !last.ok ? "warn" : age > 36 * 3600_000 ? "warn" : "ok",
      detail: last && !last.ok ? `last refresh failed${last.error ? `: ${last.error}` : ""}` : age === Infinity ? "never refreshed" : `refreshed ${Math.round(age / 3600_000)} h ago`,
      panel: "workshop-db",
    });
  }
  return out;
}

export async function liveFrame(): Promise<LiveFrame> {
  const now = Date.now();
  const cpu = cpuTimes();
  const iface = defaultIface();
  const net = netBytes(iface);
  const io = ioSectors();
  const p = prev && now - prev.at < 120_000 ? prev : null;
  const secs = p ? (now - p.at) / 1000 : 0;
  const all = p && cpu[0] && p.cpu[0] ? busyPct(p.cpu[0], cpu[0]) : 0;
  const cores = cpu.slice(1).map((c, i) => (p && p.cpu[i + 1] ? busyPct(p.cpu[i + 1], c) : 0));
  const rxMbps = p && net && p.net && secs > 0 ? ((net.rx - p.net.rx) * 8) / secs / 1e6 : 0;
  const txMbps = p && net && p.net && secs > 0 ? ((net.tx - p.net.tx) * 8) / secs / 1e6 : 0;
  const readMBs = p && p.io && secs > 0 ? ((io.r - p.io.r) * 512) / secs / 1e6 : 0;
  const writeMBs = p && p.io && secs > 0 ? ((io.w - p.io.w) * 512) / secs / 1e6 : 0;
  const ws = workshopUsage();
  // Share of the whole box's CPU (all threads) the workshop used since the last frame.
  const wsCpuPct = p && p.wsCpuUsec !== null && ws.cpuUsec !== null && secs > 0
    ? Math.max(0, Math.min(100, ((ws.cpuUsec - p.wsCpuUsec) / 1e6 / secs / Math.max(1, cpu.length - 1)) * 100))
    : null;
  prev = { at: now, wsCpuUsec: ws.cpuUsec, cpu, net, io };

  const { ram, swap } = meminfo();
  let disk = { totalGb: 0, usedGb: 0, pct: 0 };
  try {
    const s = await statfs("/");
    const total = Number(s.blocks) * Number(s.bsize), free = Number(s.bavail) * Number(s.bsize);
    disk = { totalGb: total / 1e9, usedGb: (total - free) / 1e9, pct: total ? ((total - free) / total) * 100 : 0 };
  } catch { /* not available */ }
  const psi = prodMemPsi();
  const wpsi = workshopMemPsi();
  const cfg = readConfig();
  const gov = readGov();
  const sl = gov.status?.slice;
  const base = {
    at: now,
    host: hostName(),
    uptimeSec: os.uptime(),
    cores,
    cpuPct: all,
    load: os.loadavg() as [number, number, number],
    runq: measuredLoad(now),
    ram, swap, disk,
    psiMemSome: psi ? psi.some10 : null,
    psiWorkshopSome: wpsi ? wpsi.some10 : null,
    workshop: ws.memMb === null ? null : {
      cpuPct: wsCpuPct,
      cpuCapPct: ws.cpuMaxThreads === null ? null : Math.min(100, (ws.cpuMaxThreads / Math.max(1, cpu.length - 1)) * 100),
      memMb: ws.memMb, swapMb: ws.swapMb, swapMaxMb: ws.swapMaxMb,
    },
    temps: temps(),
    net: { iface, rxMbps: Math.max(0, rxMbps), txMbps: Math.max(0, txMbps) },
    io: { readMBs: Math.max(0, readMBs), writeMBs: Math.max(0, writeMBs) },
    apps: await pm2Apps(),
    slice: sl ? { usedMb: sl.usedMb, highMb: sl.highMb, maxMb: sl.maxMb, triggerMb: sl.triggerMb, enabled: !!gov.status && readGovEnabled() } : null,
    thresholds: { warnPct: cfg.warnPct, criticalPct: cfg.criticalPct },
  };
  return { ...base, lights: await lights(base) };
}

function readGovEnabled(): boolean {
  try {
    return JSON.parse(read(`${process.env.RCS_GOV_STATE_DIR || "/var/lib/rcs-gov"}/config.json`)).enabled === true;
  } catch {
    return false;
  }
}
