// Audience, by the handful (Gio 2026-09-01): the gear on a CATEGORY header —
// "in the event that all of the email templates under one header are included,
// i can manage them all right there." GET returns the fleet plus EACH requested
// key's own target set; POST writes a whole header's worth back as a map, so
// ticking one tenant across the header never flattens the campaigns under it
// that disagree about the others.
//
// System-scoped by construction: adminCtx yields {scope:"system"}, and the
// module's verbs refuse any other scope.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";

const fail = (e: unknown) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "audience_group_failed" },
    { status: 400 },
  );

export async function GET(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  // Comma-separated: a campaign key is dotted lowercase ASCII, never a comma.
  const keys = (req.nextUrl.searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return NextResponse.json({ error: "keys_required" }, { status: 400 });
  try {
    return NextResponse.json(await emailCampaigns().audienceGroup(ctx, keys));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await emailCampaigns().saveAudienceGroup(ctx, body));
  } catch (e) {
    return fail(e);
  }
}
