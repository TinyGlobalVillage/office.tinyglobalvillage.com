import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
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

  // Discoverable (usernameless) login only: never constrain allowCredentials —
  // the authenticator surfaces every resident parent-scoped passkey for this
  // rpId. The legacy users.json-keyed allowCredentials path was removed with the
  // NextAuth retire (2026-06-05); member passkeys are discoverable by design.
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials: [],
  });

  const res = NextResponse.json(options);
  // Bind the challenge to a signed, per-browser cookie instead of a shared
  // in-memory map — no "anonymous" collision between concurrent usernameless
  // logins, and nothing to leak or grow unbounded.
  setPasskeyAuthChallenge(res, options.challenge);
  return res;
}
