// Workshop DB refresh — the Office side of utils/scripts/build-pipeline/workshop-db-refresh.sh.
//
// The script (root, systemd) keeps the workshop Postgres a masked copy of prod. It
// shares a state dir with Office (owned by the pm2 user):
//   config.json  what to copy, when, and whose contacts to keep  — Office writes
//   status.json  current/last run, per-database results         — script writes
//   request      its existence starts a run (systemd .path unit) — Office writes
// Office never runs the refresh itself, so it needs no root and no prod DB rights.
// The dir is an env var so another box/workshop can point Office at its own.
import fs from "node:fs";
import path from "node:path";

export const STATE_DIR = process.env.WORKSHOP_DB_STATE_DIR || "/var/lib/tgv-workshop-db";
const CONFIG = () => path.join(STATE_DIR, "config.json");
const STATUS = () => path.join(STATE_DIR, "status.json");
const REQUEST = () => path.join(STATE_DIR, "request");

export type WorkshopDbConfig = {
  enabled: boolean;
  /** "HH:MM", the box's local time (Pacific on RCS2). */
  time: string;
  databases: string[];
  keepDomains: string[];
  keepEmails: string[];
};

export type WorkshopDbResult = { db: string; ok: boolean; bytes?: number; seconds?: number; error?: string | null };
export type WorkshopDbRun = {
  startedAt: string;
  finishedAt?: string;
  reason: string;
  ok: boolean;
  error?: string | null;
  log?: string;
  results: WorkshopDbResult[];
};
export type WorkshopDbStatus = {
  state: "idle" | "running";
  current?: { startedAt: string; reason: string; db?: string; log?: string };
  last?: WorkshopDbRun;
  runs?: WorkshopDbRun[];
  lastSuccessAt?: string;
  nextRunAt?: string | null;
};

export const DEFAULTS: WorkshopDbConfig = {
  enabled: true,
  time: "04:00",
  databases: ["tgv_db", "tgv_demo", "demo_seed", "demo_control", "refusionist_db", "stepcenter", "giocoelho_db"],
  keepDomains: ["tinyglobalvillage.com", "refusionist.com", "giocoelho.com"],
  keepEmails: [],
};

const DB_NAME = /^[a-z_][a-z0-9_]{0,62}$/;
const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const EMAIL = /^[^@\s,]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const strList = (v: unknown, ok: RegExp, max: number): string[] | null =>
  Array.isArray(v)
    ? [...new Set(v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter((x) => ok.test(x)))].slice(0, max)
    : null;

/** Coerce anything into a valid config: bad fields fall back to the current value. */
export function coerce(raw: unknown, base: WorkshopDbConfig = DEFAULTS): WorkshopDbConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // fliring is off-limits (PROJECT-STATUS.md) — never copied, whatever is asked.
  const dbs = strList(o.databases, DB_NAME, 30)?.filter((d) => !d.includes("fliring"));
  return {
    enabled: typeof o.enabled === "boolean" ? o.enabled : base.enabled,
    time: typeof o.time === "string" && TIME.test(o.time) ? o.time : base.time,
    databases: dbs && dbs.length ? dbs : base.databases,
    keepDomains: strList(o.keepDomains, DOMAIN, 50) ?? base.keepDomains,
    keepEmails: strList(o.keepEmails, EMAIL, 200) ?? base.keepEmails,
  };
}

export function readConfig(): WorkshopDbConfig {
  try {
    return coerce(JSON.parse(fs.readFileSync(CONFIG(), "utf8")));
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeConfig(patch: Partial<WorkshopDbConfig>): WorkshopDbConfig {
  const next = coerce({ ...readConfig(), ...patch }, readConfig());
  const tmp = `${CONFIG()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n", { mode: 0o660 });
  fs.renameSync(tmp, CONFIG());
  return next;
}

export function readStatus(): { status: WorkshopDbStatus | null; installed: boolean; requested: boolean } {
  const installed = fs.existsSync(STATE_DIR);
  let status: WorkshopDbStatus | null = null;
  try {
    status = JSON.parse(fs.readFileSync(STATUS(), "utf8"));
  } catch {
    /* not run yet */
  }
  return { status, installed, requested: fs.existsSync(REQUEST()) };
}

/** Ask the box for a run now; the systemd .path unit picks it up within a second. */
export function requestRun(user: string): void {
  fs.writeFileSync(REQUEST(), JSON.stringify({ user, at: new Date().toISOString() }) + "\n", { mode: 0o660 });
}
