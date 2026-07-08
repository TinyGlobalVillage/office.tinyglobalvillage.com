// GET /api/admin/villagers/site-money/audit-feed?siteId=...&limit=N
//
// Activity Timeline for MoneyStoresModal — admin_audit_log rows for `site-money.*` actions
// (written by proxySiteMoney on every wallet/Stripe axis change), scoped to one site, newest
// first. Feeds the shared AuditLogTimeline contract ({ rows: TimelineRow[] }).
//
// fetchAdminAuditRows (suite-oversight.ts) only filters by an action allowlist, not targetId —
// this feed needs BOTH (the "site-money." prefix AND this specific site), so it queries
// admin_audit_log directly, modeled on that helper's shape/mapping.
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { and, desc, eq, like } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import type { TimelineRow } from "@/lib/suite-oversight";

export const runtime = "nodejs";

const ADMIN_LABEL: Record<string, string> = {
  "site-money.set-axis": "money axis changed",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const siteId = searchParams.get("siteId");
  if (!siteId) return NextResponse.json({ error: "site_id_required" }, { status: 400 });
  const limit = Math.min(120, Math.max(1, Number(searchParams.get("limit") ?? "30")));

  const adminRows = await db
    .select({
      id: schema.adminAuditLog.id,
      createdAt: schema.adminAuditLog.createdAt,
      action: schema.adminAuditLog.action,
      note: schema.adminAuditLog.note,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(
      and(
        like(schema.adminAuditLog.action, "site-money.%"),
        eq(schema.adminAuditLog.targetId, siteId),
      ),
    )
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit);

  const rows: TimelineRow[] = adminRows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.action,
    label: ADMIN_LABEL[r.action] ?? r.action.replace("site-money.", "").replaceAll("_", " "),
    detail: r.note ?? null,
    ip: null,
    by: r.actorUserId,
    outcome: "ok",
  }));

  return NextResponse.json({ rows });
}
