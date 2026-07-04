// POST /api/admin/members/[id]/reset-2fa
//
// Admin-mediated credential recovery for a TGV member. Used when a member
// loses their authenticator device AND has burned through their recovery
// codes.
//
// F19 port (2026-07-03): Keycloak owns passkeys now — the local
// member_passkeys wipe became a KC credential wipe (webauthn + KC-native
// recovery codes) via office-admin-svc, plus KC logout-all and a fresh
// enrollment email so the member has a path back in. Resets:
//   1. KC credentials for the member's realm user + all KC SSO sessions,
//      then sends the execute-actions enrollment email (passkey + recovery
//      setup, 48h themed link).
//   2. TOTP fields + LOCAL recovery codes on members (dormant break-glass).
//   3. All active local sessions (member_sessions).
//   4. One admin_audit_log row capturing actor + counts of what was cleared.
//
// Body: { confirmEmail: string } — must match the target user's email,
// enforced both client-side (typed-confirmation modal) and server-side here.
import { type NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { kcAdmin } from "@/lib/keycloak/admin";
import { readKeycloakConfig } from "@/lib/keycloak/config";

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
    kcLinked: target.keycloakSub !== null,
  };

  // 1) Keycloak side FIRST (not transactional with the DB — if the IdP is
  //    unreachable we bail before touching local state, so a half-reset can't
  //    strand the member). Wipe credentials, end SSO sessions, re-send the
  //    enrollment email so they can re-enroll.
  let kcCredentialsDeleted = 0;
  let kcEnrollmentEmailSent = false;
  if (target.keycloakSub) {
    if (!kcAdmin) {
      return NextResponse.json(
        { ok: false, error: "KC_ADMIN_* not configured — cannot reset IdP credentials" },
        { status: 503 },
      );
    }
    try {
      const creds = await kcAdmin.listCredentials(target.keycloakSub);
      for (const c of creds) {
        if (await kcAdmin.deleteCredential(target.keycloakSub, c.id)) {
          kcCredentialsDeleted += 1;
        }
      }
      await kcAdmin.logoutAllSessions(target.keycloakSub);
      const { enrollmentEmail } = readKeycloakConfig();
      kcEnrollmentEmailSent = await kcAdmin.sendEnrollmentEmail({
        sub: target.keycloakSub,
        clientId: enrollmentEmail.clientId,
        redirectUri: enrollmentEmail.redirectUri,
        lifespanSeconds: Math.floor(enrollmentEmail.lifespanHours * 3600),
      });
    } catch {
      return NextResponse.json(
        { ok: false, error: "Keycloak reset failed — nothing was changed locally" },
        { status: 502 },
      );
    }
  }

  // 2+3) Local state, atomically, with the audit row.
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

    const deletedSessions = await tx
      .delete(schema.memberSessions)
      .where(eq(schema.memberSessions.userId, id))
      .returning({ sessionToken: schema.memberSessions.sessionToken });

    const after = {
      kcCredentialsDeleted,
      kcEnrollmentEmailSent,
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
