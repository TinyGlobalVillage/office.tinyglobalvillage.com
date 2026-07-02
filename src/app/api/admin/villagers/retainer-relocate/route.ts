// POST /api/admin/villagers/retainer-relocate — proxy a member's retainer → available|cash MOVE to
// tgv.com's relocate engine (advisory-locked, audited, balance-conserving, idempotent on moveId).
//
//   POST { memberId, amountTokens, target:'available'|'cash', moveId, env? }
//
// Office never touches the ledger — the move runs on tgv.com via the internal-secret (operator-auth)
// seam, attributed to the operator's legacy users.id. Operator-only (requireAdmin).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as
    | { memberId?: string; amountTokens?: number; target?: string; moveId?: string; env?: string }
    | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const env = body.env === "test" ? "test" : "live";

  // Forward only what tgv.com's relocate route reads; it re-validates everything (uuid, target,
  // positive int) and is the authoritative boundary.
  const forward = {
    memberId: body.memberId,
    amountTokens: body.amountTokens,
    target: body.target,
    moveId: body.moveId,
  };

  try {
    const res = await fetch(`${tgvBase()}/api/wallet/retainer/relocate?env=${env}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-operator-actor-id": actorId,
      },
      body: JSON.stringify(forward),
      cache: "no-store",
    });
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
