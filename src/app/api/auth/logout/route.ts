// POST /api/auth/logout
//
// Member-session logout. Deletes the current member_sessions row AND clears the
// shared tgv_member_session cookie (Domain=.tinyglobalvillage.com). Because the
// session ROW is deleted and the cookie is shared, this logs the user out of
// BOTH office.tinyglobalvillage.com and tinyglobalvillage.com at once (SSO
// logout). The client should ALSO call NextAuth signOut() to clear the legacy
// JWT for users still on the NextAuth fallback path.

import { NextResponse } from "next/server";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { memberOidc } from "@/lib/member-auth/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // RP-initiated logout (canon 2026-07-02): an OIDC-minted session also ends
  // the Keycloak SSO session — callers navigate to logoutUrl when present.
  // Local-ceremony sessions carry no id_token → logoutUrl stays null and
  // behavior is unchanged.
  let logoutUrl: string | null = null;
  try {
    const idToken = await officeMemberAuth.getCurrentSessionIdToken();
    await officeMemberAuth.revokeCurrentSession();
    if (idToken) logoutUrl = await memberOidc.buildLogoutUrl({ idToken });
  } catch {
    // Best-effort: even if revoke fails, the client still runs NextAuth signOut.
  }
  return NextResponse.json({ ok: true, logoutUrl });
}
