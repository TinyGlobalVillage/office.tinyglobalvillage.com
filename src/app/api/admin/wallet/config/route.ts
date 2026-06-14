// /api/admin/wallet/config — Office operator proxy to the tgv.com withdrawal-config endpoint.
//
//   GET → current config + safe defaults + the two-key live gate posture
//   PUT → partial WithdrawalConfig; merged + normalized + audited on tgv.com
//
// The withdrawal runtime config (killswitch + fraud limits) is a JSON file on tgv.com's disk,
// owned by tgv.com's wallet engine (normalize + before/after audit live there). Office is a THIN
// CLIENT: it proxies GET/PUT to tgv.com /api/wallet/withdrawal/config server-to-server with
// INTERNAL_API_SECRET (same pattern as /api/admin/invitations → /api/internal/send-invite). We
// attribute the audit to the acting operator by passing their resolved legacy users.id.
//
// Gated by Office requireAdmin. Queue + audit-timeline READS hit tgv_db directly (see ../queue,
// ../audit-feed); only the config file write must run tgv.com's engine, hence the proxy.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}
const CONFIG_URL = () => `${tgvBase()}/api/wallet/withdrawal/config`;

// Known WithdrawalConfig fields (mirror of tgv.com's engine shape). PUT bodies are filtered to
// these before forwarding — defense-in-depth so a buggy/compromised caller can't smuggle unknown
// keys through to tgv.com's config file. tgv.com remains the authoritative validation boundary.
const WITHDRAWAL_CONFIG_KEYS = new Set([
  "enabled", "rail", "maxPerPeriodTokens", "periodDays", "perRequestMaxTokens",
  "minTokens", "cooldownHours", "holdHours", "offerInstant", "instantFeeBps",
  "requireVerifiedIdentity",
]);

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  try {
    const res = await fetch(CONFIG_URL(), {
      headers: { "x-internal-secret": secret },
      cache: "no-store",
    });
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  // Resolve the operator's legacy users.id so tgv.com attributes the config audit to the human.
  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  // Forward ONLY recognized WithdrawalConfig keys — never proxy arbitrary fields to tgv.com.
  const filtered = Object.fromEntries(
    Object.entries(body).filter(([k]) => WITHDRAWAL_CONFIG_KEYS.has(k)),
  );
  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: "no_recognized_fields" }, { status: 400 });
  }

  try {
    const res = await fetch(CONFIG_URL(), {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": secret,
        "x-operator-actor-id": actorId,
      },
      body: JSON.stringify(filtered),
      cache: "no-store",
    });
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
