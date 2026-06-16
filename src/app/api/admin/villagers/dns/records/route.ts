// Operator DNS — per-zone record CRUD via the engine. Admin-gated; Office holds no
// CF creds (proxies tgv-domain-service). zoneId (+ recordId for PATCH/DELETE) ride
// the query string; the record payload is the JSON body.
// TODO(dns-audit): log POST/PATCH/DELETE to the Office operator audit (actor + zone +
// record diff) before this ships — operator DNS edits mutate production DNS.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { dcEngine } from "@/lib/dc-engine-proxy";

export const dynamic = "force-dynamic";

function ids(req: NextRequest): { zoneId?: string; recordId?: string } {
  const u = new URL(req.url);
  return {
    zoneId: u.searchParams.get("zoneId") ?? undefined,
    recordId: u.searchParams.get("recordId") ?? undefined,
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId } = ids(req);
  const { status, data } = await dcEngine("/api/internal/dns/records", { search: { zoneId } });
  return NextResponse.json(data, { status });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId } = ids(req);
  const body = await req.json().catch(() => null);
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "POST",
    search: { zoneId },
    body,
  });
  return NextResponse.json(data, { status });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId, recordId } = ids(req);
  const body = await req.json().catch(() => null);
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "PATCH",
    search: { zoneId, recordId },
    body,
  });
  return NextResponse.json(data, { status });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId, recordId } = ids(req);
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "DELETE",
    search: { zoneId, recordId },
  });
  return NextResponse.json(data, { status });
}
