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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await officeMemberAuth.revokeCurrentSession();
  } catch {
    // Best-effort: even if revoke fails, the client still runs NextAuth signOut.
  }
  return NextResponse.json({ ok: true });
}
