/**
 * Telnyx Messaging webhook. Inbound SMS to one of our DIDs lands here —
 * we verify the Ed25519 signature, persist the message, and auto-create a
 * stub contact if the sender isn't already known.
 *
 * Diagnostic logging: every inbound (success or failure) writes one line to
 * stdout so PM2 logs surface what happened. If signature verification fails,
 * we log WHICH header was missing / mismatched so we can fix env quickly.
 */
import { type NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/frontdesk/telnyx";
import { appendMessage } from "@/lib/frontdesk/sms";
import { ensureContactStub, touchLastContact } from "@/lib/frontdesk/contacts";
import { emitInbound } from "@/lib/frontdesk/sms-bus";

type TelnyxInboundSms = {
  data?: {
    event_type?: string;
    payload?: {
      id?: string;
      from?: { phone_number?: string };
      to?: Array<{ phone_number?: string }>;
      text?: string;
    };
  };
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sigHeader = req.headers.get("telnyx-signature-ed25519");
  const tsHeader = req.headers.get("telnyx-timestamp");
  const ok = await verifyWebhookSignature({
    rawBody,
    signatureHeader: sigHeader,
    timestampHeader: tsHeader,
  });
  if (!ok) {
    console.warn(
      `[frontdesk/sms/webhook] signature verification FAILED — sig=${sigHeader ? "present" : "MISSING"} ts=${tsHeader ?? "MISSING"} pubKey=${process.env.TELNYX_PUBLIC_KEY ? "set" : "MISSING"} bodyLen=${rawBody.length}`
    );
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: TelnyxInboundSms;
  try {
    body = JSON.parse(rawBody);
  } catch {
    console.warn(`[frontdesk/sms/webhook] invalid JSON body, len=${rawBody.length}`);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = body.data?.event_type ?? "(none)";
  if (body.data?.event_type !== "message.received") {
    console.log(`[frontdesk/sms/webhook] non-receive event ignored: ${eventType}`);
    return NextResponse.json({ ok: true });
  }

  const p = body.data?.payload;
  const from = p?.from?.phone_number;
  const to = p?.to?.[0]?.phone_number;
  const text = p?.text ?? "";
  if (!from || !to) {
    console.warn(`[frontdesk/sms/webhook] missing from/to — from=${from} to=${to}`);
    return NextResponse.json({ ok: true });
  }

  appendMessage({
    direction: "inbound",
    fromE164: from,
    toE164: to,
    body: text,
    sentBy: null,
    telnyxMessageId: p?.id ?? null,
  });
  const contact = ensureContactStub(from, "sms");
  if (contact) touchLastContact(contact.id);

  // Notify SSE subscribers so the SmsTab refreshes without polling.
  emitInbound({
    fromE164: from,
    toE164: to,
    body: text,
    receivedAt: new Date().toISOString(),
  });

  console.log(`[frontdesk/sms/webhook] inbound from=${from} to=${to} bytes=${text.length}`);
  return NextResponse.json({ ok: true });
}
