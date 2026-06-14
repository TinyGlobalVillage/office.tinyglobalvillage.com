// PATCH /api/editor/shared-templates/[templateId]/status
//
// Body: { status: 'sandbox' | 'published' }
//
// Flips a shared_templates row between sandbox/published. Stamps
// published_at when promoting to published. Admin-only; writes the same
// tgv_db row that TGV.com's /api/user/editor/shared-templates/[id]/status
// writes, so either app can drive the workflow.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  setSharedTemplateStatus,
  type SharedTemplateStatus,
} from "@/lib/db-shared-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

function isStatus(v: unknown): v is SharedTemplateStatus {
  return v === "sandbox" || v === "published";
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { status?: unknown };

  if (!isStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be 'sandbox' or 'published'" },
      { status: 400 },
    );
  }

  try {
    const template = await setSharedTemplateStatus({
      templateId,
      status: body.status,
    });
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status change failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
