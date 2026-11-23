// /api/email/setup — a staff member connecting their own mailbox to Office.
//
//   GET                                  what can be made here (nothing: a new TGV Mailbox is bought
//                                        from the member's own dashboard, where its billing lives)
//   PUT  { setup }                       remember how far they got
//   POST { provider: "fastmail", token } check the key with Fastmail, keep it sealed
//   POST { provider: "fastmail-apps", account, appPassword?, filesPassword? }
//                                        add the app passwords Calendar / Notes / Files need (checked, sealed);
//                                        a mailbox that came from the env token is copied into inbox_accounts
//   POST { provider: "opensrs", email, password }
//                                        sign in to an existing TGV Mailbox, keep it sealed
//   POST { provider: "imap", preset, email, password, imapHost?, imapPort?, smtpHost?, smtpPort? }
//                                        any other mailbox: a preset's servers, or typed ones that
//                                        pass the public-host/TLS rule, checked, kept sealed
//
// Same two rules as tinyglobalvillage.com's copy of this door (its route is the model):
// a server is named by us or passes @tgv/module-inbox/imap/validateHost before it is
// dialled; a secret goes in once, is sealed, and no route returns it. Attempts are
// counted per member. Connecting and failing are both written to the audit log.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { EMAIL_SETUP_START, readSetupProgress } from "@tgv/module-inbox/dock/types";
import { enumerateAccounts, getSession } from "@tgv/module-inbox/fastmail/client";
import { cleanAppPassword, verifyAppPassword } from "@tgv/module-inbox/dav/verify";
import { getProviderResolver } from "@tgv/module-inbox/adapters/provider";
import "@/lib/inbox-setup";
import { OmaClient } from "@tgv/module-inbox/oma/client";
import { imapPreset } from "@tgv/module-inbox/imap/presets";
import { validateHost, validateImapPort, validateSmtpPort } from "@tgv/module-inbox/imap/validateHost";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { inboxReadiness, saveInboxAccount, writeSetup } from "@/lib/inbox/store";
import { logHardeningAction } from "@/lib/audit-log";

const EMAIL_RE = /^[^\s@]{1,64}@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;
const mailHost = () => (process.env.OPENSRS_MAIL_HOST ?? "").trim() || "mail.hostedemail.com";

// Eight tries in ten minutes, per member, in this process.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_TRIES = 8;
const tries = new Map<string, number[]>();
function allowed(memberId: string): boolean {
  const now = Date.now();
  const recent = (tries.get(memberId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_TRIES) { tries.set(memberId, recent); return false; }
  recent.push(now);
  tries.set(memberId, recent);
  return true;
}

const refuse = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const refuseVerify = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  return refuse(
    code === "unauthorized" ? "The mail server did not accept that address and password." : "The mail server could not be reached. Try again in a moment.",
    code === "unauthorized" ? 400 : 502,
  );
};

export async function GET(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return refuse("Sign in to set up email.", 401);
  const state = await inboxReadiness();
  return NextResponse.json({
    ok: true, canCreate: false, domains: [],
    note: state.ready ? "A new TGV Mailbox is set up from your own dashboard. Once it exists, sign in to it here." : state.note,
  });
}

export async function PUT(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return refuse("Sign in to set up email.", 401);
  const state = await inboxReadiness();
  if (!state.ready) return refuse(state.note, 503);
  const body = await req.json().catch(() => null);
  await writeSetup(who.memberId, readSetupProgress(body?.setup));
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const who = await resolveInboxCaller(req);
  if (!who) return refuse("Sign in to set up email.", 401);
  const state = await inboxReadiness();
  if (!state.ready) return refuse(state.note, 503);
  if (!allowed(who.memberId)) return refuse("Too many tries. Wait ten minutes and try again.", 429);

  const body = await req.json().catch(() => null);
  const log = (provider: string, target: string | null, success: boolean) =>
    logHardeningAction({ action: "inbox.account.connect", target, user: who.username, success, details: { provider } });

  if (body?.provider === "fastmail") {
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 16 || token.length > 512 || /\s/.test(token)) return refuse("That does not look like a Fastmail API token.");
    let found;
    try {
      found = await enumerateAccounts(token);
    } catch {
      log("fastmail", null, false);
      return refuse("Fastmail did not accept that key. Check it was copied whole, and that it allows Email.");
    }
    if (found.length === 0) return refuse("That key works, but it cannot see any mail. Give it Email access and try again.");
    // Optional: the app password that adds Calendar and Notes (checked before anything is kept).
    const appPassword = body.appPassword === undefined || body.appPassword === "" ? undefined : cleanAppPassword(body.appPassword);
    if (appPassword === null) return refuse("That does not look like a Fastmail app password.");
    if (appPassword) {
      let loginEmail = "";
      try { loginEmail = (await getSession(token)).username; } catch { /* checked below */ }
      const check = loginEmail ? await verifyAppPassword(loginEmail, appPassword, "caldav") : "unreachable";
      if (check === "auth_failed") return refuse('Fastmail did not accept that app password. Make one with "Mail, Contacts & Calendars" access, or leave it blank for now.');
      if (check === "unreachable") return refuse("Fastmail could not be reached to check the app password. Try again in a moment.", 502);
    }
    for (const a of found) {
      await saveInboxAccount(who.memberId, { email: a.email, label: a.label || a.email, accountKey: a.key, credentials: { provider: "fastmail", token, ...(appPassword ? { appPassword } : {}) } });
      log("fastmail", a.email, true);
    }
    await writeSetup(who.memberId, EMAIL_SETUP_START);
    return NextResponse.json({ ok: true });
  }

  // Add or replace the app passwords of a Fastmail mailbox already connected — what Calendar,
  // Notes (appPassword) and Files (filesPassword) use; the API key cannot reach them.
  if (body?.provider === "fastmail-apps") {
    const accountKey = typeof body.account === "string" ? body.account.slice(0, 200) : "";
    const appPassword = body.appPassword === undefined ? undefined : cleanAppPassword(body.appPassword);
    const filesPassword = body.filesPassword === undefined ? undefined : cleanAppPassword(body.filesPassword);
    if (!accountKey) return refuse("Which mailbox?");
    if (appPassword === null || filesPassword === null || (!appPassword && !filesPassword)) return refuse("That does not look like a Fastmail app password.");
    const acct = await getProviderResolver().resolve(who.username, accountKey);
    if (!acct || acct.credentials.provider !== "fastmail") return refuse("Calendar, Notes and Files work with a Fastmail mailbox.", 404);
    let loginEmail: string;
    try {
      loginEmail = (await getSession(acct.credentials.token)).username;
    } catch {
      return refuse("Fastmail could not be reached. Try again in a moment.", 502);
    }
    for (const [password, service, what] of [[appPassword, "caldav", "Mail, Contacts & Calendars"], [filesPassword, "webdav", "Files"]] as const) {
      if (!password) continue;
      const check = await verifyAppPassword(loginEmail, password, service);
      if (check === "auth_failed") return refuse(`Fastmail did not accept that app password. Make one with "${what}" access and paste it whole.`);
      if (check === "unreachable") return refuse("Fastmail could not be reached to check it. Try again in a moment.", 502);
    }
    await saveInboxAccount(who.memberId, {
      email: acct.email,
      label: acct.email,
      accountKey: acct.accountId,
      credentials: {
        ...acct.credentials,
        ...(appPassword ? { appPassword } : {}),
        ...(filesPassword ? { filesPassword } : {}),
      },
    });
    log("fastmail-apps", acct.email, true);
    return NextResponse.json({ ok: true });
  }

  if (body?.provider === "opensrs" && (body.create === true || body.checkout === true)) {
    return refuse("A new TGV Mailbox is set up from your own dashboard. Once it exists, sign in to it here.");
  }

  if (body?.provider === "opensrs") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_RE.test(email) || email.length > 254) return refuse("Enter the mailbox's full address.");
    if (!password || password.length > 256) return refuse("Enter the mailbox's password.");
    const host = mailHost();
    const creds = { imapHost: host, imapPort: 993, smtpHost: host, smtpPort: 465, username: email, password };
    try {
      await new OmaClient(creds).verify();
    } catch (e) {
      log("oma", email, false);
      return refuseVerify(e);
    }
    await saveInboxAccount(who.memberId, { email, label: email, accountKey: crypto.randomUUID(), credentials: { provider: "oma", ...creds }, tgvManaged: true });
    log("oma", email, true);
    await writeSetup(who.memberId, EMAIL_SETUP_START);
    return NextResponse.json({ ok: true });
  }

  if (body?.provider === "imap") {
    const preset = imapPreset(body.preset);
    if (!preset) return refuse("Choose where the mailbox lives.");
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!EMAIL_RE.test(email) || email.length > 254) return refuse("Enter the mailbox's full address.");
    if (!password || password.length > 256) return refuse("Enter the mailbox's app password.");
    const username = typeof body.username === "string" && body.username.trim() ? body.username.trim().slice(0, 254) : email;

    let hosts: { imapHost: string; imapPort: number; smtpHost: string; smtpPort: number };
    if (preset.hosts) {
      hosts = preset.hosts; // a preset's servers are ours, not the browser's
    } else {
      const imapPort = validateImapPort(body.imapPort);
      const smtpPort = validateSmtpPort(body.smtpPort);
      if (!imapPort) return refuse("The incoming server's port must be 993 or 143.");
      if (!smtpPort) return refuse("The outgoing server's port must be 465 or 587.");
      const imap = await validateHost(body.imapHost);
      if (!imap.ok) return refuse(`Incoming server: ${imap.error}`);
      const smtp = await validateHost(body.smtpHost);
      if (!smtp.ok) return refuse(`Outgoing server: ${smtp.error}`);
      hosts = { imapHost: imap.host, imapPort, smtpHost: smtp.host, smtpPort };
    }
    const creds = { ...hosts, username, password };
    try {
      await new OmaClient(creds).verify();
    } catch (e) {
      log("imap", email, false);
      return refuseVerify(e);
    }
    await saveInboxAccount(who.memberId, { email, label: email, accountKey: crypto.randomUUID(), credentials: { provider: "imap", ...creds }, tgvManaged: false });
    log("imap", email, true);
    await writeSetup(who.memberId, EMAIL_SETUP_START);
    return NextResponse.json({ ok: true });
  }

  return refuse("Choose Fastmail, a TGV Mailbox, or another mailbox by its servers.");
}
