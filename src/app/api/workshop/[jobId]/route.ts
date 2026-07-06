// src/app/api/workshop/[jobId]/route.ts
// DELETE → stop a workshop job (all its servers + vhosts removed; worktree/branch
// kept). Admin-only. This is the same teardown the chat's "stop workshop" calls, so
// Stop is bidirectional: either surface stops it, the other reflects it on next poll.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { engine, JOB_RE } from "@/lib/workshop-engine";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const { jobId } = await ctx.params;
  if (!JOB_RE.test(jobId)) {
    return NextResponse.json({ ok: false, error: "invalid jobId" }, { status: 400 });
  }
  try {
    const res = await engine(["down", "--job", jobId], 90_000);
    logHardeningAction({ action: "workshop.down", target: jobId, user: auth.username, success: !!res.ok });
    return NextResponse.json(res, { status: res.ok ? 200 : 404 });
  } catch (e) {
    logHardeningAction({ action: "workshop.down", target: jobId, user: auth.username, success: false, details: String(e) });
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
