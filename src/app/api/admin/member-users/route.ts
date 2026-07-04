// GET /api/admin/member-users
//
// Lists every human in members with a derived 2FA-status indicator so
// the admin surface can render the row-by-row "Reset 2FA" actions.
//
// Joins recent admin_audit_log rows for action='member_2fa_reset' so the table
// can show "last reset" timestamps without a second roundtrip.
import { type NextRequest, NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // passkeyCount RETIRED with the local stack (F19, 2026-07-03): Keycloak
  // owns credentials now. kcLinked (keycloak_sub set) is the row-level
  // signal; per-user credential detail lives on the Keycloak HCM tile.
  const sessionCounts = db
    .select({
      userId: schema.memberSessions.userId,
      count: sql<number>`count(*)::int`.as("session_count"),
    })
    .from(schema.memberSessions)
    .groupBy(schema.memberSessions.userId)
    .as("session_counts");

  const lastResets = db
    .select({
      targetId: schema.adminAuditLog.targetId,
      lastResetAt: sql<Date>`max(${schema.adminAuditLog.createdAt})`.as("last_reset_at"),
    })
    .from(schema.adminAuditLog)
    .where(
      and(
        eq(schema.adminAuditLog.action, "member_2fa_reset"),
        eq(schema.adminAuditLog.targetType, "member_user"),
      ),
    )
    .groupBy(schema.adminAuditLog.targetId)
    .as("last_resets");

  const rows = await db
    .select({
      id: schema.members.id,
      email: schema.members.email,
      name: schema.members.name,
      totpEnrolledAt: schema.members.totpEnrolledAt,
      recoveryCodesRemaining: sql<number>`coalesce(array_length(${schema.members.recoveryCodesHash}, 1), 0)::int`,
      lastLoginAt: schema.members.lastLoginAt,
      createdAt: schema.members.createdAt,
      kcLinked: sql<boolean>`(${schema.members.keycloakSub} is not null)`,
      sessionCount: sql<number>`coalesce(${sessionCounts.count}, 0)::int`,
      lastResetAt: lastResets.lastResetAt,
    })
    .from(schema.members)
    .leftJoin(sessionCounts, eq(sessionCounts.userId, schema.members.id))
    // admin_audit_log.target_id is text; members.id is uuid. Cast to uuid
    // for the join (the subquery already filters targetType='member_user', so
    // every target_id here is a member uuid string).
    .leftJoin(lastResets, eq(sql`${lastResets.targetId}::uuid`, schema.members.id))
    .orderBy(desc(schema.members.createdAt));

  return NextResponse.json({ ok: true, members: rows });
}
