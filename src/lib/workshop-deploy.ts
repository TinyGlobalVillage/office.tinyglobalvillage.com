// workshop-deploy — "build on Mac, ship to RCS" dispatch for the Office deploy button.
// A deploy is spawned DETACHED (a build takes minutes; the Utils tile polls the status
// file), mirroring workshop-engine.ts's engineUpDetached. The heavy lifting lives in the
// RCS-side bash orchestrator utils/scripts/build-pipeline/deploy-dispatch.sh, which resolves
// a build target from build-targets.json (Mac first, RCS only as a guarded last resort).
import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as crypto from "node:crypto";

const ROOT = "/srv/refusion-core";
const DEPLOY_DIR = `${ROOT}/data/workshop/deploys`;
const DISPATCH = `${ROOT}/utils/scripts/build-pipeline/deploy-dispatch.sh`;
const LOG_DIR = `${ROOT}/logs/workshop`;
const TARGETS = `${ROOT}/data/workshop/build-targets.json`;

// Same shape as workshop-engine SITE_RE — no shell metachars, no path separators.
export const SITE_RE = /^[a-z0-9][a-z0-9.-]*$/;

export type DeployState = {
  jobId: string;
  client: string;
  startedBy: string;
  state: ReleaseState;
  phase: string;
  detail?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
};

export type BuildTarget = { name: string; sshAlias: string; wsRoot?: string; note?: string };
export type BuildTargetsConfig = {
  _comment?: string;
  targets: BuildTarget[];
  lastResort: "rcs" | false;
  reachTimeoutSec?: number;
};

const jobFile = (client: string) => `${DEPLOY_DIR}/${client}.json`;

/** Latest deploy status for one client (null if never deployed via Office). */
export function readDeploy(client: string): DeployState | null {
  try {
    return JSON.parse(fs.readFileSync(jobFile(client), "utf8")) as DeployState;
  } catch {
    return null;
  }
}

/** Latest deploy status for many clients (for the Utils tile grid). */
export function readDeploys(clients: string[]): Record<string, DeployState | null> {
  const out: Record<string, DeployState | null> = {};
  for (const c of clients) out[c] = readDeploy(c);
  return out;
}

/** Is a deploy currently in flight for this client? */
export function isDeploying(client: string): boolean {
  const d = readDeploy(client);
  return !!d && (d.state === "resolving" || d.state === "building");
}

/** Read the ordered build-target config (for the modal / resolver display). */
export function readBuildTargets(): BuildTargetsConfig {
  try {
    return JSON.parse(fs.readFileSync(TARGETS, "utf8")) as BuildTargetsConfig;
  } catch {
    return { targets: [], lastResort: "rcs", reachTimeoutSec: 5 };
  }
}

export function writeBuildTargets(cfg: BuildTargetsConfig): void {
  fs.writeFileSync(TARGETS, JSON.stringify(cfg, null, 2));
}

/**
 * Kick off a deploy (detached, survives Office restarts). Seeds the status file
 * synchronously so the first poll sees "resolving", then spawns the dispatcher.
 * Returns the jobId. Throws if a deploy is already in flight for this client.
 */
export function startDeploy(client: string, startedBy: string): string {
  if (!SITE_RE.test(client)) throw new Error("invalid client name");
  if (isDeploying(client)) throw new Error(`a deploy is already in flight for ${client}`);
  const jobId = "dp-" + crypto.randomBytes(3).toString("hex");
  const now = new Date().toISOString();
  mergeStatus(client, { jobId, startedBy, state: "resolving", phase: "queued", startedAt: now, finishedAt: null });
  spawnDetached([DISPATCH, client, jobFile(client), startedBy]);
  return jobId;
}

// ---------------------------------------------------------------------------
// Release flow (deploy-watcher, 2026-10-28). The Mac's deploy-watch.sh stages a
// build on RCS (.next.incoming) whenever main moves; Office promotes it (swap +
// pm2 restart + smoke + auto-rollback) or rolls back to .next.prev. Both run
// rcs-promote.sh right here on RCS — promote builds nothing, so it needs no
// Mac and works while the Mac sleeps. Status: data/workshop/deploys/<c>.json,
// merge-written by deploy-watch (Mac, over ssh), rcs-promote and this file.
// ---------------------------------------------------------------------------
const PROMOTE = `${ROOT}/utils/scripts/build-pipeline/rcs-promote.sh`;
const WATCH_CFG = `${ROOT}/data/workshop/deploy-watch.json`;
const WATCHER_HB = `${DEPLOY_DIR}/_watcher.json`;
export const SHA_RE = /^[0-9a-f]{40}$/;

export type ReleaseState =
  | "idle" | "debouncing" | "queued" | "building" | "staged" | "stale"
  | "promoting" | "live" | "rolled_back" | "failed" | "blocked"
  | "resolving" | "done"; // the last two: the legacy "Build now" job

export type Stamp = { mono: string | null; client: string | null; upstream: string | null; at: string | null; host: string | null; run?: string | null };
export type Smoke = { ok: boolean; code: string; secs: number; at: string; url: string };
export type Rollback = { at: string; by: string; from: Stamp | null; to: Stamp | null };
export type ReleaseStatus = {
  client: string;
  follows: string | null;
  state: ReleaseState | null;
  phase: string | null;
  updatedAt: string | null;
  main: { mono: string; client: string; at: string } | null;
  live: Stamp | null;
  staged: Stamp | null;
  prev: Stamp | null;
  smoke: Smoke | null;
  lastRollback: Rollback | null;
  lastError: string | null;
  promoteBy: string | null;
  log: string | null;
};
export type WatcherConfig = {
  enabled: boolean;
  pollSec: number;
  debounceSec: number;
  maxBuildsPerHour: number;
  smokeTimeoutSec: number;
  targets: string[];
  follow: Record<string, string[]>;
  updatedBy?: string;
  updatedAt?: string;
};
export type WatcherHealth = { online: boolean; host: string | null; at: string | null; enabled: boolean | null; pollSec: number | null };

export const WATCHER_DEFAULTS: WatcherConfig = {
  enabled: true, pollSec: 30, debounceSec: 60, maxBuildsPerHour: 6, smokeTimeoutSec: 60,
  targets: ["tinyglobalvillage.com", "office.tinyglobalvillage.com"],
  follow: { "tinyglobalvillage.com": ["demo-hq"] },
};

const clamp = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n) : d;
};

/** Sanitize a watcher config (values reach a shell on the Mac). */
export function sanitizeWatcherConfig(c: Partial<WatcherConfig> | null | undefined): WatcherConfig {
  const d = WATCHER_DEFAULTS;
  const targets = Array.isArray(c?.targets) ? [...new Set(c!.targets.filter((t) => typeof t === "string" && SITE_RE.test(t)))] : d.targets;
  const follow: Record<string, string[]> = {};
  const src = c?.follow && typeof c.follow === "object" ? c.follow : d.follow;
  for (const t of targets) {
    const f = Array.isArray(src[t]) ? src[t].filter((x) => typeof x === "string" && SITE_RE.test(x) && x !== t && !targets.includes(x)) : [];
    if (f.length) follow[t] = [...new Set(f)];
  }
  return {
    enabled: c?.enabled !== false,
    pollSec: clamp(c?.pollSec, d.pollSec, 10, 3600),
    debounceSec: clamp(c?.debounceSec, d.debounceSec, 0, 3600),
    maxBuildsPerHour: clamp(c?.maxBuildsPerHour, d.maxBuildsPerHour, 1, 30),
    smokeTimeoutSec: clamp(c?.smokeTimeoutSec, d.smokeTimeoutSec, 10, 600),
    targets,
    follow,
    updatedBy: c?.updatedBy,
    updatedAt: c?.updatedAt,
  };
}

export function readWatcherConfig(): WatcherConfig {
  try { return sanitizeWatcherConfig(JSON.parse(fs.readFileSync(WATCH_CFG, "utf8"))); }
  catch { return { ...WATCHER_DEFAULTS }; }
}

export function writeWatcherConfig(cfg: WatcherConfig): void {
  fs.mkdirSync(`${ROOT}/data/workshop`, { recursive: true });
  const tmp = `${WATCH_CFG}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2) + "\n");
  fs.renameSync(tmp, WATCH_CFG);
}

/** The watcher is online when its heartbeat (or a client status write) is fresh. */
export function readWatcherHealth(): WatcherHealth {
  let hb: { host?: string; at?: string; enabled?: boolean; pollSec?: number } = {};
  try { hb = JSON.parse(fs.readFileSync(WATCHER_HB, "utf8")); } catch { /* none yet */ }
  let at = hb.at ?? null;
  let host = hb.host ?? null;
  // A per-client status write carries watcher.lastPollAt too — take the freshest.
  for (const c of readWatcherConfig().targets) {
    const w = (readStatusFile(c).watcher ?? {}) as { lastPollAt?: string; host?: string };
    if (w.lastPollAt && (!at || w.lastPollAt > at)) { at = w.lastPollAt; host = w.host ?? host; }
  }
  const poll = typeof hb.pollSec === "number" ? hb.pollSec : readWatcherConfig().pollSec;
  const online = !!at && Date.now() - Date.parse(at) < Math.max(180, poll * 3 + 120) * 1000;
  return { online, host, at, enabled: typeof hb.enabled === "boolean" ? hb.enabled : null, pollSec: poll };
}

function readStatusFile(client: string): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(jobFile(client), "utf8")); } catch { return {}; }
}

/** Merge-write the status file (the same file deploy-dispatch / rcs-promote / deploy-watch write). */
export function mergeStatus(client: string, patch: Record<string, unknown>): void {
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  const j = { ...readStatusFile(client), ...patch, client, updatedAt: new Date().toISOString() };
  const tmp = `${jobFile(client)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(j, null, 2));
  fs.renameSync(tmp, jobFile(client));
}

/** DEPLOY_STAMP of one build slot — null unless the slot holds a complete build. */
export function readStamp(client: string, slot: ".next" | ".next.incoming" | ".next.prev"): Stamp | null {
  const dir = `${ROOT}/clients/${client}/${slot}`;
  if (!fs.existsSync(`${dir}/BUILD_ID`)) return null;
  let txt = "";
  try { txt = fs.readFileSync(`${dir}/DEPLOY_STAMP`, "utf8"); } catch { /* pre-stamp build */ }
  const get = (k: string) => txt.match(new RegExp(`^${k}=(.*)$`, "m"))?.[1]?.trim() || null;
  let at = get("at");
  if (!at) { try { at = fs.statSync(`${dir}/BUILD_ID`).mtime.toISOString(); } catch { /* */ } }
  return { mono: get("mono"), client: get("client"), upstream: get("upstream"), at, host: get("host"), run: get("run") };
}

/** The release targets in display order: each target, then whoever follows it. */
export function releaseTargets(): Array<{ client: string; follows: string | null }> {
  const cfg = readWatcherConfig();
  const out: Array<{ client: string; follows: string | null }> = [];
  for (const t of cfg.targets) {
    out.push({ client: t, follows: null });
    for (const f of cfg.follow[t] ?? []) out.push({ client: f, follows: t });
  }
  return out;
}

export function readRelease(client: string, follows: string | null = null): ReleaseStatus {
  const j = readStatusFile(client) as Record<string, any>;
  return {
    client,
    follows,
    state: (j.state as ReleaseState) ?? null,
    phase: j.phase ?? null,
    updatedAt: j.updatedAt ?? null,
    main: j.main && typeof j.main === "object" ? j.main : null,
    live: readStamp(client, ".next"),
    staged: readStamp(client, ".next.incoming"),
    prev: readStamp(client, ".next.prev"),
    smoke: j.smoke ?? null,
    lastRollback: j.lastRollback ?? null,
    lastError: j.lastError ?? null,
    promoteBy: j.promoteBy ?? null,
    log: j.log ?? null,
  };
}

export function readReleases(): ReleaseStatus[] {
  return releaseTargets().map((t) => readRelease(t.client, t.follows));
}

const busy = (s: ReleaseState | null) => s === "promoting" || s === "resolving";

/**
 * Promote the staged build. `expect` pins the exact build the operator saw on
 * the tile: rcs-promote refuses (exit 4) if .next.incoming changed since.
 */
export function startPromote(client: string, by: string, expect: { mono: string; client?: string | null }): void {
  if (!SITE_RE.test(client)) throw new Error("invalid client name");
  if (!SHA_RE.test(expect.mono) || (expect.client && !SHA_RE.test(expect.client))) throw new Error("bad sha");
  const r = readRelease(client);
  if (busy(r.state)) throw new Error(`${client} is already ${r.state}`);
  if (!r.staged) throw new Error("nothing staged");
  if (r.staged.mono !== expect.mono || (expect.client && r.staged.client !== expect.client)) {
    throw new Error("the staged build changed — refresh and look again");
  }
  mergeStatus(client, { state: "promoting", phase: "starting", promoteBy: by, lastError: null });
  const args = [PROMOTE, client, "--by", safeBy(by), "--expect-mono", expect.mono,
    "--smoke-timeout", String(readWatcherConfig().smokeTimeoutSec)];
  if (expect.client) args.push("--expect-client", expect.client);
  spawnDetached(args, "promote.log");
}

/** Swap .next ⇄ .next.prev (smoke-checked; restores what was serving on failure). */
export function startRollback(client: string, by: string): void {
  if (!SITE_RE.test(client)) throw new Error("invalid client name");
  const r = readRelease(client);
  if (busy(r.state)) throw new Error(`${client} is already ${r.state}`);
  if (!r.prev) throw new Error("no previous build to roll back to");
  mergeStatus(client, { state: "promoting", phase: "rolling back", promoteBy: by, lastError: null });
  spawnDetached([PROMOTE, client, "--rollback", "--by", safeBy(by),
    "--smoke-timeout", String(readWatcherConfig().smokeTimeoutSec)], "promote.log");
}

const safeBy = (u: string) => (u || "office").replace(/[^A-Za-z0-9@._-]/g, "").slice(0, 64) || "office";

/**
 * setsid -f: the child forks into its own session and is reparented to init,
 * so a `pm2 restart office.tinyglobalvillage.com` (which tree-kills Office's
 * descendants) cannot kill a promote of Office itself halfway through.
 */
function spawnDetached(args: string[], logName = "deploy.log"): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const fd = fs.openSync(`${LOG_DIR}/${logName}`, "a");
  const child = spawn("setsid", ["-f", "bash", ...args], {
    cwd: ROOT,
    env: { ...process.env, REFUSION_ROOT: ROOT },
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  fs.closeSync(fd);
}
