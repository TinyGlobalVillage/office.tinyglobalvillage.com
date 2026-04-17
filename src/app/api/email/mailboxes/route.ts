import { type NextRequest, NextResponse } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { getAccount, listMailboxes, type AccountKey } from "@/lib/fastmail";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const key = req.nextUrl.searchParams.get("account") as AccountKey | null;
  if (!key) return NextResponse.json({ error: "Missing account" }, { status: 400 });

  const acc = getAccount(key);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal) {
    const check = requirePersonalAccess(req, acc.ownerUsername!, token.username);
    if (check === "access_denied") return NextResponse.json({ error: "access_denied" }, { status: 403 });
    if (check === "2fa_required") return NextResponse.json({ error: "2fa_required" }, { status: 403 });
  }

  if (!acc.personal && token.username !== "admin")
    return NextResponse.json({ error: "access_denied" }, { status: 403 });

  try {
    const mailboxes = await listMailboxes(acc.token);
    return NextResponse.json({ mailboxes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
