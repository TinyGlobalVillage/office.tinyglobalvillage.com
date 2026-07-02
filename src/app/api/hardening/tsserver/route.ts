// /api/hardening/tsserver — operator control for the VS Code TypeScript server's memory cap.
//   GET  → { capMb, defaultCapMb, settingsPath, processes[], totalRssMb, audit[] }
//   POST → { capMb?: number } write the cap into VS Code's Machine settings (applies to the
//          NEXT tsserver spawn) · { restart: true } kill running tsserver processes so VS Code
//          respawns them under the current cap (safe — automatic respawn, brief IntelliSense blip).
//
// Why this exists: an uncapped tsserver on this monorepo grows past 2–3 GB and starves
// production `next build`s (7.8 GB box). See diary 2026-07-02. Config-driven paths so the
// same tile works for any user account running Office.
import { type NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const pexec = promisify(execFile);

const SETTINGS_PATH =
  process.env.TSSERVER_GUARD_SETTINGS_PATH ||
  `${process.env.HOME || "/home/admin"}/.vscode-server/data/Machine/settings.json`;
const KEY = "typescript.tsserver.maxTsServerMemory";
const DEFAULT_CAP_MB = 3072; // VS Code's own default when the key is unset
const MIN_MB = 512;
const MAX_MB = 12288;

const DATA_DIR = "/srv/refusion-core/data/tsserver-guard";
const AUDIT = `${DATA_DIR}/audit.log`;

type Proc = { pid: number; rssMb: number; kind: "semantic" | "partial" };

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await readFile(SETTINGS_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function listTsservers(): Promise<Proc[]> {
  try {
    const { stdout } = await pexec("bash", ["-lc", "ps -eo pid,rss,args | grep 'tsserver[.]js' | grep -v grep"]);
    return stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        const m = l.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/);
        if (!m) return null;
        return {
          pid: parseInt(m[1], 10),
          rssMb: Math.round(parseInt(m[2], 10) / 1024),
          kind: m[3].includes("partialSemantic") ? ("partial" as const) : ("semantic" as const),
        };
      })
      .filter((p): p is Proc => !!p);
  } catch {
    return [];
  }
}

async function audit(entry: Record<string, unknown>): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true }).catch(() => {});
  await writeFile(AUDIT, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n", { flag: "a" }).catch(() => {});
}

async function tailAudit(n = 40): Promise<Array<Record<string, unknown>>> {
  try {
    const txt = await readFile(AUDIT, "utf8");
    return txt.trim().split("\n").filter(Boolean).slice(-n).reverse().map((l) => {
      try { return JSON.parse(l); } catch { return { event: l }; }
    });
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const [settings, processes, auditRows] = await Promise.all([readSettings(), listTsservers(), tailAudit()]);
  const raw = settings[KEY];
  const capMb = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  return NextResponse.json({
    ok: true,
    capMb,
    defaultCapMb: DEFAULT_CAP_MB,
    settingsPath: SETTINGS_PATH,
    processes,
    totalRssMb: processes.reduce((a, p) => a + p.rssMb, 0),
    audit: auditRows,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { capMb?: number; restart?: boolean };

  if (typeof body.capMb === "number") {
    const capMb = Math.round(body.capMb);
    if (!Number.isFinite(capMb) || capMb < MIN_MB || capMb > MAX_MB) {
      return NextResponse.json({ error: `capMb must be ${MIN_MB}–${MAX_MB}` }, { status: 400 });
    }
    const settings = await readSettings();
    const prev = settings[KEY] ?? null;
    settings[KEY] = capMb;
    await mkdir(SETTINGS_PATH.replace(/\/[^/]+$/, ""), { recursive: true }).catch(() => {});
    await writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
    await audit({ event: "cap_change", from: prev, to: capMb, by: auth.username });
    return NextResponse.json({ ok: true, capMb });
  }

  if (body.restart === true) {
    const procs = await listTsservers();
    let killed = 0;
    for (const p of procs) {
      try { process.kill(p.pid, "SIGTERM"); killed++; } catch { /* already gone / not ours */ }
    }
    await audit({ event: "restart", killed, by: auth.username });
    return NextResponse.json({ ok: true, killed });
  }

  return NextResponse.json({ error: "Provide capMb or restart:true" }, { status: 400 });
}
