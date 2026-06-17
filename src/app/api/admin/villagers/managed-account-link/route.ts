// POST /api/admin/villagers/managed-account-link?env=test|live — proxy → tgv.com managed/account-link.
// Hosted-onboarding FALLBACK to the embedded flow (returns a Stripe-hosted URL to open in a new tab).
import { type NextRequest } from "next/server";
import { proxyManaged } from "@/lib/managed-proxy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return proxyManaged(req, { path: "account-link", method: "POST" });
}
