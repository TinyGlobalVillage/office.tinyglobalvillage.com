// POST /api/admin/consent/redeem — the admin enters the emailed code to activate the access grant.
// Body: { requestId, code }. Operator-only. villager-dashboard-canon P6.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { memberUserIdForUsername } from "@/lib/member-auth/bridge";
import { db } from "@/lib/db-drizzle";
import { redeemConsentCode } from "@tgv/module-consent/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const adminMemberUserId = await memberUserIdForUsername(gate.username);
  if (!adminMemberUserId)
    return NextResponse.json({ ok: false, error: "no member_users row" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const requestId = String(body.requestId ?? "");
  const code = String(body.code ?? "");
  if (!requestId || !code) return NextResponse.json({ ok: false, error: "requestId + code required" }, { status: 400 });

  try {
    const res = await redeemConsentCode(db as never, { requestId, requesterMemberUserId: adminMemberUserId, code });
    if (!res.ok) return NextResponse.json(res, { status: res.status });
    return NextResponse.json({ ok: true, kind: res.kind });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
