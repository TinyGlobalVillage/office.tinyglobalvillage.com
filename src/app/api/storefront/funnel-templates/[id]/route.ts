// One platform-canon funnel template: edit it, or delete it.
//
// PATCH is three-valued on `audience`, matching the email audience exactly:
// absent leaves it alone (so a Save of the SHAPE never silently republishes),
// null means the whole fleet now and as it grows, an array narrows it.
//
// Both verbs are `seller_site_id IS NULL` inside the module, so neither can reach
// a tenant's own template even with a borrowed id.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import {
  updateCanonFunnelTemplate,
  deleteCanonFunnelTemplate,
} from "@tgv/module-storefront/server/funnels";
import type { FunnelTemplateInput } from "@tgv/module-storefront/types";
import { funnelDb, adminOnly, fail } from "@/lib/storefront/canon-funnels";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const gate = await adminOnly(req);
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch: Partial<FunnelTemplateInput> = {};
  if (typeof body.name === "string") patch.name = body.name;
  if ("description" in body) patch.description = body.description ?? null;
  if (Array.isArray(body.stages)) patch.stages = body.stages;
  if (body.status === "active" || body.status === "archived") patch.status = body.status;
  // "in body" is the whole point: an absent key must NOT be read as null.
  if ("audience" in body) {
    patch.audience = Array.isArray(body.audience) ? body.audience.map(String) : null;
  }
  try {
    const template = await updateCanonFunnelTemplate(funnelDb, id, patch);
    if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ template });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const gate = await adminOnly(req);
  if (gate instanceof NextResponse) return gate;
  const { id } = await params;
  try {
    const ok = await deleteCanonFunnelTemplate(funnelDb, id);
    if (!ok) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
