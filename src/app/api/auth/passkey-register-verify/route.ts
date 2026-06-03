import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { readUsers, updateUser } from "@/lib/users";
import { registrationChallenges } from "../passkey-register-options/route";
import { generateRecoveryCodes } from "@/lib/recovery-codes";
import { logAuthEvent } from "@/lib/audit-log";

const RP_ID = "office.tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const token = await getAuthToken(req);
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const store = readUsers();
  if (!store[username]) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const rec = registrationChallenges.get(username);
  const expectedChallenge = rec && rec.exp > Date.now() ? rec.challenge : undefined;
  if (!expectedChallenge) return NextResponse.json({ error: "No challenge found" }, { status: 400 });

  try {
    const { deviceName = "Device" } = body;
    const result = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!result.verified || !result.registrationInfo) {
      return NextResponse.json({ error: "Verification failed" }, { status: 400 });
    }

    registrationChallenges.delete(username);

    const { credentialID, credentialPublicKey, counter } = result.registrationInfo;
    const user = store[username];
    const isFirstCredential = user.webauthnCredentials.length === 0;
    updateUser(username, {
      webauthnCredentials: [
        ...user.webauthnCredentials,
        {
          id: Buffer.from(credentialID).toString("base64url"),
          publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
          counter,
          deviceName,
          createdAt: new Date().toISOString(),
        },
      ],
    });

    // On first-ever passkey enrollment, mint single-use recovery codes if the
    // account has none. Returned ONCE here for the user to save; only bcrypt
    // hashes persist on the user record.
    let recoveryCodes: string[] | undefined;
    if (isFirstCredential && (user.recoveryCodesHash?.length ?? 0) === 0) {
      const gen = await generateRecoveryCodes(10);
      updateUser(username, { recoveryCodesHash: gen.hashes });
      recoveryCodes = gen.plaintext;
    }

    logAuthEvent({
      event: "passkey.enroll",
      username,
      success: true,
      details: { deviceName, firstCredential: isFirstCredential },
    });

    return NextResponse.json({ ok: true, ...(recoveryCodes ? { recoveryCodes } : {}) });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
