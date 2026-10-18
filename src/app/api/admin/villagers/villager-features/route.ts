// GET ?siteId=<uuid> (the site's plan feature set + catalog) and PUT { siteId, key, mode } (set or
// clear one allow/deny override) — per-villager dashboard feature overrides (HQ migration 0172,
// villager_feature_overrides). Proxied to HQ's /api/user/admin/villager-features over the
// internal-secret seam so the plan resolver lives in ONE place (HQ). Operator-only (requireAdmin).
import { type NextRequest, NextResponse } from "next/server";
import { proxyProducts } from "@/lib/products-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PATH = "/api/user/admin/villager-features";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = (req: NextRequest) => {
  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  if (!UUID.test(siteId)) return NextResponse.json({ error: "Bad siteId" }, { status: 400 });
  return proxyProducts(req, { path: `${PATH}?siteId=${encodeURIComponent(siteId)}`, method: "GET" });
};

export const PUT = (req: NextRequest) => proxyProducts(req, { path: PATH, method: "PUT" });
