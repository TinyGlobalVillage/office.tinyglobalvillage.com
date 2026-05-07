// POST /api/backups/toggle-cron
// Body: { active: boolean }
// Renames /etc/cron.d/rcs-backups{,.disabled} to enable/disable nightly cron.
// Requires sudoers entry: admin ALL=(root) NOPASSWD: /bin/mv /etc/cron.d/rcs-backups*

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pexec = promisify(exec);

const ACTIVE_PATH = "/etc/cron.d/rcs-backups";
const DISABLED_PATH = "/etc/cron.d/rcs-backups.disabled";

async function exists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const target = body?.active === true;

  const activeNow = await exists(ACTIVE_PATH);
  const disabledNow = await exists(DISABLED_PATH);

  if (!activeNow && !disabledNow) {
    return NextResponse.json({ error: "Neither cron file exists — backup pipeline not installed" }, { status: 500 });
  }

  if (target && activeNow) return NextResponse.json({ active: true, changed: false });
  if (!target && disabledNow) return NextResponse.json({ active: false, changed: false });

  const from = target ? DISABLED_PATH : ACTIVE_PATH;
  const to = target ? ACTIVE_PATH : DISABLED_PATH;

  try {
    await pexec(`sudo -n /bin/mv ${from} ${to}`, { timeout: 5000 });
    return NextResponse.json({ active: target, changed: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
