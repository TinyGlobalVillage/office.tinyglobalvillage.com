// /api/hardening/media-folder/audit-log — rows for the Media Folder HCM's
// Activity Timeline (audit 2026-11-07 #29). Admin-only.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["media-folder."]) });
}
