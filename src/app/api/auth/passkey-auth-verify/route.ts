import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { readUsers, updateUser } from "@/lib/users";
import {
  readPasskeyAuthChallenge,
  clearPasskeyAuthChallenge,
} from "@/lib/passkey-challenge-cookie";
import { encode } from "next-auth/jwt";
import { sessionCookieName } from "@/lib/auth-cookie";
import { set2faCookie } from "@/lib/twofa-cookie";
import { safeDest } from "@/lib/safe-redirect";
import { logAuthEvent } from "@/lib/audit-log";
import { rateLimit, clearRateLimit } from "@/lib/rate-limit";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { usernameForMemberUserId } from "@/lib/member-auth/bridge";

const RP_ID = "office.tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { username: rawUsername, response: authResponse, callbackUrl } = body;

  // ── MEMBER PATH (dual-path) ───────────────────────────────────────────────
  // If the asserted credential lives in member_passkeys, this is a canonical
  // member login: the shared package verifies it and issues a member session
  // (tgv_member_session, twoFactorVerified=true). Otherwise fall through to the
  // legacy users.json NextAuth path below, UNCHANGED. Today only gio@ (office
  // username "admin") has a member passkey; everyone else stays on NextAuth.
  //
  // The whole branch is wrapped in try/catch: ANY infrastructure error (DB
  // down, pool exhausted) falls THROUGH to the NextAuth fallback below, so a
  // transient DB hiccup can never lock out a user who has a working fallback.
  // Only an explicit assertion failure (result.ok === false) rejects without
  // falling back — that's a security event, not an outage.
  try {
    if (typeof authResponse?.id === "string" && authResponse.id) {
      const memberPasskey = await officeMemberAuth.getPasskeyByCredentialId(authResponse.id);
      if (memberPasskey) {
        const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        // Rate-limit per member account (the uuid), NOT the public credential
        // id — a credential id is observable, so keying on it lets anyone DoS a
        // specific passkey. Distinct bucket prefix from the NextAuth path.
        const rlKey = `passkey-assert-member:${memberPasskey.memberUserId}`;
        const rl = rateLimit(rlKey, 10, 15 * 60 * 1000);
        if (!rl.ok) {
          logAuthEvent({ event: "passkey.assert", username: memberPasskey.memberUserId, success: false, ip, details: { path: "member", reason: "rate_limited" } });
          return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
        }
        const expectedChallenge = readPasskeyAuthChallenge(req);
        if (!expectedChallenge) return NextResponse.json({ error: "No challenge" }, { status: 400 });

        const result = await officeMemberAuth.loginWithDiscoverablePasskey({
          response: authResponse,
          expectedChallenge,
        });
        const auname =
          (await usernameForMemberUserId(memberPasskey.memberUserId)) ?? memberPasskey.memberUserId;
        if (!result.ok) {
          // Known member credential but the assertion failed (bad signature /
          // counter regression) — a security event. Do NOT fall back to the
          // users.json path; reject outright.
          logAuthEvent({ event: "passkey.assert", username: auname, success: false, ip, details: { path: "member", reason: result.error } });
          return NextResponse.json({ error: "Verification failed" }, { status: 400 });
        }
        clearRateLimit(rlKey);
        // loginWithDiscoverablePasskey already issued the session (set the
        // tgv_member_session cookie via next/headers). Build the JSON response
        // and clear the single-use challenge cookie on it. No tgv-2fa cookie —
        // the member session row carries twoFactorVerified itself.
        const res = NextResponse.json({ ok: true, redirectTo: safeDest(callbackUrl) });
        // Clear any stale NextAuth session cookie so the proxy doesn't fall back
        // to the JWT path (whose tgv-2fa gate the member login doesn't satisfy →
        // /verify-2fa loop), and so a future member-session expiry can't revive
        // an old login.
        res.cookies.set(sessionCookieName(), "", { maxAge: 0, path: "/" });
        // ALSO set the tgv-2fa proof cookie. The proxy reads two_factor_verified
        // off the member session, but legacy per-request gates still check the
        // tgv-2fa cookie — notably requirePersonalAccess() for the personal
        // inbox. Without it a TOTP-enrolled member (e.g. Gio) gets "2fa_required"
        // on the inbox. A member session IS 2FA-verified, so this is correct
        // (12h TTL, same re-assertion model as the NextAuth path).
        set2faCookie(res, auname);
        clearPasskeyAuthChallenge(res);
        logAuthEvent({ event: "passkey.assert", username: auname, success: true, ip, details: { path: "member" } });
        return res;
      }
    }
  } catch (e) {
    // Member-path infrastructure error (e.g. DB unavailable). Degrade to the
    // NextAuth fallback below instead of 500-ing the whole login.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    logAuthEvent({ event: "passkey.assert", username: typeof authResponse?.id === "string" ? authResponse.id : "unknown", success: false, ip, details: { path: "member", reason: "member_path_error", error: String(e) } });
  }

  const store = readUsers();

  // The asserted credential id is the source of truth for WHO is signing in
  // (it's the credential being cryptographically used). Resolve the owner by it
  // FIRST, and only fall back to a client-supplied username if the credential
  // isn't found. This is robust to a stale/remembered username that no longer
  // matches the credential's actual owner.
  let username: string | undefined;
  if (typeof authResponse?.id === "string" && authResponse.id) {
    for (const [uname, u] of Object.entries(store)) {
      if ((u.webauthnCredentials ?? []).some((c) => c.id === authResponse.id)) {
        username = uname;
        break;
      }
    }
  }
  if (!username && typeof rawUsername === "string" && rawUsername && store[rawUsername]) {
    username = rawUsername;
  }
  if (!username) return NextResponse.json({ error: "Passkey not recognized" }, { status: 404 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = rateLimit(`passkey-assert:${username}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    logAuthEvent({ event: "passkey.assert", username, success: false, ip, details: { reason: "rate_limited" } });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const user = store[username];
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const expectedChallenge = readPasskeyAuthChallenge(req);
  if (!expectedChallenge) return NextResponse.json({ error: "No challenge" }, { status: 400 });

  const credential = user.webauthnCredentials.find((c) => c.id === authResponse.id);
  if (!credential) return NextResponse.json({ error: "Credential not found" }, { status: 404 });

  try {
    const result = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      authenticator: {
        credentialID: new Uint8Array(Buffer.from(credential.id, "base64url")),
        credentialPublicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")),
        counter: credential.counter,
      },
    });

    if (!result.verified) {
      logAuthEvent({ event: "passkey.assert", username, success: false, ip, details: { reason: "verification_failed" } });
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    clearRateLimit(`passkey-assert:${username}`);

    // Update counter (replay attack prevention)
    updateUser(username, {
      webauthnCredentials: user.webauthnCredentials.map((c) =>
        c.id === credential.id
          ? { ...c, counter: result.authenticationInfo?.newCounter ?? c.counter }
          : c
      ),
    });

    // Issue a NextAuth-compatible JWT so proxy/auth()/useSession all see this as authenticated.
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

    const res = NextResponse.json({ ok: true, redirectTo: safeDest(callbackUrl) });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    // A passkey is a phishing-resistant strong factor and satisfies 2FA on its
    // own. Set the tgv-2fa cookie so the proxy treats this session as
    // 2FA-verified, instead of bouncing the user to /verify-2fa for a TOTP code.
    set2faCookie(res, username);
    clearPasskeyAuthChallenge(res); // single-use
    logAuthEvent({ event: "passkey.assert", username, success: true, ip });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
