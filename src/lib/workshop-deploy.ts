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
  state: "resolving" | "building" | "done" | "failed";
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
  fs.mkdirSync(DEPLOY_DIR, { recursive: true });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const jobId = "dp-" + crypto.randomBytes(3).toString("hex");
  const now = new Date().toISOString();
  fs.writeFileSync(
    jobFile(client),
    JSON.stringify({ jobId, client, startedBy, state: "resolving", phase: "queued", startedAt: now, updatedAt: now }, null, 2),
  );
  const fd = fs.openSync(`${LOG_DIR}/deploy.log`, "a");
  const child = spawn("bash", [DISPATCH, client, jobFile(client), startedBy], {
    cwd: ROOT,
    env: { ...process.env },
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  return jobId;
}
