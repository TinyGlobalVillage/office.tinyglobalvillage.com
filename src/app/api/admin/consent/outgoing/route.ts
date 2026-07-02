// GET /api/admin/consent/outgoing — the admin's sent access requests + their status (so an approved
// one shows the "enter your code" box). Operator-only. villager-dashboard-canon P6.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { memberIdForUsername } from "@/lib/member-auth/bridge";
import { db } from "@/lib/db-drizzle";
import { listOutgoing } from "@tgv/module-consent/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const adminMemberId = await memberIdForUsername(gate.username);
  if (!adminMemberId) return NextResponse.json({ outgoing: [] });
  const outgoing = await listOutgoing(db as never, adminMemberId);
  return NextResponse.json({ outgoing });
}
