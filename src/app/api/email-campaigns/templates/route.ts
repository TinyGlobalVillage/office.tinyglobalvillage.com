// Office Modules → Email Campaigns: list/save the SYSTEM (TGV-wide) email templates.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json(await emailCampaigns().list(ctx));
}

export async function PUT(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().save(ctx, body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "save_failed" }, { status: 400 });
  }
}
