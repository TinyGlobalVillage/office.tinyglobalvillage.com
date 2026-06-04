// Signed challenge cookie for the passkey AUTHENTICATION ceremony. Replaces the
// in-memory authChallenges map, which keyed usernameless logins under a shared
// "anonymous" slot (concurrent logins collided) and never pruned expired
// entries. The challenge is bound to a per-browser, HMAC-signed, 5-min cookie
// instead — no shared state, no collision, no unbounded growth.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

const COOKIE = "tgv-pk-auth-ch";
const TTL_MS = 5 * 60 * 1000;

// challenge is base64url (no "."); expires is digits (no "."); sig is base64url
// (no ".") — so the token is exactly three "."-separated fields.
function sign(challenge: string, expires: number): string {
  const payload = `${challenge}.${expires}`;
  const sig = createHmac("sha256", process.env.AUTH_SECRET!).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function setPasskeyAuthChallenge(res: NextResponse, challenge: string): void {
  const expires = Date.now() + TTL_MS;
  res.cookies.set(COOKIE, sign(challenge, expires), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
}

export function readPasskeyAuthChallenge(req: NextRequest): string | null {
  const raw = req.cookies.get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [challenge, expiresStr, sig] = parts;
  const expected = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(`${challenge}.${expiresStr}`)
    .digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  const expires = parseInt(expiresStr, 10);
  if (!challenge || Number.isNaN(expires) || Date.now() > expires) return null;
  return challenge;
}

export function clearPasskeyAuthChallenge(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { maxAge: 0, path: "/" });
}

// ── Registration ceremony ──────────────────────────────────────────────────
// Separate cookie from the auth ceremony so a concurrent login + enrollment in
// the same browser don't clobber each other's challenge. Same HMAC scheme;
// replaces the in-memory registrationChallenges Map (which died on PM2 restart
// mid-enrollment and didn't work across processes).
const REG_COOKIE = "tgv-pk-reg-ch";

export function setPasskeyRegisterChallenge(res: NextResponse, challenge: string): void {
  const expires = Date.now() + TTL_MS;
  res.cookies.set(REG_COOKIE, sign(challenge, expires), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TTL_MS / 1000,
    path: "/",
  });
}

export function readPasskeyRegisterChallenge(req: NextRequest): string | null {
  const raw = req.cookies.get(REG_COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [challenge, expiresStr, sig] = parts;
  const expected = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(`${challenge}.${expiresStr}`)
    .digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  const expires = parseInt(expiresStr, 10);
  if (!challenge || Number.isNaN(expires) || Date.now() > expires) return null;
  return challenge;
}

export function clearPasskeyRegisterChallenge(res: NextResponse): void {
  res.cookies.set(REG_COOKIE, "", { maxAge: 0, path: "/" });
}
