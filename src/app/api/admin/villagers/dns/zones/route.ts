// Operator DNS — list all Cloudflare zones (labeled with owning DC tenant) via the
// engine. Admin-gated; Office holds no CF creds (proxies tgv-domain-service).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { dcEngine } from "@/lib/dc-engine-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { status, data } = await dcEngine("/api/internal/dns/zones");
  return NextResponse.json(data, { status });
}
