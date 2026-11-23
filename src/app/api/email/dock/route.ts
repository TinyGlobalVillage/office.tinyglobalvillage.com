// GET /api/email/dock — what the "Mail accounts" pane needs to draw itself: whether Office can
// keep mailboxes at all, which ones this staff member has connected, and how far they got
// connecting one. Mirrors tinyglobalvillage.com's route; both read the same shared rows.
//
// No secret is in the answer: `oauth` says only whether a "Sign in with" door is open.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { EMAIL_SETUP_START } from "@tgv/module-inbox/dock/types";
import { oauthAvailability } from "@tgv/module-inbox/oauth/config";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { inboxReadiness, listInboxAccounts, readSetup } from "@/lib/inbox/store";

export async function GET(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const state = await inboxReadiness();
  if (!state.ready) {
    return NextResponse.json({ ready: false, note: state.note, accounts: [], setup: EMAIL_SETUP_START, oauth: { google: false, microsoft: false } });
  }
  const [accounts, setup] = await Promise.all([listInboxAccounts(who.memberId), readSetup(who.memberId)]);
  return NextResponse.json({ ready: true, note: "", accounts, setup, oauth: oauthAvailability() });
}
