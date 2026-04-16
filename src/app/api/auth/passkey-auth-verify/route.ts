import { NextRequest, NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { readUsers, updateUser } from "@/lib/users";
import { authChallenges } from "../passkey-auth-options/route";
import { encode } from "next-auth/jwt";

const RP_ID = "office.tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const { username, response: authResponse } = body;
  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });

  const store = readUsers();
  const user = store[username];
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const expectedChallenge = authChallenges.get(username) ?? authChallenges.get("anonymous");
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

    if (!result.verified) return NextResponse.json({ error: "Verification failed" }, { status: 400 });

    authChallenges.delete(username);
    authChallenges.delete("anonymous");

    // Update counter (replay attack prevention)
    updateUser(username, {
      webauthnCredentials: user.webauthnCredentials.map((c) =>
        c.id === credential.id
          ? { ...c, counter: result.authenticationInfo?.newCounter ?? c.counter }
          : c
      ),
    });

    // Issue a NextAuth-compatible JWT so the proxy's getToken() sees this as authenticated
    const COOKIE_NAME = "authjs.session-token";
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

    const res = NextResponse.json({ ok: true, redirectTo: "/verify-2fa" });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });
    return res;
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
