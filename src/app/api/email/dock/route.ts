// GET /api/email/dock — what the "Mail accounts" pane needs to draw itself: whether Office can
// keep mailboxes at all, which ones this staff member has connected, and how far they got
// connecting one. Mirrors tinyglobalvillage.com's route; both read the same shared rows.
//
// No secret is in the answer: `oauth` says only whether a "Sign in with" door is open.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { EMAIL_SETUP_START, type EmailDockAccount } from "@tgv/module-inbox/dock/types";
import { getProviderResolver } from "@tgv/module-inbox/adapters/provider";
import "@/lib/inbox-setup";
import { oauthAvailability } from "@tgv/module-inbox/oauth/config";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { inboxReadiness, listInboxAccounts, readSetup } from "@/lib/inbox/store";

/** Every mailbox the drawer opens for this person: their own rows, plus the ones Office set up
 *  for them (the env key), so a mailbox that already works is never asked for again. */
async function allAccounts(username: string, own: EmailDockAccount[]): Promise<EmailDockAccount[]> {
  const seen = new Set(own.map((a) => a.key));
  try {
    const all = await getProviderResolver().listAccountsForUser(username);
    return [...own, ...all.filter((a) => !seen.has(a.accountId)).map((a) => ({ key: a.accountId, email: a.email, label: a.email, provider: a.provider, managed: true }))];
  } catch {
    return own;
  }
}

export async function GET(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await inboxReadiness();
  if (!state.ready) {
    return NextResponse.json({ ready: false, note: state.note, accounts: await allAccounts(who.username, []), setup: EMAIL_SETUP_START, oauth: { google: false, microsoft: false } });
  }
  const [own, setup] = await Promise.all([listInboxAccounts(who.memberId), readSetup(who.memberId)]);
  return NextResponse.json({ ready: true, note: "", accounts: await allAccounts(who.username, own), setup, oauth: oauthAvailability() });
}
