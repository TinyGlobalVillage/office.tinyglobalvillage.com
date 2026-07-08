// GET/POST /api/admin/villagers/site-money — operator "Money & Stores" for a chosen villager site.
// Thin wrapper over proxySiteMoney (→ tgv.com /api/platform/site-money via the internal-secret seam).
// Operator-only (requireAdmin is enforced inside the proxy).
import { type NextRequest } from "next/server";
import { proxySiteMoney } from "@/lib/money-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxySiteMoney(req, "GET");
}
export async function POST(req: NextRequest) {
  return proxySiteMoney(req, "POST");
}
