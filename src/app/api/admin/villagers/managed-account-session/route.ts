// POST /api/admin/villagers/managed-account-session?env=test|live — proxy → tgv.com managed/account-session.
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyManaged(req, { path: "account-session", method: "POST" });
}
