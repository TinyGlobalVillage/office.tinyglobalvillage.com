// Break-glass login: redeem a single-use recovery code when no passkey is
// available. Public (no prior session) — the recovery code IS the credential.
// Proof of a valid code mints a full session + the 2FA cookie, just like a
// passkey assertion. Hard rate-limited; account-enumeration-safe.

import { NextRequest, NextResponse } from "next/server";
import { readUsers, updateUser } from "@/lib/users";
import { redeemRecoveryCode } from "@/lib/recovery-codes";
import { encode } from "next-auth/jwt";
import { sessionCookieName } from "@/lib/auth-cookie";
import { set2faCookie } from "@/lib/twofa-cookie";
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

  // ── MEMBER PATH (dual-path) ───────────────────────────────────────────────
  // Try the canonical member recovery codes first. On success, the package
  // issues a member session (tgv_office_session, 2FA-verified). On invalid_code
  // (unknown email / no codes / wrong code — all identical) fall through to the
  // legacy users.json path so a staffer whose codes only live there still works.
  const email = rosterEmailForUsername(username);
  if (email) {
    let r: Awaited<ReturnType<typeof officeMemberAuth.loginWithRecoveryCode>>;
    try {
      r = await officeMemberAuth.loginWithRecoveryCode({ email, code });
    } catch {
      // FAIL CLOSED on an infra error. Do NOT fall through to users.json: if the
      // same code lives in both stores and the member-side UPDATE failed mid-
      // redeem, falling through would redeem it again (double-spend) while the
      // member-side code stays live.
      logAuthEvent({ event: "recovery.redeem", username, success: false, ip, details: { path: "member", reason: "db_error" } });
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
      // Member session carries twoFactorVerified; also set the legacy tgv-2fa
      // proof cookie (requirePersonalAccess etc.) and clear any stale NextAuth
      // session so the proxy doesn't fall back to the JWT path.
      set2faCookie(res, username);
      res.cookies.set(sessionCookieName(), "", { maxAge: 0, path: "/" });
      logAuthEvent({ event: "recovery.redeem", username, success: true, ip, details: { remaining: r.remaining, path: "member" } });
      return res;
    }
    if (r.error === "conflict_retry") {
      return NextResponse.json({ error: "Please try again." }, { status: 409 });
    }
    // else (invalid_code — a clean miss, not an infra error): fall through to
    // the legacy users.json path for staff whose codes only live there.
  }

  const store = readUsers();
  const user = store[username];
  // Identical failure for unknown user and bad code → no account enumeration.
  const remaining = user ? await redeemRecoveryCode(code, user.recoveryCodesHash ?? []) : null;
  if (!user || remaining === null) {
    logAuthEvent({ event: "recovery.redeem", username, success: false, ip });
    return NextResponse.json({ error: "Invalid recovery code." }, { status: 400 });
  }

  updateUser(username, { recoveryCodesHash: remaining });
  clearRateLimit(`recovery:${username}`);

  const COOKIE_NAME = sessionCookieName();
  const token = await encode({
    token: {
      sub: username,
      name: user.displayName,
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
    },
    secret: process.env.AUTH_SECRET!,
    salt: COOKIE_NAME,
  });

  const res = NextResponse.json({
    ok: true,
    redirectTo: safeDest(callbackUrl),
    remaining: remaining.length,
    low: remaining.length <= 2,
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  // A recovery code is a break-glass strong factor → it satisfies 2FA.
  set2faCookie(res, username);
  logAuthEvent({ event: "recovery.redeem", username, success: true, ip, details: { remaining: remaining.length } });
  return res;
}
