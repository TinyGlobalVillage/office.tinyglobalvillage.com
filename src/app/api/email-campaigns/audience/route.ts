// Audience (Gio 2026-09-01): WHICH tenants a system campaign is published to —
// the panel behind Publish's dropdown half. GET returns the fleet plus this
// campaign's current target set; POST replaces that set wholesale (null = the
// whole fleet, including tenants added later; [] = nobody yet).
//
// System-scoped by construction: adminCtx yields {scope:"system"}, and the
// module's verbs refuse any other scope.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

const fail = (e: unknown) =>
  NextResponse.json({ error: e instanceof Error ? e.message : "audience_failed" }, { status: 400 });

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
  try {
    return NextResponse.json(await emailCampaigns().audience(ctx, key));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().saveAudience(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
