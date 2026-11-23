// DELETE /api/email/accounts?key=… — disconnect one of this staff member's own mailboxes.
// The mail is untouched where it lives; the sealed credentials are deleted here.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { removeInboxAccount } from "@/lib/inbox/store";
import { logHardeningAction } from "@/lib/audit-log";

export async function DELETE(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return NextResponse.json({ ok: false, error: "Sign in first." }, { status: 401 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!key || key.length > 200) return NextResponse.json({ ok: false, error: "Which mailbox?" }, { status: 400 });
  const gone = await removeInboxAccount(who.memberId, key);
  if (gone) logHardeningAction({ action: "inbox.account.disconnect", target: key, user: who.username, success: true });
  return gone
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ ok: false, error: "That mailbox is not connected." }, { status: 404 });
}
