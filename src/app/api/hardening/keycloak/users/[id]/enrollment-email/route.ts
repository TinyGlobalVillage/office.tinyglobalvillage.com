// POST /api/hardening/keycloak/users/[id]/enrollment-email
//
// Re-send the execute-actions enrollment email (passkey + recovery-code
// setup, themed, one-time link) — the operator-shaped version of the C8
// resend recipe. Return target comes from the Office-side config
// (default: tinyglobalvillage.com /login, the registered D12 convention).

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { kcAdmin } from "@/lib/keycloak/admin";
import { readKeycloakConfig } from "@/lib/keycloak/config";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!kcAdmin) {
    return NextResponse.json({ error: "KC_ADMIN_* not configured" }, { status: 503 });
  }

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await kcAdmin.getUser(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { enrollmentEmail } = readKeycloakConfig();
  const ok = await kcAdmin.sendEnrollmentEmail({
    sub: id,
    clientId: enrollmentEmail.clientId,
    redirectUri: enrollmentEmail.redirectUri,
    lifespanSeconds: Math.floor(enrollmentEmail.lifespanHours * 3600),
  });

  logHardeningAction({
    action: "keycloak.user.enrollment-email",
    target: user.username,
    user: auth.username,
    success: ok,
    details: {
      email: user.email ?? null,
      lifespanHours: enrollmentEmail.lifespanHours,
      returnClient: enrollmentEmail.clientId,
    },
  });

  if (!ok) {
    return NextResponse.json(
      { error: "Keycloak refused the email (check SMTP + redirect URI registration)" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true });
}
