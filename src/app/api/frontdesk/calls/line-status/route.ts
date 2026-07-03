import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { EslNotConfigured } from "@/lib/frontdesk/esl";
import { getLineStatus } from "@/lib/frontdesk/recordControl";

// GET /api/frontdesk/calls/line-status — is the shared Front Desk line
// currently on a call, and by whom? Polled by PhoneTab so other staff see
// a "line in use" panel instead of the dialer.
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getLineStatus());
  } catch (err) {
    if (err instanceof EslNotConfigured) {
      return NextResponse.json({ inUse: false, direction: null, agent: null, peer: null });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
