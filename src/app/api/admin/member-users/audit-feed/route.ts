// GET /api/admin/member-users/audit-feed?limit=N
//
// Powers the Activity Timeline at the top of the MemberAuthControlModal HCM
// tile. Reads admin_audit_log filtered to member-auth actions (currently just
// `member_2fa_reset`) newest-first.
//
// Shape matches the AuditLogTimeline shared component contract — see
// src/app/components/hardening/_shared/AuditLogTimeline.tsx.
import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, and, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const MEMBER_AUTH_ACTIONS = ["member_2fa_reset"] as const;

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
      targetType: schema.adminAuditLog.targetType,
      targetId: schema.adminAuditLog.targetId,
      note: schema.adminAuditLog.note,
      after: schema.adminAuditLog.after,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(
      and(
        inArray(schema.adminAuditLog.action, MEMBER_AUTH_ACTIONS as unknown as string[]),
        eq(schema.adminAuditLog.targetType, "member_user"),
      ),
    )
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit);

  const shaped = rows.map((r) => {
    const after = (r.after ?? {}) as { passkeysDeleted?: number; sessionsDeleted?: number };
    const detailParts: string[] = [];
    if (typeof after.passkeysDeleted === "number") detailParts.push(`${after.passkeysDeleted} passkeys`);
    if (typeof after.sessionsDeleted === "number") detailParts.push(`${after.sessionsDeleted} sessions`);
    return {
      id: r.id,
      ts: r.createdAt.toISOString(),
      kind: r.action,
      label: r.action.replaceAll("_", " "),
      detail: r.note ?? (detailParts.length > 0 ? detailParts.join(" · ") : null),
      ip: null,
      by: r.actorUserId,
      outcome: "ok",
    };
  });

  return NextResponse.json({ rows: shaped });
}
