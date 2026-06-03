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

const RP_ID = "office.tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { username: rawUsername, response: authResponse, callbackUrl } = body;
  // Usernameless / discoverable login: when no username is supplied, recover it
  // from the assertion's userHandle (set to the username at registration).
  let username: string | undefined =
    typeof rawUsername === "string" && rawUsername ? rawUsername : undefined;
  if (!username) {
    const uh = authResponse?.response?.userHandle;
    if (typeof uh === "string" && uh) {
      try {
        username = Buffer.from(uh, "base64url").toString("utf8") || undefined;
      } catch {
        username = undefined;
      }
    }
  }
  if (!username) return NextResponse.json({ error: "Could not identify account" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = rateLimit(`passkey-assert:${username}`, 10, 15 * 60 * 1000);
  if (!rl.ok) {
    logAuthEvent({ event: "passkey.assert", username, success: false, ip, details: { reason: "rate_limited" } });
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const store = readUsers();
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
