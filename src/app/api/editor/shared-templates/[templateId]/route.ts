// GET /api/editor/shared-templates/[templateId]
// PATCH /api/editor/shared-templates/[templateId]
// DELETE /api/editor/shared-templates/[templateId]
//
// GET: returns the full template row including the PageModel JSON. Used
// by the Library surface's Page Templates section to render a preview /
// metadata panel.
//
// PATCH: workshop edits. Body accepts any subset of:
//   { label, description, category, thumbnail, suggestedSlug,
//     suggestedTitle, model }
// Status transitions go through the dedicated /status route so the two
// concerns stay separated (edit vs publish).
//
// DELETE: soft delete (stamps deleted_at). Backs the Template Gallery's
// Delete action, which is always behind a confirm modal.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  getSharedTemplate,
  patchSharedTemplate,
  softDeleteSharedTemplate,
  type SharedTemplatePatch,
} from "@/lib/db-shared-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  try {
    const template = await getSharedTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Fetch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

const PATCH_FIELDS = [
  "label",
  "description",
  "category",
  "thumbnail",
  "suggestedSlug",
  "suggestedTitle",
  "model",
] as const;

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: SharedTemplatePatch = {};
  for (const k of PATCH_FIELDS) {
    if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Empty patch" }, { status: 400 });
  }

  try {
    const template = await patchSharedTemplate({ templateId, patch });
    if (!template) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Patch failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  try {
    const deleted = await softDeleteSharedTemplate(templateId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
