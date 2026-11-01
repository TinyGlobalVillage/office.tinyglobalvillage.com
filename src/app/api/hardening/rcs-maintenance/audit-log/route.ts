// GET /api/hardening/rcs-maintenance/audit-log — the RCS Maintenance HCM's
// timeline: notices sent (board + email), retunes, tests, detected boots.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["rcs-maintenance."]) });
}
