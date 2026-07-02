// POST /api/admin/villagers/charge-card?env=test|live
//   body: { memberId, paymentMethodId, amountCents, description?, nonce? }
//
// Office operator → tgv.com PLATFORM off-session charge (/api/platform/charge). Mirrors the
// managed-proxy seam (requireAdmin + INTERNAL_API_SECRET + x-operator-actor-id) but targets the
// PLATFORM charge endpoint, NOT /api/connect/managed/charge (that's for Connect/tenant charges).
// Office holds no Stripe keys; tgv.com is the authoritative boundary that re-validates everything
// (uuids, the $1,000 ceiling, the consent gate) and writes the audit row attributed to the operator.
import "server-only";
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

  const env = new URL(req.url).searchParams.get("env") === "test" ? "test" : "live";

  const url = new URL(`${tgvBase()}/api/platform/charge`);
  url.searchParams.set("env", env);

  const body = await req.text();
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-operator-actor-id": actorId,
      },
      cache: "no-store",
      body,
    });
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
