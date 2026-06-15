// POST /api/admin/villagers/managed-create?env=test|live — proxy → tgv.com managed/create.
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyManaged(req, { path: "create", method: "POST" });
}
