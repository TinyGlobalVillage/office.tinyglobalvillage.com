import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, getSession, jmapRequest, listMailboxes, type AccountKey } from "@/lib/fastmail";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.account) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const acc = getAccount(body.account as AccountKey);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  try {
    const mailboxes = await listMailboxes(acc.token);
    const draftsId = mailboxes.find((m) => m.role === "drafts")?.id;
    if (!draftsId) return NextResponse.json({ error: "No drafts mailbox" }, { status: 502 });

    const session = await getSession(acc.token);
    const accountId = session.accountId;

    const bodyParts: Record<string, unknown>[] = [];
    const bodyValues: Record<string, { value: string }> = {};
    if (body.textBody) { bodyParts.push({ partId: "text", type: "text/plain" }); bodyValues.text = { value: body.textBody }; }

    const email: Record<string, unknown> = {
      from: [{ name: acc.label, email: acc.email }],
      to: body.to ?? [],
      cc: body.cc ?? [],
      bcc: body.bcc ?? [],
      subject: body.subject ?? "",
      mailboxIds: { [draftsId]: true },
      keywords: { "$draft": true },
    };
    if (bodyParts.length) {
      email.bodyStructure = bodyParts.length === 1 ? bodyParts[0] : { type: "multipart/alternative", subParts: bodyParts };
      email.bodyValues = bodyValues;
    }

    await jmapRequest(acc.token, [
      ["Email/set", { accountId, create: { draft: email } }, "create"],
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
