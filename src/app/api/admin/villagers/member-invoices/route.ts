// GET /api/admin/villagers/member-invoices?member=<uuid> — every invoice TGV has addressed to one
// villager, plus what's still outstanding and what their wallet could cover.
//
// A PROXY, not a second implementation. tgv.com owns the platform's invoicing (numbering, line
// items, payments, the postings behind them) and already answers this exact question at
// /api/billing/platform; Office asks it through the internal-secret seam rather than re-deriving
// the answer from raw SQL, because two derivations of "what does this person owe" is one more than
// anybody can keep honest.
//
// READ ONLY. There is no pay proxy and there shouldn't be — an operator can look at a villager's
// bills, but settling one spends that villager's tokens, which is theirs to do.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const url = new URL(req.url);
  // `member` is what tgv.com's route reads; `memberId` is accepted too so this matches the naming
  // of its sibling villager routes.
  const member = (url.searchParams.get("member") ?? url.searchParams.get("memberId") ?? "").trim();
  if (!UUID_RE.test(member)) {
    return NextResponse.json({ error: "member must be a uuid" }, { status: 400 });
  }

  try {
    const res = await fetch(`${tgvBase()}/api/billing/platform?member=${encodeURIComponent(member)}`, {
      headers: { "x-internal-secret": secret },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(body, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
