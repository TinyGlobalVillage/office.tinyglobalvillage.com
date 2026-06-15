// POST /api/admin/villagers/managed-recheck?env=test|live — proxy → tgv.com managed/recheck.
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyManaged(req, { path: "recheck", method: "POST" });
}
