import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getCall, patchCall, promoteRingToAll } from "@/lib/frontdesk/calls";
import { hangupCall, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";

/**
 * POST /api/frontdesk/calls/reject
 * Body: { callId, action: "decline" | "voicemail" | "passToTeam" }
 *
 *   decline     — hangs up the call with "declined".
 *   voicemail   — transfers to voicemail; outcome="voicemail".
 *   passToTeam  — promotes ringTarget to "*" so everyone online rings;
 *                 matches the 30s fallback behavior.
 */
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const callId = String(body.callId ?? "");
  const action = String(body.action ?? "decline") as "decline" | "voicemail" | "passToTeam";
  const call = callId ? getCall(callId) : null;
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.endedAt) return NextResponse.json({ error: "Call already ended" }, { status: 410 });

  if (action === "passToTeam") {
    const promoted = promoteRingToAll(call.id);
    return NextResponse.json({ call: promoted });
  }

  if (call.telnyxCallControlId) {
    try {
      // Voicemail routing is owned by the FreeSWITCH dialplan — here we simply
      // end the current bridge so control reverts to the IVR.
      await hangupCall(call.telnyxCallControlId);
    } catch (err) {
      if (!(err instanceof TelnyxNotConfigured)) {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 });
      }
    }
  }

  const now = new Date().toISOString();
  const outcome = action === "voicemail" ? "voicemail" : "declined";
  const updated = patchCall(call.id, {
    endedAt: now,
    outcome,
    ringTarget: null,
  });
  return NextResponse.json({ call: updated });
}
