import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, markRead, markFlagged, moveToMailbox, listMailboxes, type AccountKey } from "@/lib/fastmail";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.account || !body?.action || !body?.emailId)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const acc = getAccount(body.account as AccountKey);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  try {
    switch (body.action as string) {
      case "markRead":   await markRead(acc.token, body.emailId, true); break;
      case "markUnread": await markRead(acc.token, body.emailId, false); break;
      case "flag":       await markFlagged(acc.token, body.emailId, true); break;
      case "unflag":     await markFlagged(acc.token, body.emailId, false); break;
      case "move":
        if (!body.mailboxId) return NextResponse.json({ error: "Missing mailboxId" }, { status: 400 });
        await moveToMailbox(acc.token, body.emailId, body.mailboxId);
        break;
      case "trash": {
        const mailboxes = await listMailboxes(acc.token);
        const trashId = mailboxes.find((m) => m.role === "trash")?.id;
        if (!trashId) return NextResponse.json({ error: "No trash mailbox" }, { status: 502 });
        await moveToMailbox(acc.token, body.emailId, trashId);
        break;
      }
      default: return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
