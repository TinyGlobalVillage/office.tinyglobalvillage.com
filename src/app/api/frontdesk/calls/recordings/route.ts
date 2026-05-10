import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listCalls } from "@/lib/frontdesk/calls";

// GET /api/frontdesk/calls/recordings — list every CDR row that has a
// recording on disk. Source for the Saved Calls modal. Listing is gated
// by the same requireAuth() as the rest of frontdesk; the modal itself
// only surfaces for admin users (PhoneTab guards the launcher button).
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = listCalls(2000);
  const withRecordings = all.filter(c => c.recordingPath !== null);
  return NextResponse.json({ calls: withRecordings });
}
