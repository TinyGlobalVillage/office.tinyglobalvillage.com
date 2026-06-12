// GET /api/admin/invitations/audit-feed?limit=N
//
// Activity Timeline for the InvitationsControlModal HCM tile. Reads
// admin_audit_log filtered to invite actions, newest-first. Shape matches the
// AuditLogTimeline shared component contract.
import { type NextRequest, NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const INVITE_ACTIONS = ["invite_created", "invite_updated", "invite_resent"] as const;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "100")));

  const rows = await db
    .select({
      id: schema.adminAuditLog.id,
      createdAt: schema.adminAuditLog.createdAt,
      action: schema.adminAuditLog.action,
      note: schema.adminAuditLog.note,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(inArray(schema.adminAuditLog.action, INVITE_ACTIONS as unknown as string[]))
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit);

  const shaped = rows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.action,
    label: r.action.replaceAll("_", " "),
    detail: r.note ?? null,
    ip: null,
    by: r.actorUserId,
    outcome: r.action === "invite_updated" ? "warn" : "ok",
  }));

  return NextResponse.json({ rows: shaped });
}
