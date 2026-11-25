/**
 * Memory pressure (PSI) by scope. The host-wide /proc/pressure/memory counts EVERY stalled task,
 * so a workshop slice squeezed by its own MemoryHigh reads 99% there while prod is untouched
 * (2026-11-25). Prod health reads system.slice (pm2, Postgres, nginx); the workshop's own stall is
 * read from its slice and shown on the DEV POOL light. Falls back to the host file. Never throws.
 */
import "server-only";
import { readFileSync } from "fs";

export type Psi = { some10: number; some60: number; full60: number };

const CG = "/sys/fs/cgroup";
export const PROD_CGROUP = process.env.HOST_METRICS_PROD_CGROUP || "system.slice";
export const WORKSHOP_CGROUP = process.env.HOST_METRICS_WORKSHOP_CGROUP || "tgv.slice/tgv-workshop.slice";

function parse(text: string): Psi | null {
  const grab = (k: string, w: string) => {
    const m = text.match(new RegExp(`^${k} .*?${w}=([\\d.]+)`, "m"));
    return m ? Number(m[1]) : null;
  };
  const some10 = grab("some", "avg10"), some60 = grab("some", "avg60"), full60 = grab("full", "avg60");
  return some10 === null || some60 === null || full60 === null ? null : { some10, some60, full60 };
}

function readFile(p: string): Psi | null {
  try { return parse(readFileSync(p, "utf8")); } catch { return null; }
}

/** Pressure on prod services; host-wide only when the cgroup can't be read. */
export function prodMemPsi(): Psi | null {
  return readFile(`${CG}/${PROD_CGROUP}/memory.pressure`) ?? readFile("/proc/pressure/memory");
}

/** Pressure inside the workshop slice (lanes, builds, dev servers). Null when there's no slice. */
export function workshopMemPsi(): Psi | null {
  return readFile(`${CG}/${WORKSHOP_CGROUP}/memory.pressure`);
}

/** Workshop slice's own usage: memory, swap and cumulative CPU time. Null fields when unreadable. */
export function workshopUsage(): { memMb: number | null; swapMb: number | null; swapMaxMb: number | null; cpuUsec: number | null; cpuMaxThreads: number | null } {
  const rd = (f: string) => { try { return readFileSync(`${CG}/${WORKSHOP_CGROUP}/${f}`, "utf8").trim(); } catch { return null; } };
  const mb = (v: string | null) => (v === null || v === "max" || !/^\d+$/.test(v) ? null : Number(v) / 1048576);
  const cpu = rd("cpu.stat")?.match(/^usage_usec (\d+)/m);
  // cpu.max = "<quota> <period>" (or "max <period>"): quota/period = how many threads' worth it may use.
  const q = rd("cpu.max")?.match(/^(\d+) (\d+)$/);
  return {
    memMb: mb(rd("memory.current")), swapMb: mb(rd("memory.swap.current")), swapMaxMb: mb(rd("memory.swap.max")),
    cpuUsec: cpu ? Number(cpu[1]) : null, cpuMaxThreads: q ? Number(q[1]) / Number(q[2]) : null,
  };
}
