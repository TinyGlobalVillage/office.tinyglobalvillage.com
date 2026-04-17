import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getAccount, getAccounts, getSession, type AccountKey } from "@/lib/fastmail";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const loggedInUser = token.username;
  const key = req.nextUrl.searchParams.get("account") as AccountKey | null;

  if (!key) {
    const accounts = getAccounts()
      .filter((a) => {
        if (a.personal) return a.ownerUsername === loggedInUser;
        return loggedInUser === "admin";
      })
      .map(({ key, email, label, personal, token: t }) => ({
        key, email, label, personal,
        configured: Boolean(t),
      }));
    return NextResponse.json({ accounts, defaultAccount: accounts.find((a) => a.personal)?.key ?? accounts[0]?.key ?? null });
  }

  const acc = getAccount(key);
  if (!acc.token) return NextResponse.json({ error: "Account not configured" }, { status: 503 });

  if (acc.personal && acc.ownerUsername !== loggedInUser)
    return NextResponse.json({ error: "access_denied" }, { status: 403 });
  if (!acc.personal && loggedInUser !== "admin")
    return NextResponse.json({ error: "access_denied" }, { status: 403 });

  try {
    const jmapSession = await getSession(acc.token);
    return NextResponse.json({
      key: acc.key, email: acc.email, label: acc.label, personal: acc.personal,
      accountId: jmapSession.accountId, username: jmapSession.username,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
