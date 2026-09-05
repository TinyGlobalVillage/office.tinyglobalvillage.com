// Where {{key}} is spoken across saved templates — the evidence shown before a
// custom field's rename/delete (the templates keep the old token verbatim).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
  try {
    return NextResponse.json(await emailCampaigns().mergeFieldUsage(ctx, key));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "usage_failed" }, { status: 400 });
  }
}
