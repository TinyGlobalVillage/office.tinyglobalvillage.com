// GET /api/email/oauth/<gmail|microsoft>/callback — finish "Sign in with …": check the
// one-use state, exchange the code, keep the refresh token sealed, and return to the
// Inbox's accounts screen with the outcome. Mirrors tinyglobalvillage.com's route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { EMAIL_SETUP_START } from "@tgv/module-inbox/dock/types";
import { OAUTH_PROVIDERS, isOAuthMailKind, oauthClient } from "@tgv/module-inbox/oauth/config";
import { OAUTH_STATE_COOKIE, unpackOAuthStart } from "@tgv/module-inbox/oauth/pkce";
import { exchangeCode, fetchSignedInEmail } from "@tgv/module-inbox/oauth/tokens";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { inboxReadiness, saveInboxAccount, writeSetup } from "@/lib/inbox/store";
import { officeBase } from "@/lib/inbox/base";
import { logHardeningAction } from "@/lib/audit-log";

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isOAuthMailKind(kind)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const base = officeBase(req);
  const home = (reason: string) => {
    const u = new URL("/dashboard", base);
    u.searchParams.set("tile", "Inbox");
    u.searchParams.set("view", "accounts");
    u.searchParams.set("email", reason);
    return NextResponse.redirect(u.toString(), 302);
  };

  const client = oauthClient(kind);
  if (!client) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  const jar = await cookies();
  const started = unpackOAuthStart(jar.get(OAUTH_STATE_COOKIE)?.value);
  jar.set(OAUTH_STATE_COOKIE, "", { path: "/api/email/oauth", httpOnly: true, sameSite: "lax", maxAge: 0 }); // one use

  const who = await resolveInboxCaller(req);
  if (!who) return home("signed-out");
  const state = await inboxReadiness();
  if (!state.ready) return home("off");

  const q = req.nextUrl.searchParams;
  if (q.get("error")) return home("declined");
  const code = q.get("code") ?? "";
  const echoed = q.get("state") ?? "";
  if (!started || started.kind !== kind || !code || !echoed || echoed !== started.state) return home("mismatch");

  const p = OAUTH_PROVIDERS[kind];
  let grant;
  try {
    grant = await exchangeCode(p, client, { code, redirectUri: `${base}/api/email/oauth/${kind}/callback`, verifier: started.verifier });
  } catch {
    return home("failed");
  }
  if (!grant.refreshToken) return home("no-refresh");
  const email = await fetchSignedInEmail(p, grant.accessToken);
  if (!email) return home("no-address");

  await saveInboxAccount(who.memberId, { email, label: email, accountKey: crypto.randomUUID(), credentials: { provider: kind, refreshToken: grant.refreshToken, email }, tgvManaged: false });
  logHardeningAction({ action: "inbox.account.connect", target: email, user: who.username, success: true, details: { provider: kind } });
  await writeSetup(who.memberId, EMAIL_SETUP_START);
  return home("connected");
}
