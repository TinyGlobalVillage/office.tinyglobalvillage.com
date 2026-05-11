import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { desc } from "drizzle-orm";

// GET /api/admin/tenant-apps/audit-log?limit=N
//
// Returns the combined Activity Timeline rendered at the top of the Tenant
// Apps HCM modal. Reads tenant_apps_audit newest-first; client filters by
// kind via the AuditLogTimeline shared component.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(2000, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  const rows = await db
    .select()
    .from(schema.tenantAppsAudit)
    .orderBy(desc(schema.tenantAppsAudit.createdAt))
    .limit(limit);

  // Shape rows to match the AuditLogTimeline contract used by other HCMs.
  const shaped = rows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.kind,
    label: r.kind.replaceAll("_", " "),
    detail: r.slug ?? (r.details as { pm2Name?: string } | null)?.pm2Name ?? null,
    by: r.actor,
    outcome: r.kind,
    details: r.details,
  }));

  return NextResponse.json({ rows: shaped });
}
