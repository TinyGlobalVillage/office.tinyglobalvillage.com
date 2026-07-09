// /api/frontdesk/timeclock — Office → tgv.com staff time clock over the internal seam.
// GET = current status; POST {action: punch_in|punch_out|break_start|break_end}. Same clock rows
// (staff_time_entries, migration 0092) the TIM dashboard bubble drives — one clock per staffer.
import type { NextRequest } from "next/server";
import { proxyTimeclock } from "@/lib/support-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return proxyTimeclock(req, "GET");
}

export async function POST(req: NextRequest) {
  return proxyTimeclock(req, "POST");
}
