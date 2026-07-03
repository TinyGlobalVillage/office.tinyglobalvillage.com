// POST /api/auth/signout — next-auth/react signOut() shim (refusionist parity).
//
// Office's TopNav SignOutBtn (and any shared-module surface) hard-calls
// next-auth/react's `signOut({ callbackUrl })`, which POSTs HERE and then
// navigates to the JSON `url` we return. Without this file the POST fell
// through to the [...nextauth] catch-all, which cleared a NextAuth cookie
// that was never set — the real member session (tgv_member_session +
// member_sessions row) AND the Keycloak SSO session both survived, so /login
// silently re-minted a session and "sign out" bounced straight back in
// (Gio hit it live 2026-07-03). A static route shadows the catch-all at this
// exact path.
//
// (We own this endpoint, so the next-auth CSRF token is not validated; the
// session cookie is httpOnly + SameSite=Lax, and this only ever DELETES the
// caller's own session.)
import { NextRequest, NextResponse } from "next/server";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { memberOidc } from "@/lib/member-auth/oidc";
import { safeDest } from "@/lib/safe-redirect";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const idToken = await officeMemberAuth.getCurrentSessionIdToken();
  await officeMemberAuth.revokeCurrentSession();
  let callbackUrl: string | null = null;
  try {
    const form = await req.formData();
    callbackUrl = (form.get("callbackUrl") as string) ?? null;
  } catch {
    // next-auth always sends a urlencoded body, but tolerate a missing one.
  }
  // RP-initiated logout (canon 2026-07-02): an OIDC-minted session also ends
  // the Keycloak SSO session — navigate to the end-session URL (an absolute
  // IdP URL, deliberately NOT safeDest'd; Keycloak then redirects back to the
  // registered post-logout URI). Sessions without an id_token (local-ceremony
  // break-glass, admin-minted) keep the original same-origin bounce.
  if (idToken) {
    return NextResponse.json({ url: await memberOidc.buildLogoutUrl({ idToken }) });
  }
  // next-auth/react signOut reads `data.url` and sets window.location.href.
  return NextResponse.json({ url: safeDest(callbackUrl, "/login") });
}
