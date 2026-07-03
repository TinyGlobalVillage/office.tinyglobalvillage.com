import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { EslNotConfigured } from "@/lib/frontdesk/esl";
import {
  resolveAnchorByCallId,
  startSegment,
  stopSegment,
  getAnchorCallerNumber,
  resolveExistingRecording,
} from "@/lib/frontdesk/recordControl";
import { appendSegmentToOpenInboundCall } from "@/lib/frontdesk/calls";
import { toE164 } from "@/lib/frontdesk/store";

// Mid-call recording control (record-toggle, 2026-07-02).
//   GET  ?callId=<sip-call-id>          → { active, recordingFile } status
//   POST { callId, action: start|stop } → toggle; start opens a NEW segment
//                                          file, stop ends + keeps the
//                                          current one.
// The Call-ID is matched against live FreeSWITCH channels server-side; it is
// never interpolated into an ESL command, so a forged id can at worst toggle
// recording on the caller's own authenticated Front Desk call — and any
// authed staff user could do that from the UI anyway.

function errorResponse(err: unknown): NextResponse {
  if (err instanceof EslNotConfigured) {
    return NextResponse.json({ error: "Recording control not configured (ESL)" }, { status: 503 });
  }
  return NextResponse.json({ error: (err as Error).message ?? "ESL error" }, { status: 502 });
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const callId = new URL(req.url).searchParams.get("callId") ?? "";
  if (!callId.trim()) return NextResponse.json({ error: "callId required" }, { status: 400 });

  try {
    const anchor = await resolveAnchorByCallId(callId);
    if (!anchor) return NextResponse.json({ error: "no live channel for callId" }, { status: 404 });
    return NextResponse.json({
      active: anchor.active,
      recordingFile: anchor.recordingFile,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const callId = typeof body.callId === "string" ? body.callId : "";
  const action =
    body.action === "start" || body.action === "stop" || body.action === "attach"
      ? body.action
      : null;
  if (!action || (action !== "attach" && !callId.trim())) {
    return NextResponse.json({ error: "callId and action (start|stop|attach) required" }, { status: 400 });
  }

  // attach — post-hangup CDR linkage for INBOUND calls (their CDR belongs to
  // the Telnyx webhook, which never learns recording paths; the browser does,
  // via the status GET at answer). The channel is gone by now, so paths are
  // validated against the recordings dir (basename jail + must exist) instead
  // of FreeSWITCH, and the match window tolerates a webhook-closed CDR.
  if (action === "attach") {
    const fromE164 = toE164(String(body.fromE164 ?? ""));
    const rawPaths: string[] = Array.isArray(body.paths)
      ? (body.paths as unknown[]).filter((p): p is string => typeof p === "string" && p.length < 512).slice(0, 50)
      : [];
    if (!fromE164 || rawPaths.length === 0) {
      return NextResponse.json({ error: "fromE164 and paths[] required" }, { status: 400 });
    }
    let attached = 0;
    for (const p of rawPaths) {
      if (!resolveExistingRecording(p)) continue;
      if (appendSegmentToOpenInboundCall(fromE164, p, { allowEndedWithinMs: 120_000 })) attached++;
    }
    return NextResponse.json({ ok: true, action, attached });
  }

  try {
    const anchor = await resolveAnchorByCallId(callId);
    if (!anchor) return NextResponse.json({ error: "no live channel for callId" }, { status: 404 });

    if (action === "start") {
      const file = await startSegment(anchor);
      return NextResponse.json({ ok: true, action, active: true, path: file || null });
    }
    const file = await stopSegment(anchor);
    // Inbound CDRs exist during the call but no client posts recording
    // fields for them at hangup — attach the finished segment server-side
    // so it shows up in Saved Recordings. Outbound rows don't exist yet
    // (browser logs them at hangup with the full segment list).
    if (file) {
      try {
        const caller = await getAnchorCallerNumber(anchor);
        const callerE164 = caller ? toE164(caller) : null;
        if (callerE164) appendSegmentToOpenInboundCall(callerE164, file);
      } catch { /* best-effort — outbound path still links via calls/log */ }
    }
    return NextResponse.json({ ok: true, action, active: false, path: file });
  } catch (err) {
    return errorResponse(err);
  }
}
