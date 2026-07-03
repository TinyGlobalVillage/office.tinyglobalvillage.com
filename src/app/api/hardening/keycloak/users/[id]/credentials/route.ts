// GET /api/hardening/keycloak/users/[id]/credentials
//
// Lazy per-user credential summary (passkeys + recovery-code set) for the
// expanded row in the Keycloak HCM Members panel. Read-only; view-users.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { kcAdmin } from "@/lib/keycloak/admin";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
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

  const credentials = await kcAdmin.listCredentials(id);
  return NextResponse.json({ credentials });
}
