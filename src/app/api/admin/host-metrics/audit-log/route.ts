// GET /api/admin/host-metrics/audit-log
//
// Feeds the Box Usage HCM's timeline: every host-metrics.* action (threshold
// retunes, cadence changes, sampling switched off) from the shared hardening
// JSONL sink. Turning the monitor off is exactly the kind of change that should
// be attributable later.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["host-metrics."]) });
}
