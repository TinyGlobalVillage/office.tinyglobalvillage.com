// GET /api/hardening/keycloak/users?search=&first=&max=
//
// Paged realm-user directory for the Keycloak HCM (service accounts filtered
// out by module-auth). Read-only; view-users.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { kcAdmin } from "@/lib/keycloak/admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  if (!kcAdmin) {
    return NextResponse.json({ error: "KC_ADMIN_* not configured" }, { status: 503 });
  }

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search")?.trim() || undefined;
  const first = Math.max(0, Number(sp.get("first") ?? 0) || 0);
  const max = Math.min(100, Math.max(1, Number(sp.get("max") ?? 50) || 50));

  const [users, total] = await Promise.all([
    kcAdmin.listUsers({ search, first, max }),
    kcAdmin.countUsers(search),
  ]);

  return NextResponse.json({ users, total });
}
