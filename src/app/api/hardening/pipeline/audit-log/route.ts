// GET /api/hardening/pipeline/audit-log
// Activity for the Pipeline HCM: alerts sent, direct-route close requests, request cancels.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["pipeline.", "deploy.request_cancel", "deploy-watcher.config"]) });
}
