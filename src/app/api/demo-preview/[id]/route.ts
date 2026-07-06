// src/app/api/demo-preview/[id]/route.ts
// DELETE → stop a preview (server + vhost removed; worktree/branch kept). Admin-only.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { engine, ID_RE } from "@/lib/demo-preview-engine";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }
  try {
    const res = await engine(["down", "--id", id], 60_000);
    logHardeningAction({ action: "demo-mode.down", target: id, user: auth.username, success: !!res.ok });
    return NextResponse.json(res, { status: res.ok ? 200 : 404 });
  } catch (e) {
    logHardeningAction({ action: "demo-mode.down", target: id, user: auth.username, success: false, details: String(e) });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
