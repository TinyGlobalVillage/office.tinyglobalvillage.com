// GET /api/admin/rcs-gov/log — the daemon's own action log (restarts, stops, holds), newest first.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readLog } from "@/lib/rcs-gov/state";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const n = Number(req.nextUrl.searchParams.get("limit") || 100);
  return NextResponse.json({ lines: readLog(Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : 100) });
}
