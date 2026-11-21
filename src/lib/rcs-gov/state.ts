// Dev Server Pool — the Office side of rcs-gov (mono utils/scripts/build-pipeline/rcs-gov.py).
//
// rcs-gov is a root systemd daemon on RCS2 that lets the workshop's dev servers share one memory
// pool: each lean-dev server gets a big heap ceiling + a guaranteed floor, and when the
// tgv-workshop.slice passes the trigger the daemon restarts the IDLE ones (never one that served a
// request in the last 10 min). It shares a state dir with Office (owned by the pm2 user):
//   config.json  switch + thresholds — Office writes; the daemon re-reads every 15 s
//   status.json  slice usage + every dev server — the daemon writes every tick
//   log.jsonl    every action the daemon takes
// Office never signals a process or touches a cgroup itself, so it needs no root.
// The dir is an env var so another box can point Office at its own governor.
import fs from "node:fs";
import path from "node:path";

export const STATE_DIR = process.env.RCS_GOV_STATE_DIR || "/var/lib/rcs-gov";
const CONFIG = () => path.join(STATE_DIR, "config.json");
const STATUS = () => path.join(STATE_DIR, "status.json");
const LOG = () => path.join(STATE_DIR, "log.jsonl");

import { coerce, DEFAULTS, type RcsGovConfig, type RcsGovLogLine, type RcsGovStatus } from "./config";

export * from "./config";

export function readConfig(): RcsGovConfig {
  try {
    return coerce(JSON.parse(fs.readFileSync(CONFIG(), "utf8")));
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(patch: Partial<RcsGovConfig>): RcsGovConfig {
  const cur = readConfig();
  const next = coerce({ ...cur, ...patch }, cur);
  const tmp = `${CONFIG()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", { mode: 0o664 });
  fs.renameSync(tmp, CONFIG());
  return next;
}

/** `stale` = the daemon hasn't written for over a minute (it ticks every 15 s). */
export function readStatus(): { status: RcsGovStatus | null; installed: boolean; stale: boolean } {
  const installed = fs.existsSync(STATE_DIR);
  let status: RcsGovStatus | null = null;
  try {
    status = JSON.parse(fs.readFileSync(STATUS(), "utf8"));
  } catch {
    /* daemon not run yet */
  }
  const stale = !status || Date.now() / 1000 - (status.t || 0) > 60;
  return { status, installed, stale };
}

/** Newest-first tail of the daemon's action log. Reads only the last 256 KB. */
export function readLog(limit = 100): RcsGovLogLine[] {
  let text = "";
  try {
    const fd = fs.openSync(LOG(), "r");
    try {
      const size = fs.fstatSync(fd).size;
      const len = Math.min(size, 256 * 1024);
      const buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, size - len);
      text = buf.toString("utf8");
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return [];
  }
  const out: RcsGovLogLine[] = [];
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    try {
      const j = JSON.parse(lines[i]);
      if (j && typeof j.t === "number") out.push(j);
    } catch {
      /* partial first line of the window */
    }
  }
  return out;
}
