// POST /api/admin/villagers/managed-charge?env=test|live — proxy → tgv.com managed/charge.
// The HARD RULE (no charge unless charges_enabled) is enforced authoritatively on tgv.com.
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyManaged(req, { path: "charge", method: "POST" });
}
