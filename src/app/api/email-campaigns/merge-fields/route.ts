// Merge-fields registry (Gio 2026-08-31): the ONE vocabulary every {{token}}
// surface reads. GET lists it; POST upserts a field (system key → label/sample
// override; new key → custom static field); PATCH renames a custom key;
// DELETE resets a system key to stock / removes a custom field. All writes are
// system-scoped — adminCtx gates them.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "merge_fields_failed" }, { status: 400 });

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json(await emailCampaigns().mergeFields());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().saveMergeField(ctx, body));
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().renameMergeField(ctx, body));
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
  try {
    return NextResponse.json(await emailCampaigns().deleteMergeField(ctx, key));
  } catch (e) {
    return fail(e);
  }
}
