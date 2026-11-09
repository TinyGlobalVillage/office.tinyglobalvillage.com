// GET (list) + POST ({op: create|send|setActive}) HQ's own invite codes — proxied to HQ over the
// internal-secret seam (Villagers → Codes → Invite). Same rows as HQ Store Front → Codes → Invite Codes.
import type { NextRequest } from "next/server";
import { proxyPromo } from "@/lib/promo-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/invite-codes", method: "GET" });

export const POST = (req: NextRequest) =>
  proxyPromo(req, { path: "/api/user/admin/invite-codes", method: "POST" });
