// Admin gate helper — replays requireAuth() then verifies the user's role
// in data/users.json is "admin". Used by every hardening / system-tools
// endpoint. Returns NextResponse on rejection so callers can early-return.

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getOfficeRole } from "@/lib/member-auth/bridge";

// Roster-first (office-staff.json) with legacy users.json fallback, so an admin
// arriving via a member session resolves the same as one via the NextAuth JWT.
function isAdminUsername(username: string): boolean {
  return getOfficeRole(username) === "admin";
}

export async function requireAdmin(
  req: NextRequest,
): Promise<{ ok: true; username: string } | NextResponse> {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!username || !isAdminUsername(username)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return { ok: true, username };
}
