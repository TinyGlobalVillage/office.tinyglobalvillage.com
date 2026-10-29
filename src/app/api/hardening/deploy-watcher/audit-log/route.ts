// GET /api/hardening/deploy-watcher/audit-log
// Activity for the Deploy Watcher HCM: config changes + every promote / rollback / build.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["deploy-watcher.", "deploy."]) });
}
