export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { emailCampaigns, adminCtx } from "@/lib/email-campaigns/deps";
import { rateLimit } from "@/lib/rate-limit";

// Audit S2 #12 (sibling of the member route's #11): this admin-gated route delivered
// operator-authored HTML to ANY address from the platform's DKIM-aligned From — an
// authenticated open relay. The recipient is now forced to the operator's OWN roster
// email (resolved in adminCtx → testRecipient; the shared testSend fails closed if it's
// absent), and the route is rate-limited per operator.
export async function POST(req: NextRequest) {
  const ctx = await adminCtx(req);
  if (ctx instanceof NextResponse) return ctx;

  // No roster email → nothing a test could safely be delivered to.
  if (!ctx.testRecipient) {
    return NextResponse.json({ error: "no_operator_email" }, { status: 403 });
  }

  const rl = rateLimit(`email-test-send:${ctx.username ?? "unknown"}`, 10, 60 * 60 * 1000); // 10/h
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const body = await req.json().catch(() => ({}));
  // Force `to` to the operator's own email (also enforced by the module); keeps the
  // input valid even if the client omits `to`.
  const safeBody = { ...(body as Record<string, unknown>), to: ctx.testRecipient };
  try {
    return NextResponse.json(await emailCampaigns().testSend(ctx, safeBody));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "test_send_failed" }, { status: 400 });
  }
}
