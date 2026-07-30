// GET (list) + POST (create) wizard subscription PLANS — proxied to HQ over the internal-secret seam.
import type { NextRequest } from "next/server";
import { proxyProducts } from "@/lib/products-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) =>
  proxyProducts(req, { path: "/api/user/admin/platform-products", method: "GET" });

export const POST = (req: NextRequest) =>
  proxyProducts(req, { path: "/api/user/admin/platform-products", method: "POST" });
