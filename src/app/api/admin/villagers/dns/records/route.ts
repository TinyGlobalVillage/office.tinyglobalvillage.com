// Operator DNS — per-zone record CRUD via the engine. Admin-gated; Office holds no
// CF creds (proxies tgv-domain-service). zoneId (+ recordId for PATCH/DELETE) ride
// the query string; the record payload is the JSON body.
//
// Every mutating op (POST/PATCH/DELETE) is written to the Office operator audit
// (logHardeningAction: actor + zone/record target + the record diff + outcome) — these
// edits mutate PRODUCTION DNS. Reads (GET) are not audited.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { dcEngine } from "@/lib/dc-engine-proxy";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

function ids(req: NextRequest): { zoneId?: string; recordId?: string } {
  const u = new URL(req.url);
  return {
    zoneId: u.searchParams.get("zoneId") ?? undefined,
    recordId: u.searchParams.get("recordId") ?? undefined,
  };
}

// An engine response is a success only when it's a 2xx AND the engine's own ok flag
// isn't explicitly false (the engine returns {ok:false} with a 4xx/502 on rejection).
function engineOk(status: number, data: Record<string, unknown>): boolean {
  return status >= 200 && status < 300 && data?.ok !== false;
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
  if (body == null) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "POST",
    search: { zoneId },
    body,
  });
  const ok = engineOk(status, data);
  const createdId = (data?.record as { id?: string } | undefined)?.id ?? null;
  logHardeningAction({
    action: "dns.record.create",
    target: `${zoneId ?? "-"}/${createdId ?? "-"}`,
    user: gate.username,
    success: ok,
    details: { zoneId: zoneId ?? null, record: body, ...(ok ? {} : { error: data?.error ?? null }) },
  });
  return NextResponse.json(data, { status });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId, recordId } = ids(req);
  const body = await req.json().catch(() => null);
  if (body == null) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "PATCH",
    search: { zoneId, recordId },
    body,
  });
  const ok = engineOk(status, data);
  logHardeningAction({
    action: "dns.record.update",
    target: `${zoneId ?? "-"}/${recordId ?? "-"}`,
    user: gate.username,
    success: ok,
    details: { zoneId: zoneId ?? null, recordId: recordId ?? null, patch: body, ...(ok ? {} : { error: data?.error ?? null }) },
  });
  return NextResponse.json(data, { status });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const { zoneId, recordId } = ids(req);
  // Snapshot the record BEFORE deletion so the audit log carries what was removed —
  // a recordId alone is a tombstone once Cloudflare drops the record. Best-effort:
  // an audit-read failure must never block the delete.
  const snapshot = await fetchRecordSnapshot(zoneId, recordId);
  const { status, data } = await dcEngine("/api/internal/dns/records", {
    method: "DELETE",
    search: { zoneId, recordId },
  });
  const ok = engineOk(status, data);
  logHardeningAction({
    action: "dns.record.delete",
    target: `${zoneId ?? "-"}/${recordId ?? "-"}`,
    user: gate.username,
    success: ok,
    details: {
      zoneId: zoneId ?? null,
      recordId: recordId ?? null,
      deletedRecord: snapshot,
      ...(ok ? {} : { error: data?.error ?? null }),
    },
  });
  return NextResponse.json(data, { status });
}

// Look up one record's content by id (via the zone's record list) for the delete audit.
// Returns null on any failure — the audit is best-effort, never a delete blocker.
async function fetchRecordSnapshot(
  zoneId?: string,
  recordId?: string,
): Promise<Record<string, unknown> | null> {
  if (!zoneId || !recordId) return null;
  try {
    const { status, data } = await dcEngine("/api/internal/dns/records", { search: { zoneId } });
    if (!engineOk(status, data)) return null;
    const recs = Array.isArray(data.records) ? (data.records as Array<Record<string, unknown>>) : [];
    const found = recs.find((r) => r.id === recordId);
    if (!found) return null;
    return {
      type: found.type ?? null,
      name: found.name ?? null,
      content: found.content ?? null,
      ttl: found.ttl ?? null,
      priority: found.priority ?? null,
    };
  } catch {
    return null;
  }
}
