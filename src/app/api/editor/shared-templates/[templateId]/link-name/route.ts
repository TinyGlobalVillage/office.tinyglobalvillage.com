// PATCH /api/editor/shared-templates/[templateId]/link-name  { linkName }
//
// Renames a template's share link — tinyglobalvillage.com/t/<linkName> — from
// the Template Gallery's right-click "Edit link name". Only the name part is
// editable; the address in front of it is fixed. The name is cleaned the same
// way the gallery's field cleans it (lowercase a-z 0-9 "-"), so "Pebble Brook"
// lands as "pebblebrook".
//
// 400 invalid · 404 no such template · 409 another template has that name.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { setSharedTemplateLinkName } from "@/lib/db-shared-templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ templateId: string }> };

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { templateId } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { linkName?: unknown } | null;
  if (!body || typeof body.linkName !== "string") {
    return NextResponse.json({ error: "linkName is required" }, { status: 400 });
  }

  try {
    const res = await setSharedTemplateLinkName({ templateId, linkName: body.linkName });
    if (res.ok) return NextResponse.json({ template: res.template });
    if (res.reason === "taken") {
      return NextResponse.json({ error: "Another template already uses that name" }, { status: 409 });
    }
    if (res.reason === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Use 2–60 letters, numbers or dashes" },
      { status: 400 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Rename failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
