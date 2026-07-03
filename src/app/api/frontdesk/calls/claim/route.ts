import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { EslNotConfigured } from "@/lib/frontdesk/esl";
import { setAgentByCallId } from "@/lib/frontdesk/recordControl";

// POST /api/frontdesk/calls/claim { callId } — the tab that ANSWERS an
// inbound call tags its channel with the session's username so the
// line-status busy panel can say who is on the line. The agent value is
// server-derived from the auth token, never client-supplied.
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const callId = typeof body.callId === "string" ? body.callId : "";
  const username = token.username ?? token.sub ?? "";
  if (!callId.trim() || !username) {
    return NextResponse.json({ error: "callId required" }, { status: 400 });
  }
  try {
    const ok = await setAgentByCallId(callId, username);
    return NextResponse.json({ ok });
  } catch (err) {
    if (err instanceof EslNotConfigured) return NextResponse.json({ ok: false });
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
