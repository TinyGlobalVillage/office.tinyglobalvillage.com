// GET (list) + POST (create) platform referral codes — proxied to HQ over the internal-secret seam
// (Villagers → Codes → Referral). Same rows as HQ Store Front → Codes → Platform Referrals.
import type { NextRequest } from "next/server";
import { proxyPromo } from "@/lib/promo-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/referral-codes", method: "GET" });

export const POST = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/referral-codes", method: "POST" });
