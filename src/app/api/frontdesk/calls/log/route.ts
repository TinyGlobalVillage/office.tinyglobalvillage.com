import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { toE164 } from "@/lib/frontdesk/store";
import { getDidByE164 } from "@/lib/frontdesk/dids";
import { createCall, patchCall } from "@/lib/frontdesk/calls";
import type { CallDirection, CallOutcome } from "@/lib/frontdesk/types";

// Client-side log endpoint for calls placed/received via the sovereign
// SIP.js → FreeSWITCH → Telnyx gateway path (i.e. not the Telnyx Call
// Control API, which has its own webhook-driven logging).
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const direction = (body.direction === "inbound" ? "inbound" : "outbound") as CallDirection;
  const fromE164Num = toE164(String(body.fromE164 ?? ""));
  const toE164Num = toE164(String(body.toE164 ?? ""));
  if (!fromE164Num || !toE164Num) {
    return NextResponse.json({ error: "Invalid from/to" }, { status: 400 });
  }

  const did = getDidByE164(direction === "outbound" ? fromE164Num : toE164Num);
  const outcome = (body.outcome ?? "answered") as CallOutcome;
  const endedAt = typeof body.endedAt === "string" ? body.endedAt : new Date().toISOString();
  const answeredAt = typeof body.answeredAt === "string" ? body.answeredAt : null;

  const record = createCall({
    didId: did?.id ?? null,
    direction,
    fromE164: fromE164Num,
    toE164: toE164Num,
  });
  patchCall(record.id, {
    answeredAt,
    endedAt,
    outcome,
    answeredBy: token.username ?? null,
    ringTarget: null,
  });

  return NextResponse.json({ ok: true, id: record.id });
}
