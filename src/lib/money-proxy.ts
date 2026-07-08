// src/lib/money-proxy.ts
// Office → tgv.com proxy for the Villagers "Money & Stores" tile. Office holds no money state; the
// per-site money config (public.site_money_config) is tgv.com-owned, so every read/write runs on
// tgv.com via the internal-secret seam (mirrors managed-proxy). tgv.com re-validates everything —
// it resolves the site's OWNER and re-checks ownership before touching a wallet/stripe axis.
// Operator-only (requireAdmin). Fails CLOSED.
import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function proxySiteMoney(req: NextRequest, method: "GET" | "POST") {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  const inUrl = new URL(req.url);
  const url = new URL(`${tgvBase()}/api/platform/site-money`);

  const init: RequestInit = {
    method,
    headers: { "content-type": "application/json", "x-internal-secret": secret },
    cache: "no-store",
  };
  if (method === "GET") {
    const siteId = inUrl.searchParams.get("siteId");
    if (siteId) url.searchParams.set("siteId", siteId);
  } else {
    init.body = await req.text();
  }

  try {
    const res = await fetch(url.toString(), init);
    const d = await res.json().catch(() => ({}));
    return NextResponse.json(d, { status: res.status });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }
}
