// GET /api/admin/office-staff/audit-feed
//
// Powers the Activity Timeline at the top of the OfficeStaffControlModal HCM
// tile. Returns the shared `auth.*` JSONL feed (passkey enroll/assert/reset,
// recovery redemptions) newest-first, already shaped for AuditLogTimeline.
//
// Office staff auth state lives in the FLAT FILE data/users.json (not Postgres
// like member-auth), but the audit trail is the SAME append-only JSONL sink —
// readAuthAuditRows already matches the TimelineRow shape.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readAuthAuditRows } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  return NextResponse.json({ rows: readAuthAuditRows() });
}
