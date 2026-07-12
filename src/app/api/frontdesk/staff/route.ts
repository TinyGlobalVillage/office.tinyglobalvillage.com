/**
 * Front Desk staff roster — the assignee picker for scheduled alerts.
 *
 * Returns `{username, name}` for every Office staff account (office-staff.json
 * roster + data/users.json display names). Non-sensitive (names only), so it's
 * gated by requireAuth (any staff), not requireAdmin — anyone working the board
 * can assign a task.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readRoster } from "@/lib/member-auth/bridge";
import { getUserDisplayName } from "@/lib/users-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // office-staff.json roster (bounds to actual staff) × users.json display names.
  const staff = Object.keys(readRoster()).map((username) => ({
    username,
    name: getUserDisplayName(username),
  }));

  return NextResponse.json({ staff });
}
