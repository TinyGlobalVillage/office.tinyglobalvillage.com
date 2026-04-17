import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, sendEmail, type AccountKey } from "@/lib/fastmail";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.account || !body?.to || !body?.subject)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const acc = getAccount(body.account as AccountKey);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  if (!acc.personal && token.username !== "admin")
    return NextResponse.json({ error: "access_denied" }, { status: 403 });

  try {
    await sendEmail(acc.token, {
      from: { name: acc.label, email: acc.email },
      to: body.to, cc: body.cc, bcc: body.bcc,
      subject: body.subject,
      textBody: body.textBody, htmlBody: body.htmlBody,
      inReplyTo: body.inReplyTo, references: body.references,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
