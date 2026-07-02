// POST /api/admin/members/[id]/reset-2fa
//
// Admin-mediated 2FA recovery for a TGV member. Used when a member loses
// their authenticator device AND has burned through their recovery codes.
// Phase 5 of tgv-member-auth-magic-link.md.
//
// Resets, in one transaction:
//   1. TOTP fields on members (totp_secret, totp_enrolled_at,
//      recovery_codes_hash → [])
//   2. All passkeys for the user (member_passkeys, member_passkey_challenges)
//   3. All active sessions for the user (member_sessions)
//   4. Writes one row to admin_audit_log capturing actor + counts of what
//      was cleared.
//
// Body: { confirmEmail: string } — must match the target user's email,
// enforced both client-side (typed-confirmation modal) and server-side here.
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing member id" }, { status: 400 });
  }

  let body: { confirmEmail?: string };
  try {
    body = (await req.json()) as { confirmEmail?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const confirmEmail = (body.confirmEmail ?? "").trim().toLowerCase();
  if (!confirmEmail) {
    return NextResponse.json(
      { ok: false, error: "confirmEmail is required" },
      { status: 400 },
    );
  }

  const targetRows = await db
    .select()
    .from(schema.members)
    .where(eq(schema.members.id, id))
    .limit(1);
  const target = targetRows[0];
  if (!target) {
    return NextResponse.json({ ok: false, error: "Member user not found" }, { status: 404 });
  }
  if (target.email.toLowerCase() !== confirmEmail) {
    return NextResponse.json(
      { ok: false, error: "confirmEmail does not match target email" },
      { status: 400 },
    );
  }

  const before = {
    hadTotp: target.totpSecret !== null,
    totpEnrolledAt: target.totpEnrolledAt,
    recoveryCodesRemaining: target.recoveryCodesHash.length,
  };

  const result = await db.transaction(async (tx) => {
    await tx
      .update(schema.members)
      .set({
        totpSecret: null,
        totpEnrolledAt: null,
        recoveryCodesHash: [],
        updatedAt: new Date(),
      })
      .where(eq(schema.members.id, id));

    const deletedPasskeys = await tx
      .delete(schema.memberPasskeys)
      .where(eq(schema.memberPasskeys.memberId, id))
      .returning({ credentialId: schema.memberPasskeys.credentialId });

    await tx
      .delete(schema.memberPasskeyChallenges)
      .where(eq(schema.memberPasskeyChallenges.memberId, id));

    const deletedSessions = await tx
      .delete(schema.memberSessions)
      .where(eq(schema.memberSessions.userId, id))
      .returning({ sessionToken: schema.memberSessions.sessionToken });

    const after = {
      passkeysDeleted: deletedPasskeys.length,
      sessionsDeleted: deletedSessions.length,
    };

    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "member_2fa_reset",
      targetType: "member_user",
      targetId: id,
      before,
      after,
      note: `Reset by Office admin ${gate.username} for ${target.email}`,
    });

    return after;
  });

  return NextResponse.json({ ok: true, ...result });
}
