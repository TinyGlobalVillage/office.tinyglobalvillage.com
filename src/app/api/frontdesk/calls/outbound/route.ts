import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { toE164 } from "@/lib/frontdesk/store";
import { resolveInboundDid } from "@/lib/frontdesk/dids";
import { createCall } from "@/lib/frontdesk/calls";
import { dialOutbound, TelnyxNotConfigured } from "@/lib/frontdesk/telnyx";
import { findContactByPhone, touchLastContact } from "@/lib/frontdesk/contacts";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => ({}));
  const toE164Num = toE164(String(body.to ?? ""));
  if (!toE164Num) return NextResponse.json({ error: "Invalid destination" }, { status: 400 });

  // Pick the DID this call should originate from. Prefer explicit `didId`, else
  // fall back to the frontdesk-assigned line.
  const fromDidE164 = typeof body.fromE164 === "string" ? toE164(body.fromE164) : null;
  const origin = fromDidE164 ? resolveInboundDid(fromDidE164) : resolveInboundDid("");
  if (!origin) return NextResponse.json({ error: "No front-desk DID available" }, { status: 409 });

  const webhookUrl = new URL("/api/frontdesk/calls/webhook", req.url).toString();

  try {
    const { call_control_id } = await dialOutbound({
      fromE164: origin.e164,
      toE164: toE164Num,
      webhookUrl,
    });
    const record = createCall({
      didId: origin.id,
      direction: "outbound",
      fromE164: origin.e164,
      toE164: toE164Num,
      telnyxCallControlId: call_control_id,
    });
    const contact = findContactByPhone(toE164Num);
    if (contact) touchLastContact(contact.id);
    return NextResponse.json({ call: record, initiatedBy: username });
  } catch (err) {
    if (err instanceof TelnyxNotConfigured) {
      return NextResponse.json({ error: "Telnyx not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
