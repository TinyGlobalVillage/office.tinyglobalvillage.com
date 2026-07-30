// POST /api/editor/shared-templates/[templateId]/review
//   { decision: 'accept' | 'decline', rewardTokens?: number }
//
// Office review actions PROXY to TGV's internal route (x-internal-secret) so
// the status flip + token grant + member alert live in ONE implementation
// (tgv src/lib/templates/review.ts) — the same single-writer discipline as
// the wallet/support/managed proxies. Office never touches the token ledger
// or notifications tables directly.

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });
  }

  const { templateId } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    decision?: string;
    rewardTokens?: number;
  };
  if (body.decision !== "accept" && body.decision !== "decline") {
    return NextResponse.json({ error: "decision must be accept|decline" }, { status: 400 });
  }

  const res = await fetch(`${tgvBase()}/api/internal/template-review`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": secret },
    cache: "no-store",
    body: JSON.stringify({
      templateId,
      decision: body.decision,
      rewardTokens: body.rewardTokens,
      actorId: "office",
    }),
  }).catch(() => null);

  if (!res) return NextResponse.json({ error: "TGV unreachable" }, { status: 502 });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
