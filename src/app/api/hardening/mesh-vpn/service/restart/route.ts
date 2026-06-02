// POST /api/hardening/mesh-vpn/service/restart
//
// Restarts the Headscale systemd unit. Requires admin. Audit-logged on both
// success and failure. Error messages are sanitized so we don't leak the
// full systemctl stderr (which can include unit paths, PIDs, etc.) to the
// browser.

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

const execFileP = promisify(execFile);

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    await execFileP("sudo", ["-n", "systemctl", "restart", "headscale"], {
      timeout: 15_000,
    });
    logHardeningAction({
      action: "mesh-vpn.service.restart",
      target: "headscale",
      user: auth.username,
      success: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: number; signal?: string };
    logHardeningAction({
      action: "mesh-vpn.service.restart",
      target: "headscale",
      user: auth.username,
      success: false,
      details: { exitCode: err.code ?? null, signal: err.signal ?? null },
    });
    return NextResponse.json(
      { error: "Failed to restart headscale service" },
      { status: 500 },
    );
  }
}
