// GET /api/admin/villagers/managed-status?siteId=<uuid>&env=test|live — proxy → tgv.com managed/status.
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return proxyManaged(req, { path: "status", method: "GET" });
}
