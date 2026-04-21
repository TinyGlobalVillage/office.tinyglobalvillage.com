import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { toE164 } from "@/lib/frontdesk/store";
import { resolveInboundDid } from "@/lib/frontdesk/dids";
import { appendMessage } from "@/lib/frontdesk/sms";
import { sendSms, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";
import { ensureContactStub, touchLastContact } from "@/lib/frontdesk/contacts";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => ({}));
  const to = toE164(String(body.to ?? ""));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!to) return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "Message body required" }, { status: 400 });

  const fromHint = typeof body.fromE164 === "string" ? toE164(body.fromE164) : null;
  const origin = fromHint ? resolveInboundDid(fromHint) : resolveInboundDid("");
  if (!origin) return NextResponse.json({ error: "No front-desk DID available" }, { status: 409 });

  let telnyxMessageId: string | null = null;
  try {
    const res = await sendSms({ fromE164: origin.e164, toE164: to, body: text });
    telnyxMessageId = res.data?.id ?? null;
  } catch (err) {
    if (err instanceof TelnyxNotConfigured) {
      return NextResponse.json({ error: "Telnyx not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }

  const msg = appendMessage({
    direction: "outbound",
    fromE164: origin.e164,
    toE164: to,
    body: text,
    sentBy: username,
    telnyxMessageId,
  });
  const contact = ensureContactStub(to, "sms");
  touchLastContact(contact.id);
  return NextResponse.json({ message: msg });
}
