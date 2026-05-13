// GET /api/admin/member-users
//
// Lists every human in member_users with a derived 2FA-status indicator so
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

  const passkeyCounts = db
    .select({
      memberUserId: schema.memberPasskeys.memberUserId,
      count: sql<number>`count(*)::int`.as("passkey_count"),
    })
    .from(schema.memberPasskeys)
    .groupBy(schema.memberPasskeys.memberUserId)
    .as("passkey_counts");

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
      id: schema.memberUsers.id,
      email: schema.memberUsers.email,
      name: schema.memberUsers.name,
      totpEnrolledAt: schema.memberUsers.totpEnrolledAt,
      recoveryCodesRemaining: sql<number>`coalesce(array_length(${schema.memberUsers.recoveryCodesHash}, 1), 0)::int`,
      lastLoginAt: schema.memberUsers.lastLoginAt,
      createdAt: schema.memberUsers.createdAt,
      passkeyCount: sql<number>`coalesce(${passkeyCounts.count}, 0)::int`,
      sessionCount: sql<number>`coalesce(${sessionCounts.count}, 0)::int`,
      lastResetAt: lastResets.lastResetAt,
    })
    .from(schema.memberUsers)
    .leftJoin(passkeyCounts, eq(passkeyCounts.memberUserId, schema.memberUsers.id))
    .leftJoin(sessionCounts, eq(sessionCounts.userId, schema.memberUsers.id))
    .leftJoin(lastResets, eq(lastResets.targetId, schema.memberUsers.id))
    .orderBy(desc(schema.memberUsers.createdAt));

  return NextResponse.json({ ok: true, memberUsers: rows });
}
