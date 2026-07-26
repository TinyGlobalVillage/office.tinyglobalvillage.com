// GET (list) + POST (create) platform promo codes — proxied to HQ over the internal-secret seam.
import type { NextRequest } from "next/server";
import { proxyPromo } from "@/lib/promo-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/promo-codes", method: "GET" });

export const POST = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/promo-codes", method: "POST" });
