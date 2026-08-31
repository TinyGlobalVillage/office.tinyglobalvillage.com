// The shared draft layer: PUT saves it (published model untouched), DELETE discards it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function PUT(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().saveDraft(ctx, body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "draft_save_failed" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });
  try {
    return NextResponse.json(await emailCampaigns().deleteDraft(ctx, key));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "draft_delete_failed" }, { status: 400 });
  }
}
