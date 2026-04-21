import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getCall, patchCall } from "@/lib/frontdesk/calls";
import { answerCall, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => ({}));
  const callId = String(body.callId ?? "");
  const call = callId ? getCall(callId) : null;
  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  if (call.answeredAt) return NextResponse.json({ error: "Already answered" }, { status: 409 });
  if (call.endedAt) return NextResponse.json({ error: "Call already ended" }, { status: 410 });

  if (call.telnyxCallControlId) {
    try {
      await answerCall(call.telnyxCallControlId);
    } catch (err) {
      if (!(err instanceof TelnyxNotConfigured)) {
        return NextResponse.json({ error: (err as Error).message }, { status: 502 });
      }
    }
  }

  const now = new Date().toISOString();
  const updated = patchCall(call.id, {
    answeredAt: now,
    answeredBy: username,
    outcome: "answered",
    ringTarget: null,
  });
  return NextResponse.json({ call: updated });
}
