/**
 * Internal-only send endpoint for the scheduled email cron dispatcher.
 * Gated by X-Internal-Cron header — never exposed to the browser.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getAccount, sendEmail, type AccountKey } from "@/lib/fastmail";

export async function POST(req: NextRequest) {
  // Only allow from localhost cron (no session required)
  if (req.headers.get("x-internal-cron") !== "1")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body?.account || !body?.to || !body?.subject)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const acc = getAccount(body.account as AccountKey);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  try {
    await sendEmail(acc.token, {
      from: { name: acc.label, email: acc.email },
      to: body.to, cc: body.cc, bcc: body.bcc,
      subject: body.subject,
      textBody: body.textBody,
      inReplyTo: body.inReplyTo,
      references: body.references,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
