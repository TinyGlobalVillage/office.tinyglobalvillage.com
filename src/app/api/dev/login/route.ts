// DEV ONLY — GET /api/dev/login mints a member session so local Office work
// doesn't require the Keycloak/passkey ceremony against a localhost RP ID.
// Referenced by scripts/dev-local.sh (bookmark http://localhost:3005/api/dev/login);
// ported from tinyglobalvillage.com's /api/dev/auto-login onto Office's pgPool.
// Returns 404 outside development; the proxy additionally only lets /api/dev/*
// through when NODE_ENV === "development", so this is dead code in prod builds.
//
// The session cookie is set HOST-ONLY on purpose: the real login scopes it to
// `.tinyglobalvillage.com` (SSO), which a browser refuses from localhost.
// Reads only do jar.get(cookieName), so a host-only cookie authenticates
// identically. The tgv-2fa proof cookie is set too (session TTL), same as the
// OIDC callback, so requirePersonalAccess/inbox gates don't bounce.
//
// Usage: GET /api/dev/login                → DEV_LOGIN_EMAIL, else roster admin
//        GET /api/dev/login?email=…        → a specific member (must be staff)
//        GET /api/dev/login?to=/dashboard  → redirect target
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { pgPool } from "@/lib/pg-pool";
import { readRoster, usernameForMemberId } from "@/lib/member-auth/bridge";
import { create2faCookie, TWO_FA_SESSION_TTL_MS } from "@/lib/twofa-cookie";

const COOKIE_NAME = "tgv_member_session"; // == officeMemberAuth cookieName
const SESSION_DAYS = 30;

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ?email= wins, then DEV_LOGIN_EMAIL from .env.local, then the roster's first
  // admin — configurable rather than baking an identity into this file. The
  // edge gate only admits roster emails, so a non-staff pick would mint a
  // session the proxy rejects anyway.
  const email =
    req.nextUrl.searchParams.get("email") ??
    process.env.DEV_LOGIN_EMAIL ??
    Object.values(readRoster()).find((r) => r.role === "admin")?.email ??
    null;
  const to = req.nextUrl.searchParams.get("to") ?? "/dashboard";
  if (!email) {
    return NextResponse.json({ error: "No dev identity (set DEV_LOGIN_EMAIL)" }, { status: 404 });
  }

  // Skip soft-deleted members — a session on one resolves to nobody and looks
  // like the mint silently failed.
  const { rows } = await pgPool.query<{ id: string; email: string }>(
    `SELECT id, email FROM members
      WHERE lower(email) = lower($1) AND deleted_at IS NULL
      LIMIT 1`,
    [email],
  );
  const member = rows[0];
  if (!member) {
    return NextResponse.json({ error: `No active member with email ${email}` }, { status: 404 });
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  // Local dev never runs the TOTP step; two_factor_verified=false would bounce
  // every request straight back to the 2FA challenge.
  await pgPool.query(
    `INSERT INTO member_sessions (session_token, user_id, expires, two_factor_verified)
     VALUES ($1, $2, $3, true)`,
    [sessionToken, member.id, expires],
  );

  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin));
  res.cookies.set({
    name: COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: false, // localhost is http; a Secure cookie would never be stored
    sameSite: "lax",
    path: "/",
    expires,
  });
  const username = await usernameForMemberId(member.id);
  if (username) {
    // create2faCookie hardcodes Secure, which Safari refuses on http://localhost
    // (Chrome tolerates it). Same signed value, minus the Secure attribute.
    const c = create2faCookie(username, TWO_FA_SESSION_TTL_MS);
    res.cookies.set(c.name, c.value, { ...c.options, secure: false });
  }
  return res;
}
