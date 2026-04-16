import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, listMessages, getMessage, markRead, type AccountKey } from "@/lib/fastmail";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const key = params.get("account") as AccountKey | null;
  if (!key) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const acc = getAccount(key);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check !== "ok") return NextResponse.json({ error: check }, { status: 403 });
  }

  const emailId = params.get("id");

  try {
    if (emailId) {
      const email = await getMessage(acc.token, emailId);
      if (email.unread) await markRead(acc.token, emailId, true).catch(() => {});
      return NextResponse.json({ email });
    }

    const mailboxId = params.get("mailboxId");
    if (!mailboxId) return NextResponse.json({ error: "Missing mailboxId" }, { status: 400 });

    const limit = Math.min(parseInt(params.get("limit") ?? "30", 10), 100);
    const position = parseInt(params.get("position") ?? "0", 10);
    const result = await listMessages(acc.token, { mailboxId, limit, position });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
