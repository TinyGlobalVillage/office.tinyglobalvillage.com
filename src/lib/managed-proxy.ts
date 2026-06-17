// src/lib/managed-proxy.ts
// Shared proxy for the Villagers "Managed Onboarding" tile → tgv.com's managed-connect routes.
// Office holds no Stripe keys; every managed-connect action runs on tgv.com via the internal-secret
// (operator-auth) seam, attributed to the operator's legacy users.id. Operator-only (requireAdmin).
// tgv.com is the authoritative boundary — it re-validates everything (uuid, amounts, the HARD RULE).
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function proxyManaged(
  req: NextRequest,
  opts: { path: "create" | "status" | "account-session" | "account-link" | "recheck" | "charge"; method: "GET" | "POST" },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const inUrl = new URL(req.url);
  const env = inUrl.searchParams.get("env") === "test" ? "test" : "live";

  const url = new URL(`${tgvBase()}/api/connect/managed/${opts.path}`);
  url.searchParams.set("env", env);
  if (opts.method === "GET") {
    const memberId = inUrl.searchParams.get("memberId");
    if (memberId) url.searchParams.set("memberId", memberId);
  }

  const init: RequestInit = {
    method: opts.method,
    headers: {
      "content-type": "application/json",
      "x-internal-secret": secret,
      "x-operator-actor-id": actorId,
    },
    cache: "no-store",
  };
  if (opts.method === "POST") init.body = await req.text();

  try {
    const res = await fetch(url.toString(), init);
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
