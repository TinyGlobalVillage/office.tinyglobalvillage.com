// DELETE /api/hardening/mesh-vpn/devices/[id]
//
// Revokes (deletes) a Headscale node by numeric id. The id is validated as a
// positive integer BEFORE shelling out — `headscale nodes delete -i` accepts
// only integer node ids, but we belt-and-suspenders this since execFile would
// otherwise pass any string through safely (no shell interpolation).

import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";

const execFileP = promisify(execFile);

function isPositiveInteger(s: string): boolean {
  return /^[1-9][0-9]*$/.test(s);
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!isPositiveInteger(id)) {
    return NextResponse.json(
      { error: "Invalid device id" },
      { status: 400 },
    );
  }

  try {
    await execFileP(
      "headscale",
      ["nodes", "delete", "-i", id, "--force"],
      { timeout: 10_000 },
    );
    logHardeningAction({
      action: "mesh-vpn.device.revoke",
      target: id,
      user: auth.username,
      success: true,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: number; signal?: string };
    logHardeningAction({
      action: "mesh-vpn.device.revoke",
      target: id,
      user: auth.username,
      success: false,
      details: { exitCode: err.code ?? null, signal: err.signal ?? null },
    });
    return NextResponse.json(
      { error: "Failed to revoke device" },
      { status: 500 },
    );
  }
}
