// GET /api/admin/migration-snapshots/audit-log — the Rollbacks panel's timeline (restores, copy-backs,
// snapshots, policy changes, build rollbacks).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["migration-snapshots.", "deploy.rollback"]) });
}
