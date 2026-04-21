/**
 * Telnyx Messaging webhook. Inbound SMS to one of our DIDs lands here —
 * we verify the Ed25519 signature, persist the message, and auto-create a
 * stub contact if the sender isn't already known.
 */
import { type NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/frontdesk/telnyx";
import { appendMessage } from "@/lib/frontdesk/sms";
import { ensureContactStub, touchLastContact } from "@/lib/frontdesk/contacts";

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
  const ok = await verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("telnyx-signature-ed25519"),
    timestampHeader: req.headers.get("telnyx-timestamp"),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let body: TelnyxInboundSms;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.data?.event_type !== "message.received") {
    return NextResponse.json({ ok: true });
  }

  const p = body.data?.payload;
  const from = p?.from?.phone_number;
  const to = p?.to?.[0]?.phone_number;
  const text = p?.text ?? "";
  if (!from || !to) return NextResponse.json({ ok: true });

  appendMessage({
    direction: "inbound",
    fromE164: from,
    toE164: to,
    body: text,
    sentBy: null,
    telnyxMessageId: p?.id ?? null,
  });
  const contact = ensureContactStub(from, "sms");
  touchLastContact(contact.id);
  return NextResponse.json({ ok: true });
}
