// Targeted kill-switch: flips `enabled` only — never touches the published model.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().setEnabled(ctx, body));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "enabled_failed" }, { status: 400 });
  }
}
