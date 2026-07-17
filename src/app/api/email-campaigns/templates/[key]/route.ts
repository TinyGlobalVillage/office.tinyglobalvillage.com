export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

export async function GET(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const { key } = await params;
  return NextResponse.json(await emailCampaigns().get(ctx, key));
}
