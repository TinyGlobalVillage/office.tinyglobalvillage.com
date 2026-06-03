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
