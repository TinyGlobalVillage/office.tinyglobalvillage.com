import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { readUsers } from "@/lib/users";
import { setPasskeyAuthChallenge } from "@/lib/passkey-challenge-cookie";
import { rateLimit } from "@/lib/rate-limit";

// Login OFFER rpID. Flipped to the parent tinyglobalvillage.com (2026-06-05):
// the discoverable-login ceremony now surfaces parent-scoped passkeys, which
// work on BOTH office.<host> and <host>. Verify-side still accepts office.<host>
// too (config.loginRpIds) as a safety net, but no office-scoped passkey is
// surfaced here anymore — the old office.tgv binding is retired.
const RP_ID = "tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`pk-auth-opts:${ip}`, 30, 15 * 60 * 1000).ok) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { username } = await req.json().catch(() => ({}));

  const store = readUsers();
  const user = username ? store[username] : null;

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials: user
      ? user.webauthnCredentials.map((c) => ({
          id: new Uint8Array(Buffer.from(c.id, "base64url")),
          type: "public-key" as const,
          transports: ["internal", "hybrid"] as AuthenticatorTransport[],
        }))
      : [],
  });

  const res = NextResponse.json(options);
  // Bind the challenge to a signed, per-browser cookie instead of a shared
  // in-memory map — no "anonymous" collision between concurrent usernameless
  // logins, and nothing to leak or grow unbounded.
  setPasskeyAuthChallenge(res, options.challenge);
  return res;
}
