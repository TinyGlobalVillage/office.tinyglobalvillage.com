// Passkey login verify — MEMBER-AUTH ONLY (2026-06-05 NextAuth retire).
//
// The asserted credential is looked up in member_passkeys (the canonical store)
// and verified by @tgv/module-auth, which issues the member session cookie
// (tgv_member_session, twoFactorVerified=true). There is NO legacy users.json /
// NextAuth-JWT fallback anymore — a passkey that isn't a member passkey is not
// recognized, and an infrastructure error fails CLOSED (503) rather than
// silently falling back. Login is discoverable/usernameless: the credential id
// alone identifies the account.
import { NextRequest, NextResponse } from "next/server";
import {
  readPasskeyAuthChallenge,
  clearPasskeyAuthChallenge,
} from "@/lib/passkey-challenge-cookie";
import { sessionCookieName } from "@/lib/auth-cookie";
import { set2faCookie, TWO_FA_SESSION_TTL_MS } from "@/lib/twofa-cookie";
import { safeDest } from "@/lib/safe-redirect";
import { logAuthEvent } from "@/lib/audit-log";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { usernameForMemberId } from "@/lib/member-auth/bridge";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { response: authResponse, callbackUrl } = body;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (typeof authResponse?.id !== "string" || !authResponse.id) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // Resolve the member passkey by credential id. A DB error here fails CLOSED:
  // there is no fallback store to try, so we surface a transient 503 rather than
  // pretend the credential is unknown (which would read as a security reject).
  let memberPasskey;
  try {
    memberPasskey = await officeMemberAuth.getPasskeyByCredentialId(authResponse.id);
  } catch (e) {
    logAuthEvent({ event: "passkey.assert", username: authResponse.id, success: false, ip, details: { reason: "db_error", error: String(e) } });
    return NextResponse.json({ error: "Service temporarily unavailable. Try again." }, { status: 503 });
  }
  if (!memberPasskey) {
    logAuthEvent({ event: "passkey.assert", username: authResponse.id, success: false, ip, details: { reason: "unknown_credential" } });
    return NextResponse.json({ error: "Passkey not recognized" }, { status: 404 });
  }

  // Staff gate at the point of session minting (defense-in-depth; mirrors
  // recovery/verify's roster gate). Only an Office staff member may mint an
  // Office session — a member whose email isn't on the office-staff roster (e.g.
  // a TGV.com customer with a parent-scoped passkey) is rejected HERE, not left
  // to the downstream getBridgedMember/proxy checks alone. Resolving the
  // username also gives us the human-readable audit/2FA-cookie subject.
  const auname = await usernameForMemberId(memberPasskey.memberId);
  if (!auname) {
    logAuthEvent({ event: "passkey.assert", username: memberPasskey.memberId, success: false, ip, details: { reason: "not_staff" } });
    return NextResponse.json({ error: "Passkey not recognized" }, { status: 404 });
  }

  // Rate-limit per member account (the uuid), NOT the public credential id — a
  // credential id is observable, so keying on it would let anyone DoS a passkey.
  const rlKey = `passkey-assert-member:${memberPasskey.memberId}`;
  if (!rateLimit(rlKey, 10, 15 * 60 * 1000).ok) {
    logAuthEvent({ event: "passkey.assert", username: memberPasskey.memberId, success: false, ip, details: { reason: "rate_limited" } });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const expectedChallenge = readPasskeyAuthChallenge(req);
  if (!expectedChallenge) return NextResponse.json({ error: "No challenge" }, { status: 400 });

  let result: Awaited<ReturnType<typeof officeMemberAuth.loginWithDiscoverablePasskey>>;
  try {
    result = await officeMemberAuth.loginWithDiscoverablePasskey({
      response: authResponse,
      expectedChallenge,
    });
  } catch (e) {
    logAuthEvent({ event: "passkey.assert", username: memberPasskey.memberId, success: false, ip, details: { reason: "db_error", error: String(e) } });
    return NextResponse.json({ error: "Service temporarily unavailable. Try again." }, { status: 503 });
  }

  if (!result.ok) {
    // Known member credential but the assertion failed (bad signature / counter
    // regression) — a security event.
    logAuthEvent({ event: "passkey.assert", username: auname, success: false, ip, details: { reason: result.error } });
    return NextResponse.json({ error: "Verification failed" }, { status: 400 });
  }

  clearRateLimit(rlKey);
  // loginWithDiscoverablePasskey already issued the session (set the
  // tgv_member_session cookie via next/headers). Build the JSON response,
  // clear any stale legacy NextAuth cookie (so nothing can revive a JWT path),
  // set the tgv-2fa proof cookie (legacy per-request gates like the personal
  // inbox still read it), and burn the single-use challenge cookie.
  const res = NextResponse.json({ ok: true, redirectTo: safeDest(callbackUrl) });
  res.cookies.set(sessionCookieName(), "", { maxAge: 0, path: "/" });
  // Match the member session lifetime so the inbox 2FA proof can't expire first.
  set2faCookie(res, auname, TWO_FA_SESSION_TTL_MS);
  clearPasskeyAuthChallenge(res);
  logAuthEvent({ event: "passkey.assert", username: auname, success: true, ip });
  return res;
}
