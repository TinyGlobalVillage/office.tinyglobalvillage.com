/**
 * Telnyx Call Control webhook. Telnyx signs every request with Ed25519 —
 * we verify before mutating state. Supported event kinds are the minimum to
 * populate the call log; IVR/consent/dialplan is handled by FreeSWITCH once
 * the ESL bridge is online.
 */
import { type NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/frontdesk/telnyx";
import { createCall, listCalls, patchCall, promoteRingToAll } from "@/lib/frontdesk/calls";
import { resolveInboundDid } from "@/lib/frontdesk/dids";
import { ensureContactStub, findContactByPhone, touchLastContact } from "@/lib/frontdesk/contacts";
import { getShift } from "@/lib/frontdesk/shift";
import type { CallRecord } from "@/lib/frontdesk/types";

/** 30-second single-user ring timeout before we fall back to ring-all. */
const RING_DIRECT_TIMEOUT_MS = 30_000;

type TelnyxCallEvent = {
  data?: {
    event_type?: string;
    payload?: {
      call_control_id?: string;
      from?: string;
      to?: string;
      hangup_cause?: string;
      start_time?: string;
      end_time?: string;
    };
  };
};

function findByCcid(ccid: string): CallRecord | null {
  return listCalls(500).find(c => c.telnyxCallControlId === ccid) ?? null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const ok = await verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("telnyx-signature-ed25519"),
    timestampHeader: req.headers.get("telnyx-timestamp"),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: TelnyxCallEvent;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = body.data?.event_type;
  const p = body.data?.payload;
  const ccid = p?.call_control_id;
  if (!event || !ccid) return NextResponse.json({ ok: true });

  const existing = findByCcid(ccid);

  switch (event) {
    case "call.initiated": {
      if (!existing && p?.from && p?.to) {
        const did = resolveInboundDid(p.to);
        let ringTarget: string | "*" | null = "*";
        if (did?.assignment.kind === "user") {
          ringTarget = did.assignment.username;
        } else if (did?.assignment.kind === "frontdesk") {
          const shift = getShift();
          ringTarget = shift.username ?? "*";
        }
        const record = createCall({
          didId: did?.id ?? null,
          direction: "inbound",
          fromE164: p.from,
          toE164: p.to,
          telnyxCallControlId: ccid,
          ringTarget,
        });
        ensureContactStub(p.from, "call");
        // If we're ringing a single user, schedule the fallback promotion to
        // ring-all. This runs in the request-handling process; it's best-effort
        // and compatible with serverless cold starts (a second webhook or a
        // client-side poll will catch the hand-off either way).
        if (ringTarget && ringTarget !== "*") {
          const callId = record.id;
          setTimeout(() => {
            try {
              const current = listCalls(200).find(c => c.id === callId);
              if (current && !current.answeredAt && !current.endedAt && current.ringTarget !== "*") {
                promoteRingToAll(callId);
              }
            } catch { /* best-effort */ }
          }, RING_DIRECT_TIMEOUT_MS);
        }
      }
      break;
    }
    case "call.answered": {
      if (existing) {
        patchCall(existing.id, { answeredAt: new Date().toISOString(), outcome: "answered", ringTarget: null });
      }
      break;
    }
    case "call.hangup": {
      if (existing) {
        const endedAt = p?.end_time ?? new Date().toISOString();
        const nextOutcome = existing.answeredAt ? "answered" : "missed";
        patchCall(existing.id, { endedAt, outcome: nextOutcome, ringTarget: null });
        const contact = findContactByPhone(existing.fromE164);
        if (contact) touchLastContact(contact.id);
      }
      break;
    }
    default:
      break;
  }
  return NextResponse.json({ ok: true });
}
