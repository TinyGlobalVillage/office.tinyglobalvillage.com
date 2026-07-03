// POST /api/hardening/keycloak/users/[id]/logout-all
//
// Operator sign-out-everywhere: ends every Keycloak SSO session for the user
// AND revokes the shared public-schema member_sessions rows (the cookie
// tgv.com + Office validate). Tenant-schema session replicas are outside
// Office's DB grants (privilege-filtered by design) — with the SSO session
// gone those apps can mint no NEW sessions, and their local ones age out on
// the 30d idle window. Same scope as the D13 member-facing Settings button;
// this is the audited admin lever.

import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { db } from "@/lib/db-drizzle";
import { kcAdmin } from "@/lib/keycloak/admin";

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

  const kcOk = await kcAdmin.logoutAllSessions(id);

  // Local revoke — raw SQL (registry tables via Drizzle select crash under
  // Turbopack; raw execute is the house idiom for them).
  let localRevoked = 0;
  try {
    const res = await db.execute(
      sql`DELETE FROM member_sessions WHERE user_id IN
          (SELECT id FROM members WHERE keycloak_sub = ${id})`,
    );
    localRevoked = res.rowCount ?? 0;
  } catch {
    localRevoked = -1; // signalled to the UI as "local revoke failed"
  }

  logHardeningAction({
    action: "keycloak.user.logout-all",
    target: user.username,
    user: auth.username,
    success: kcOk,
    details: { kcSessionsEnded: kcOk, localSessionsRevoked: localRevoked },
  });

  if (!kcOk) {
    return NextResponse.json({ error: "Keycloak logout failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, localSessionsRevoked: localRevoked });
}
