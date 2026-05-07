// POST /api/backups/run-now
// Body: { tier: "tier1" | "tier2" | "tier4" | "restore-test" }
// Spawns the corresponding script as a detached process. Returns immediately.
// Output goes to the script's normal log file.

import { NextResponse } from "next/server";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SCRIPT_BY_TIER: Record<string, string> = {
  tier1: "/srv/refusion-core/utils/scripts/system/backup/backup-tier1.sh",
  tier2: "/srv/refusion-core/utils/scripts/system/backup/backup-tier2.sh",
  tier4: "/srv/refusion-core/utils/scripts/system/backup/backup-tier4.sh",
  "restore-test": "/srv/refusion-core/utils/scripts/system/backup/restore-test-postgres.sh",
};

const LOG_BY_TIER: Record<string, string> = {
  tier1: "/srv/refusion-core/logs/backup/tier1.log",
  tier2: "/srv/refusion-core/logs/backup/tier2.log",
  tier4: "/srv/refusion-core/logs/backup/tier4.log",
  "restore-test": "/srv/refusion-core/logs/backup/restore-test.log",
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tier = body?.tier;

  const script = SCRIPT_BY_TIER[tier];
  const logFile = LOG_BY_TIER[tier];
  if (!script) {
    return NextResponse.json({ error: `Unknown tier: ${tier}` }, { status: 400 });
  }

  // Spawn detached, redirect stdout/stderr to log file
  try {
    const fs = await import("fs");
    const out = fs.openSync(logFile, "a");
    const err = fs.openSync(logFile, "a");
    const child = spawn("/bin/bash", [script], {
      detached: true,
      stdio: ["ignore", out, err],
    });
    child.unref();
    return NextResponse.json({
      tier,
      pid: child.pid,
      logFile,
      message: `Started ${tier} backup. Watch ${logFile} for progress (long-running — may take 10-25 minutes).`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
