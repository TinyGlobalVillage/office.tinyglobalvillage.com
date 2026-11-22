// GET /api/admin/folding/audit-log — the Folding@home panel's timeline (start / stop / team changes).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readHardeningAuditRows } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ rows: readHardeningAuditRows(["folding."]) });
}
