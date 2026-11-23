// Staff gate — the tier below requireAdmin. "Staff" is anyone on the Office roster as an admin or an
// employee (getOfficeRole: office-staff.json first, legacy users.json fallback). A signed-in member
// who is not on the roster, or carries any other role, is not staff.
//
// Use it for surfaces every staffer may open but nobody outside the team may (Gio 2026-11-22, the
// Fundraiser tile: "on office make sure it's only visible to staff"). Money, payroll and the
// hardening tools stay on requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getOfficeRole } from "@/lib/member-auth/bridge";

const STAFF_ROLES = new Set(["admin", "employee"]);

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && STAFF_ROLES.has(role);
}

export async function requireStaff(
  req: NextRequest,
): Promise<{ ok: true; username: string; role: string } | NextResponse> {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const role = username ? getOfficeRole(username) : null;
  if (!isStaffRole(role)) return NextResponse.json({ error: "Staff only" }, { status: 403 });
  return { ok: true, username, role: role as string };
}
