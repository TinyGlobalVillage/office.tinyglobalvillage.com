// src/lib/products-proxy.ts
// Shared proxy for the Villagers "Wizard Pricing" tile → tgv.com's platform product/add-on admin
// API. Office holds no Stripe keys; creating / re-pricing / toggling / deleting a subscription PLAN
// (platform_products) or ADD-ON (platform_addons) — the rows the signup wizard reads — runs on
// tgv.com via the internal-secret (operator-auth) seam, attributed to the operator. tgv.com is the
// authoritative boundary: it re-validates everything, owns Stripe, and is money-first (Stripe
// Product+Price before any DB write). Operator-only (requireAdmin). Same seam as promo-proxy.ts.
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

/** Proxy an admin platform-product / platform-addon action to HQ's /api/user/admin/... path. */
export async function proxyProducts(
  req: NextRequest,
  opts: { path: string; method: "GET" | "POST" | "PATCH" | "DELETE" },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const actorId = await resolveAdminActorId(gate.username);
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-internal-secret": secret,
  };
  if (actorId) headers["x-operator-actor-id"] = actorId;

  const init: RequestInit = { method: opts.method, headers, cache: "no-store" };
  if (opts.method === "POST" || opts.method === "PATCH") init.body = await req.text();

  try {
    const res = await fetch(`${tgvBase()}${opts.path}`, init);
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
