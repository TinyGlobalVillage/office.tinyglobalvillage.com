// GET /api/auth/oidc/callback — finish the Keycloak login (D11).
//
// Exchanges the code, verifies the ID token, mirrors the identity into
// `members` (Model B upsert), mints the LOCAL member session, then bounces to
// the transaction's returnTo. If the freshly-minted session does not RESOLVE
// (Office resolves ONLY operator identities (platform surface: role gate in
// the session chokepoint) — a non-operator identity resolves null: revoked and
// the visitor lands on /login?error=not_a_member — which must NOT auto-bounce
// back to Keycloak, or a live SSO cookie would loop forever.
import { NextRequest, NextResponse } from "next/server";
import { AUTH_IDP, memberOidc } from "@/lib/member-auth/oidc";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { usernameForMemberId } from "@/lib/member-auth/bridge";
import { set2faCookie, TWO_FA_SESSION_TTL_MS } from "@/lib/twofa-cookie";

const { getActiveSession, revokeCurrentSession } = officeMemberAuth;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (AUTH_IDP !== "keycloak") return new NextResponse(null, { status: 404 });

  const result = await memberOidc.handleCallback(req.url);
  const dest = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));

  if (!result.ok) {
    // `login_required` = a prompt=none probe with no live SSO session.
    if (result.error.includes("login_required")) return dest(result.returnTo ?? "/");
    return dest(`/login?error=oidc_${encodeURIComponent(result.error.slice(0, 64))}`);
  }

  // Tenant-scoping check (D15): the session chokepoint decides, not the IdP.
  const session = await getActiveSession();
  if (!session) {
    await revokeCurrentSession();
    return dest("/login?error=not_a_member");
  }

  // Office-specific: legacy per-request gates (personal inbox) read the
  // tgv-2fa proof cookie — the local passkey path sets it at login, so the
  // OIDC path must too (a Keycloak passkey login is inherently 2FA). Only
  // roster-bridged operators get one; a plain member resolves no username
  // and simply carries the shared session (same as arriving from tgv.com).
  const res = dest(result.returnTo);
  const username = await usernameForMemberId(result.userId);
  if (username) set2faCookie(res, username, TWO_FA_SESSION_TTL_MS);
  return res;
}
