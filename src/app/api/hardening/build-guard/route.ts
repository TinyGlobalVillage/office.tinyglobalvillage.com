// /api/hardening/build-guard — operator control for build concurrency (System Hardening).
//   GET  → { mode, autoRevertOnCrash, sessions, watchdogInstalled, audit[] }
//   POST → { mode: "serial" | "multi", autoRevertOnCrash? } → write config + audit
// The parallel-safety PreToolUse hook reads this config: serial (default) blocks concurrent
// next build/install; multi allows it + the build-guard-watchdog cron auto-reverts on OOM/crash.
import { type NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pexec = promisify(execFile);
const BG_DIR = "/srv/refusion-core/data/build-guard";
const CFG = `${BG_DIR}/build-guard-config.json`;
const AUDIT = `${BG_DIR}/audit.log`;

type Mode = "serial" | "multi";
type Config = { mode: Mode; autoRevertOnCrash: boolean; updatedBy: string; updatedAt: string; note?: string };

async function readConfig(): Promise<Config> {
  try {
    const c = JSON.parse(await readFile(CFG, "utf8"));
    return { mode: c.mode === "multi" ? "multi" : "serial", autoRevertOnCrash: c.autoRevertOnCrash !== false, updatedBy: c.updatedBy ?? "system", updatedAt: c.updatedAt ?? "", note: c.note };
  } catch {
    return { mode: "serial", autoRevertOnCrash: true, updatedBy: "system", updatedAt: "" };
  }
}

async function tailAudit(n = 40): Promise<Array<{ ts?: string; event?: string; reason?: string; sessions?: number; by?: string }>> {
  try {
    const txt = await readFile(AUDIT, "utf8");
    return txt.trim().split("\n").filter(Boolean).slice(-n).reverse().map((l) => {
      try { return JSON.parse(l); } catch { return { event: l }; }
    });
  } catch { return []; }
}

async function countSessions(): Promise<number> {
  try {
    const { stdout } = await pexec("bash", ["-lc", "ps -eo args 2>/dev/null | grep -cE '[/]claude --'"]);
    return Math.max(0, parseInt(stdout.trim(), 10) || 0);
  } catch { return 0; }
}

async function watchdogInstalled(): Promise<boolean> {
  try { const { stdout } = await pexec("bash", ["-lc", "crontab -l 2>/dev/null | grep -c build-guard-watchdog"]); return (parseInt(stdout.trim(), 10) || 0) > 0; }
  catch { return false; }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const [cfg, audit, sessions, wd] = await Promise.all([readConfig(), tailAudit(), countSessions(), watchdogInstalled()]);
  return NextResponse.json({ ok: true, ...cfg, sessions, watchdogInstalled: wd, audit });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { mode?: string; autoRevertOnCrash?: boolean };
  const mode: Mode = body.mode === "multi" ? "multi" : "serial";
  const prev = await readConfig();
  const next: Config = {
    mode,
    autoRevertOnCrash: typeof body.autoRevertOnCrash === "boolean" ? body.autoRevertOnCrash : prev.autoRevertOnCrash,
    updatedBy: auth.username,
    updatedAt: new Date().toISOString(),
    note: prev.note,
  };
  await mkdir(BG_DIR, { recursive: true }).catch(() => {});
  await writeFile(CFG, JSON.stringify(next, null, 2) + "\n", "utf8");
  await writeFile(
    AUDIT,
    JSON.stringify({ ts: next.updatedAt, event: "mode_change", to: mode, by: auth.username }) + "\n",
    { flag: "a" },
  ).catch(() => {});
  return NextResponse.json({ ok: true, ...next });
}
