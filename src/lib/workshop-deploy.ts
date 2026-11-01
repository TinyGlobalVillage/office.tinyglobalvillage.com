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
/** One migration file the staged build would apply (rcs-migrate.sh --plan). */
export type PendingMigration = {
  file: string; sha256: string; destructive: boolean; approved: boolean;
  statements: string[]; databases: string[];
};
export type MigrationRun = { at: string; by: string; result: { applied?: number; failed?: { file: string; db: string } }; log: string };
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
  pendingMigrations: PendingMigration[];
  migrations: MigrationRun | null;
  liveTag: string | null;
  request: PromoteRequest | null;
};
/**
 * A durable "deploy" (utils/scripts/build-pipeline/deploy-request.sh, 2026-11-01): filed by
 * `mac-deploy --promote --wait` when main is not staged yet; fulfilled by that waiter or, once
 * it is gone, by deploy-watch; expires after requestTtlMin; cancellable here.
 */
export type PromoteRequest = {
  client: string;
  status: "waiting" | "promoting" | "done" | "failed" | "expired" | "cancelled";
  by: string[];
  at: string;
  expiresAt: string;
  ttlMin: number;
  wantMono: string | null;
  wantClient: string | null;
  pid: number | null;
  host: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  finishedAt?: string | null;
  finishedBy?: string | null;
  note?: string | null;
};
export type WatcherConfig = {
  enabled: boolean;
  pollSec: number;
  debounceSec: number;
  maxBuildsPerHour: number;
  smokeTimeoutSec: number;
  /** A queued "deploy" (deploy-request.sh) expires after this many minutes, with an alert. */
  requestTtlMin: number;
  targets: string[];
  follow: Record<string, string[]>;
  /** The self-closing "go direct" route (direct-route-rcs.sh reads this block). */
  directRoute: DirectRouteConfig;
  /** Pipeline alerts (pipeline-alerts.ts, Office's sampler tick). */
  alerts: PipelineAlertConfig;
  updatedBy?: string;
  updatedAt?: string;
};
export type DirectRouteConfig = {
  /** Close this long after opening, whatever else is going on (enforced on RCS by cron). */
  hardCapMin: number;
  /** Close once the builds that used it are done. */
  closeWhenIdle: boolean;
  /** Close when the Mac's public IP moves (the rule would open to a stranger). */
  closeOnIpChange: boolean;
  idleGraceSec: number;
  /** Opened but never used → close after this long. */
  unusedMin: number;
  /** No heartbeat from the Mac for this long → close (enforced on RCS). */
  silentMin: number;
};
export type PipelineAlertConfig = {
  enabled: boolean;
  frontDesk: boolean;
  email: boolean;
  recipients: string[];
  /** A deploy blocked this long raises an alert (Gio 2026-11-01: 10). */
  blockedMin: number;
  /** Repeat while it still holds. */
  reminderMin: number;
  /** The watcher's heartbeat this stale raises an alert. */
  offlineMin: number;
  /** Tell the team when the mesh is policed and the direct route is closed. */
  linkAlerts: boolean;
};
export type WatcherHealth = { online: boolean; host: string | null; at: string | null; enabled: boolean | null; pollSec: number | null };

export const WATCHER_DEFAULTS: WatcherConfig = {
  enabled: true, pollSec: 30, debounceSec: 60, maxBuildsPerHour: 6, smokeTimeoutSec: 60, requestTtlMin: 30,
  targets: ["tinyglobalvillage.com", "office.tinyglobalvillage.com"],
  follow: { "tinyglobalvillage.com": ["demo-hq"] },
  directRoute: { hardCapMin: 120, closeWhenIdle: true, closeOnIpChange: true, idleGraceSec: 60, unusedMin: 15, silentMin: 15 },
  alerts: {
    enabled: true, frontDesk: true, email: true, recipients: ["admin@tinyglobalvillage.com"],
    blockedMin: 10, reminderMin: 60, offlineMin: 10, linkAlerts: true,
  },
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    requestTtlMin: clamp(c?.requestTtlMin, d.requestTtlMin, 5, 240),
    targets,
    follow,
    directRoute: sanitizeDirectRoute(c?.directRoute),
    alerts: sanitizeAlerts(c?.alerts),
    updatedBy: c?.updatedBy,
    updatedAt: c?.updatedAt,
  };
}

function sanitizeDirectRoute(c: Partial<DirectRouteConfig> | null | undefined): DirectRouteConfig {
  const d = WATCHER_DEFAULTS.directRoute;
  return {
    hardCapMin: clamp(c?.hardCapMin, d.hardCapMin, 10, 240),
    closeWhenIdle: c?.closeWhenIdle !== false,
    closeOnIpChange: c?.closeOnIpChange !== false,
    idleGraceSec: clamp(c?.idleGraceSec, d.idleGraceSec, 0, 1800),
    unusedMin: clamp(c?.unusedMin, d.unusedMin, 2, 120),
    silentMin: clamp(c?.silentMin, d.silentMin, 3, 120),
  };
}

function sanitizeAlerts(c: Partial<PipelineAlertConfig> | null | undefined): PipelineAlertConfig {
  const d = WATCHER_DEFAULTS.alerts;
  const recipients = Array.isArray(c?.recipients)
    ? [...new Set(c!.recipients.filter((r): r is string => typeof r === "string").map((r) => r.trim().toLowerCase()).filter((r) => EMAIL_RE.test(r)))].slice(0, 20)
    : [...d.recipients];
  return {
    enabled: c?.enabled !== false,
    frontDesk: c?.frontDesk !== false,
    email: c?.email !== false,
    recipients,
    blockedMin: clamp(c?.blockedMin, d.blockedMin, 1, 240),
    reminderMin: clamp(c?.reminderMin, d.reminderMin, 10, 1440),
    offlineMin: clamp(c?.offlineMin, d.offlineMin, 3, 240),
    linkAlerts: c?.linkAlerts !== false,
  };
}

export function readWatcherConfig(): WatcherConfig {
  try { return sanitizeWatcherConfig(JSON.parse(fs.readFileSync(WATCH_CFG, "utf8"))); }
  catch { return sanitizeWatcherConfig(WATCHER_DEFAULTS); }
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
    pendingMigrations: Array.isArray(j.pendingMigrations) ? j.pendingMigrations : [],
    migrations: j.migrations && typeof j.migrations === "object" ? j.migrations : null,
    liveTag: typeof j.liveTag === "string" ? j.liveTag : null,
    request: readPromoteRequest(client),
  };
}

// ---------------------------------------------------------------------------
// Durable deploy requests (pipeline control, 2026-11-01). The file is written by
// deploy-request.sh under a mkdir lock; Office takes the same lock to cancel.
// ---------------------------------------------------------------------------
const requestFile = (client: string) => `${DEPLOY_DIR}/${client}.promote-request.json`;
const REQUEST_HISTORY = `${DEPLOY_DIR}/promote-requests.jsonl`;

/** The client's request while it is open (waiting/promoting) or closed within the last day. */
export function readPromoteRequest(client: string): PromoteRequest | null {
  if (!SITE_RE.test(client)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(requestFile(client), "utf8")) as PromoteRequest;
    if (!j || typeof j.status !== "string") return null;
    // Past its expiresAt but still "waiting": nobody has closed it yet (deploy-watch closes
    // it from its heartbeat; a Mac that is off never will). Close it here, so the history
    // line — and the expiry alert that reads it — land on time either way.
    if (j.status === "waiting" && Date.parse(j.expiresAt) <= Date.now()) return expirePromoteRequest(client) ?? j;
    if (j.status === "waiting" || j.status === "promoting") return j;
    const fin = Date.parse(j.finishedAt ?? "");
    return Number.isFinite(fin) && Date.now() - fin < 86_400_000 ? j : null;
  } catch { return null; }
}

/** Request history, newest first (the jsonl deploy-request.sh appends every final state to). */
export function readPromoteRequestHistory(limit = 50): PromoteRequest[] {
  try {
    const lines = fs.readFileSync(REQUEST_HISTORY, "utf8").trim().split("\n").slice(-limit);
    return lines.map((l) => { try { return JSON.parse(l) as PromoteRequest; } catch { return null; } })
      .filter((x): x is PromoteRequest => !!x).reverse();
  } catch { return []; }
}

function withRequestLock<T>(client: string, fn: () => T): T {
  const lock = `${DEPLOY_DIR}/.${client}.request.lock`;
  for (let i = 0; i < 50; i++) {
    try {
      fs.mkdirSync(lock);
      try { return fn(); } finally { try { fs.rmdirSync(lock); } catch { /* */ } }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(lock).mtimeMs > 30_000) fs.rmdirSync(lock); } catch { /* */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  throw new Error("the request lock is busy — try again");
}

/** Close a WAITING request that is past its expiresAt, as deploy-request.sh would. */
function expirePromoteRequest(client: string): PromoteRequest | null {
  try {
    return withRequestLock(client, () => {
      const j = JSON.parse(fs.readFileSync(requestFile(client), "utf8")) as PromoteRequest;
      if (j.status !== "waiting" || !(Date.parse(j.expiresAt) <= Date.now())) return j;
      Object.assign(j, { status: "expired", finishedAt: new Date().toISOString(), finishedBy: "office", note: "not promoted before it expired" });
      const tmp = `${requestFile(client)}.tmp${process.pid}`;
      fs.writeFileSync(tmp, JSON.stringify(j, null, 2));
      fs.renameSync(tmp, requestFile(client));
      fs.appendFileSync(REQUEST_HISTORY, JSON.stringify({ ...j, client }) + "\n");
      return j;
    });
  } catch { return null; }
}

/** Cancel a WAITING request. A promoting one is already running and cannot be called back. */
export function cancelPromoteRequest(client: string, by: string): PromoteRequest {
  if (!SITE_RE.test(client)) throw new Error("invalid client name");
  return withRequestLock(client, () => {
    let j: PromoteRequest;
    try { j = JSON.parse(fs.readFileSync(requestFile(client), "utf8")); } catch { throw new Error("no deploy request for this client"); }
    if (j.status === "promoting") throw new Error("already promoting — it can no longer be cancelled");
    if (j.status !== "waiting") throw new Error(`the request is already ${j.status}`);
    const now = new Date().toISOString();
    Object.assign(j, { status: "cancelled", finishedAt: now, finishedBy: safeBy(by), note: "cancelled from Office" });
    const tmp = `${requestFile(client)}.tmp${process.pid}`;
    fs.writeFileSync(tmp, JSON.stringify(j, null, 2));
    fs.renameSync(tmp, requestFile(client));
    fs.appendFileSync(REQUEST_HISTORY, JSON.stringify({ ...j, client }) + "\n");
    return j;
  });
}

// ---------------------------------------------------------------------------
// Migration approval (Decision 1, 2026-10-31). rcs-migrate.sh applies additive
// files on its own; a DESTRUCTIVE one (DROP TABLE/COLUMN/SCHEMA/TYPE, ALTER …
// DROP/TYPE, TRUNCATE) waits until its exact sha256 is in this file. Approving
// is a superadmin act on the tile, logged like a promote. The sha is what gets
// approved, not the name: a file edited after approval is unapproved again.
// ---------------------------------------------------------------------------
const approvalFile = (client: string) => `${DEPLOY_DIR}/${client}.migrations-approved.json`;
export type MigrationApprovals = { files: Record<string, string>; by?: string; at?: string; history?: Array<{ file: string; sha256: string; by: string; at: string }> };
const MIG_FILE_RE = /^(manual\/)?[A-Za-z0-9][A-Za-z0-9._-]*\.sql$/;
const SHA256_RE = /^[0-9a-f]{64}$/;

export function readMigrationApprovals(client: string): MigrationApprovals {
  try {
    const j = JSON.parse(fs.readFileSync(approvalFile(client), "utf8"));
    return { files: j.files && typeof j.files === "object" ? j.files : {}, by: j.by, at: j.at, history: Array.isArray(j.history) ? j.history : [] };
  } catch { return { files: {}, history: [] }; }
}

/**
 * Approve the destructive migrations the staged build is waiting on. Only
 * files the status file currently lists as pending+destructive are accepted,
 * each with the sha the operator saw — so an approval can never reach a file
 * that was not on the tile.
 */
export function approveMigrations(client: string, by: string, files: Array<{ file: string; sha256: string }>): string[] {
  if (!SITE_RE.test(client)) throw new Error("invalid client name");
  const pending = readRelease(client).pendingMigrations.filter((p) => p.destructive);
  const ok: string[] = [];
  const cur = readMigrationApprovals(client);
  const now = new Date().toISOString();
  for (const f of files) {
    if (!MIG_FILE_RE.test(f.file) || !SHA256_RE.test(f.sha256)) continue;
    const p = pending.find((x) => x.file === f.file && x.sha256 === f.sha256);
    if (!p) continue;
    cur.files[f.file] = f.sha256;
    (cur.history ??= []).push({ file: f.file, sha256: f.sha256, by: safeBy(by), at: now });
    ok.push(f.file);
  }
  if (!ok.length) throw new Error("nothing to approve — the staged plan changed, refresh and look again");
  cur.by = safeBy(by); cur.at = now;
  cur.history = cur.history!.slice(-200);
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  const tmp = `${approvalFile(client)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cur, null, 2) + "\n");
  fs.renameSync(tmp, approvalFile(client));
  // reflect it on the tile without waiting for the next --accept / promote
  const st = readStatusFile(client) as Record<string, any>;
  if (Array.isArray(st.pendingMigrations)) {
    mergeStatus(client, {
      pendingMigrations: st.pendingMigrations.map((p: PendingMigration) => (ok.includes(p.file) ? { ...p, approved: true } : p)),
      ...(st.state === "blocked" ? { state: "staged", phase: "staged — migrations approved, waiting for deploy" } : {}),
    });
  }
  return ok;
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

// ---------------------------------------------------------------------------
// Pipeline board (pipeline control, 2026-11-01). One read of everything that
// decides whether a "deploy" will happen: the watcher, each client's state and
// blocker, queued requests, the direct route, and the Mac's own half (shipped
// by deploy-watch inside _watcher.json → `mac`, see pipeline-snapshot.sh).
// ---------------------------------------------------------------------------
const DIRECT_FILE = `${ROOT}/data/workshop/direct-route.json`;
const DIRECT_HISTORY = `${ROOT}/data/workshop/direct-route.jsonl`;
const DIRECT_LOCK = `${ROOT}/data/workshop/.direct-route.lock`;

export type DirectLease = { host: string; pid: number; label: string; at: string };
export type DirectRoute = {
  open: boolean;
  ip: string | null;
  port: number | null;
  by: string | null;
  host: string | null;
  openedAt: string | null;
  closeBy: string | null;
  adopted: boolean;
  rule: string | null;
  leases: DirectLease[];
  everLeased: boolean;
  idleSince: string | null;
  heartbeatAt: string | null;
  currentIp: string | null;
  closeRequested: { by: string; at: string } | null;
  closedAt: string | null;
  closeWhy: string | null;
  closedBy: string | null;
  updatedAt: string | null;
};
export type DirectRouteEvent = { at: string; event: "open" | "reopen" | "close"; ip: string | null; by?: string | null; why?: string; host?: string; openMin?: number; adopted?: boolean };

/** The direct route as RCS last wrote it (null: never opened). */
export function readDirectRoute(): DirectRoute | null {
  try {
    const j = JSON.parse(fs.readFileSync(DIRECT_FILE, "utf8")) as Partial<DirectRoute>;
    return {
      open: j.open === true, ip: j.ip ?? null, port: typeof j.port === "number" ? j.port : null, by: j.by ?? null, host: j.host ?? null,
      openedAt: j.openedAt ?? null, closeBy: j.closeBy ?? null, adopted: j.adopted === true, rule: j.rule ?? null,
      leases: Array.isArray(j.leases) ? j.leases : [], everLeased: j.everLeased === true, idleSince: j.idleSince ?? null,
      heartbeatAt: j.heartbeatAt ?? null, currentIp: j.currentIp ?? null,
      closeRequested: j.closeRequested && typeof j.closeRequested === "object" ? j.closeRequested : null,
      closedAt: j.closedAt ?? null, closeWhy: j.closeWhy ?? null, closedBy: j.closedBy ?? null, updatedAt: j.updatedAt ?? null,
    };
  } catch { return null; }
}

/** Open/close history, newest first. */
export function readDirectRouteHistory(limit = 30): DirectRouteEvent[] {
  return readJsonl<DirectRouteEvent>(DIRECT_HISTORY, limit).reverse();
}

/** Every jsonl line, oldest first, the last `limit` of them. */
export function readJsonl<T>(file: string, limit = 500): T[] {
  try {
    return fs.readFileSync(file, "utf8").trim().split("\n").slice(-limit)
      .map((l) => { try { return JSON.parse(l) as T; } catch { return null; } })
      .filter((x): x is T => !!x);
  } catch { return []; }
}
export const PIPELINE_FILES = { directHistory: DIRECT_HISTORY, requestHistory: REQUEST_HISTORY };

/**
 * Office's Close button. Office cannot touch UFW, so it marks the request and the
 * RCS reaper (cron, every minute, `direct-route-rcs.sh reap`) deletes the rule —
 * the same lock the shell side takes, so the two never write over each other.
 */
export function requestDirectClose(by: string): DirectRoute {
  for (let i = 0; i < 80; i++) {
    try {
      fs.mkdirSync(DIRECT_LOCK);
      try {
        const cur = JSON.parse(fs.readFileSync(DIRECT_FILE, "utf8")) as Record<string, unknown>;
        if (cur.open !== true) throw new Error("the direct route is already closed");
        if (!cur.closeRequested) {
          const now = new Date().toISOString();
          Object.assign(cur, { closeRequested: { by: safeBy(by), at: now }, updatedAt: now });
          const tmp = `${DIRECT_FILE}.tmp${process.pid}`;
          fs.writeFileSync(tmp, JSON.stringify(cur, null, 2));
          fs.renameSync(tmp, DIRECT_FILE);
        }
        return readDirectRoute()!;
      } finally { try { fs.rmdirSync(DIRECT_LOCK); } catch { /* */ } }
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOENT") throw new Error("the direct route has never been opened");
      if (code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(DIRECT_LOCK).mtimeMs > 60_000) fs.rmdirSync(DIRECT_LOCK); } catch { /* */ }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw new Error("the direct-route lock is busy — try again");
}

/** The blocker deploy-watch records on a blocked client (deploy-watch.sh `block`). */
export type Blocker = {
  kind: "off-main" | "dirty" | "fetch" | "unpushed" | "ff" | string;
  repo: string;
  branch?: string;
  files?: string[];
  commits?: Array<{ sha: string; at: string; subject: string }>;
};
export type MacCheckout = { repo: string; branch: string; dirty: string[]; unpushed: Array<{ sha: string; at: string; subject: string }> };
export type LinkVerdict = "ok" | "mesh-throttled" | "mesh-down" | "network-bad";
export type MacSnapshot = {
  at: string;
  host: string;
  checkouts: MacCheckout[];
  buildLock: { label: string; pid: number | null; ageSec: number; alive: boolean } | null;
  queue: Array<{ label: string; pid: number; waitingSec: number; turnSec: number | null }>;
  running: Array<{ pid: number; elapsed: string; cmd: string; lane: string | null }>;
  memory: { pressure: string; availGb: number; swapUsedGb: number; sessions: Array<{ lane: string; gb: number }> } | null;
  link: { at: string; ageSec?: number; verdict: LinkVerdict; why: string; mesh: { loss: number; avgMs: number | null }; direct: { loss: number; avgMs: number | null } } | null;
};
export type PipelineClient = {
  client: string;
  follows: string | null;
  state: ReleaseState | null;
  phase: string | null;
  updatedAt: string | null;
  blocked: Blocker | null;
  blockedSince: string | null;
  request: PromoteRequest | null;
  liveMono: string | null;
  stagedMono: string | null;
  mainMono: string | null;
};
export type Pipeline = {
  at: string;
  health: WatcherHealth;
  mac: MacSnapshot | null;
  clients: PipelineClient[];
  directRoute: DirectRoute | null;
  directHistory: DirectRouteEvent[];
  requestHistory: PromoteRequest[];
  config: WatcherConfig;
};

export function readMacSnapshot(): MacSnapshot | null {
  try {
    const m = (JSON.parse(fs.readFileSync(WATCHER_HB, "utf8")) as { mac?: MacSnapshot | null }).mac;
    return m && typeof m === "object" && Array.isArray(m.checkouts) ? m : null;
  } catch { return null; }
}

export function readPipeline(): Pipeline {
  const clients = releaseTargets().map(({ client, follows }): PipelineClient => {
    const j = readStatusFile(client) as Record<string, any>;
    const b = j.blocked && typeof j.blocked === "object" ? (j.blocked as Blocker) : null;
    return {
      client, follows,
      state: (j.state as ReleaseState) ?? null,
      phase: j.phase ?? null,
      updatedAt: j.updatedAt ?? null,
      blocked: j.state === "blocked" ? b : null,
      blockedSince: j.state === "blocked" && typeof j.blockedSince === "string" ? j.blockedSince : null,
      request: readPromoteRequest(client),
      liveMono: readStamp(client, ".next")?.mono ?? null,
      stagedMono: readStamp(client, ".next.incoming")?.mono ?? null,
      mainMono: j.main?.mono ?? null,
    };
  });
  return {
    at: new Date().toISOString(),
    health: readWatcherHealth(),
    mac: readMacSnapshot(),
    clients,
    directRoute: readDirectRoute(),
    directHistory: readDirectRouteHistory(20),
    requestHistory: readPromoteRequestHistory(20),
    config: readWatcherConfig(),
  };
}
