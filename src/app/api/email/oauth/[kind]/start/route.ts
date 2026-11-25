// GET /api/email/oauth/<gmail|microsoft>/start — begin "Sign in with …" for a staff
// member's own mailbox. Closed (503) until that provider's app registration is in the
// environment. Mirrors tinyglobalvillage.com's route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { OAUTH_PROVIDERS, isOAuthMailKind, oauthClient } from "@tgv/module-inbox/oauth/config";
import { OAUTH_STATE_COOKIE, OAUTH_STATE_MAX_AGE_S, authorizeUrl, packOAuthStart, pkcePair, randomToken } from "@tgv/module-inbox/oauth/pkce";
import { resolveInboxCaller } from "@/lib/inbox/caller";
import { inboxReadiness } from "@/lib/inbox/store";
import { officeBase } from "@/lib/inbox/base";

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isOAuthMailKind(kind)) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  const client = oauthClient(kind);
  if (!client) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  const who = await resolveInboxCaller(req);
  if (!who) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const state = await inboxReadiness();
  if (!state.ready) return NextResponse.json({ ok: false, error: state.note }, { status: 503 });

  const redirectUri = `${officeBase(req)}/api/email/oauth/${kind}/callback`;
  const nonce = randomToken(24);
  const { verifier, challenge } = pkcePair();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, packOAuthStart({ kind, state: nonce, verifier, iat: Math.floor(Date.now() / 1000) }), {
    path: "/api/email/oauth", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: OAUTH_STATE_MAX_AGE_S,
  });
  return NextResponse.redirect(authorizeUrl(OAUTH_PROVIDERS[kind], { clientId: client.clientId, redirectUri, state: nonce, challenge }), 302);
}
