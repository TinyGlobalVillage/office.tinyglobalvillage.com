// src/lib/demo-preview-engine.ts
// Thin bridge from Office API routes to the RCS demo-preview provisioning engine
// (utils/scripts/project/demo-preview/demo-preview.ts). Admin-gated callers only.
// Short commands (status/down/heartbeat/catalog) run and await; `up` is spawned
// DETACHED (install+build can take minutes) — the UI polls status for readiness.
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";

const pexec = promisify(execFile);
const ROOT = "/srv/refusion-core";
const TSX = `${ROOT}/node_modules/.bin/tsx`;
const ENGINE = `${ROOT}/utils/scripts/project/demo-preview/demo-preview.ts`;
const LOG_DIR = `${ROOT}/logs/demo-preview`;

const ENV = () => ({ ...process.env, CLAUDE_ALLOW_DESTRUCTIVE: "1" });

/** Run an engine subcommand and parse its final JSON line. */
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

/** Fire-and-forget `up` — survives Office restarts (detached + setsid). */
export function engineUpDetached(pkg: string, tenant: string, account: string): void {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const fd = fs.openSync(`${LOG_DIR}/up.log`, "a");
  const child = spawn(
    TSX,
    [ENGINE, "up", "--pkg", pkg, "--tenant", tenant, "--account", account],
    { cwd: ROOT, env: ENV(), detached: true, stdio: ["ignore", fd, fd] },
  );
  child.unref();
}

// Reject anything that isn't a plausible package / tenant id (defence in depth;
// execFile already avoids shell interpolation).
export const PKG_RE = /^@tgv\/[a-z0-9][a-z0-9-]*$/;
export const TENANT_RE = /^[a-z0-9][a-z0-9.-]*$/;
export const ID_RE = /^demo-[1-8]-[0-9a-f]{6}$/;
