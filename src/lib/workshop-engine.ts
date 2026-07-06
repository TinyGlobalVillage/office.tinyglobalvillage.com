// src/lib/workshop-engine.ts
// Thin bridge from Office API routes to the RCS workshop orchestrator
// (utils/scripts/project/workshop/workshop.ts). Admin-gated callers only.
// Short commands (list/down) run and await; `up` is spawned DETACHED (a first
// compile / RCS install can take minutes) — the UI polls list for readiness.
// Mirrors demo-preview-engine.ts so the two features behave identically.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";

const pexec = promisify(execFile);
const ROOT = "/srv/refusion-core";
const TSX = `${ROOT}/node_modules/.bin/tsx`;
const ENGINE = `${ROOT}/utils/scripts/project/workshop/workshop.ts`;
const LOG_DIR = `${ROOT}/logs/workshop`;

const ENV = () => ({ ...process.env, CLAUDE_ALLOW_DESTRUCTIVE: "1" });

/** Run a workshop subcommand and parse its final JSON line. */
export async function engine(args: string[], timeoutMs = 30_000): Promise<any> {
  const { stdout } = await pexec(TSX, [ENGINE, ...args], {
    cwd: ROOT,
    env: ENV(),
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  });
  const last = stdout.trim().split("\n").filter(Boolean).pop() || "{}";
  return JSON.parse(last);
}

/** Fire-and-forget `up` — survives Office restarts (detached + unref). The engine
 *  writes the job record (status:starting) synchronously before the heavy work, so
 *  a GET /api/workshop poll sees the new job immediately. */
export function engineUpDetached(
  pkg: string,
  sites: string[],
  compute: "local" | "rcs",
  account: string,
  worktree?: string,
): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const fd = fs.openSync(`${LOG_DIR}/up.log`, "a");
  const args = [
    ENGINE, "up",
    "--pkg", pkg,
    "--sites", sites.join(","),
    "--compute", compute,
    "--account", account,
    ...(worktree ? ["--worktree", worktree] : []),
  ];
  const child = spawn(TSX, args, { cwd: ROOT, env: ENV(), detached: true, stdio: ["ignore", fd, fd] });
  child.unref();
}

// Defence in depth (execFile already avoids shell interpolation).
export const PKG_RE = /^@tgv\/[a-z0-9][a-z0-9-]*$/;
export const SITE_RE = /^[a-z0-9][a-z0-9.-]*$/;
export const JOB_RE = /^wk-[0-9a-f]{6}$/;
export const WORKTREE_RE = /^\/[A-Za-z0-9._/ -]+$/;
