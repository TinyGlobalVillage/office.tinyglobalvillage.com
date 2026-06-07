// Break-glass login: redeem a single-use recovery code when no passkey is
// available. Public (no prior session) — the recovery code IS the credential.
// Proof of a valid code mints a member session + the 2FA cookie, just like a
// passkey assertion. Hard rate-limited; account-enumeration-safe.
//
// MEMBER-AUTH ONLY (2026-06-05 NextAuth retire): codes are verified against the
// canonical member store (officeMemberAuth.loginWithRecoveryCode). The legacy
// users.json recovery path was removed — an unknown user or wrong code returns
// the same generic error (no enumeration), and an infra error fails CLOSED.

import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "@/lib/auth-cookie";
import { set2faCookie, TWO_FA_SESSION_TTL_MS } from "@/lib/twofa-cookie";
import { safeDest } from "@/lib/safe-redirect";
import { logAuthEvent } from "@/lib/audit-log";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { rosterEmailForUsername } from "@/lib/member-auth/bridge";
import { officeMemberAuth } from "@/lib/member-auth/config";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { username, code, callbackUrl } = body;
  if (typeof username !== "string" || typeof code !== "string") {
    return NextResponse.json({ error: "Username and code required" }, { status: 400 });
  }

  // Rate limit per-user and per-IP to blunt brute force.
  const rlUser = rateLimit(`recovery:${username}`, 5, WINDOW_MS);
  const rlIp = ip ? rateLimit(`recovery-ip:${ip}`, 20, WINDOW_MS) : { ok: true };
  if (!rlUser.ok || !rlIp.ok) {
    logAuthEvent({ event: "recovery.redeem", username, success: false, ip, details: { reason: "rate_limited" } });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  // Resolve the roster email for this Office username, then redeem against the
  // canonical member recovery codes. An unknown username and a wrong code are
  // indistinguishable to the caller (no account enumeration).
  const email = rosterEmailForUsername(username);
  if (!email) {
    logAuthEvent({ event: "recovery.redeem", username, success: false, ip, details: { reason: "unknown_user" } });
    return NextResponse.json({ error: "Invalid recovery code." }, { status: 400 });
  }

  let r: Awaited<ReturnType<typeof officeMemberAuth.loginWithRecoveryCode>>;
  try {
    r = await officeMemberAuth.loginWithRecoveryCode({ email, code });
  } catch {
    // Fail CLOSED on an infra error — there is no fallback store to retry.
    logAuthEvent({ event: "recovery.redeem", username, success: false, ip, details: { reason: "db_error" } });
    return NextResponse.json({ error: "Service temporarily unavailable. Try again." }, { status: 503 });
  }

  if (r.ok) {
    clearRateLimit(`recovery:${username}`);
    const res = NextResponse.json({
      ok: true,
      redirectTo: safeDest(callbackUrl),
      remaining: r.remaining,
      low: r.remaining <= 2,
    });
    // The member session carries twoFactorVerified; also set the legacy tgv-2fa
    // proof cookie (requirePersonalAccess etc.) and clear any stale NextAuth
    // session so nothing can revive the JWT path.
    set2faCookie(res, username, TWO_FA_SESSION_TTL_MS);
    res.cookies.set(sessionCookieName(), "", { maxAge: 0, path: "/" });
    logAuthEvent({ event: "recovery.redeem", username, success: true, ip, details: { remaining: r.remaining } });
    return res;
  }

  if (r.error === "conflict_retry") {
    return NextResponse.json({ error: "Please try again." }, { status: 409 });
  }

  // invalid_code — a clean miss. Same generic error as unknown user.
  logAuthEvent({ event: "recovery.redeem", username, success: false, ip, details: { reason: "invalid_code" } });
  return NextResponse.json({ error: "Invalid recovery code." }, { status: 400 });
}
