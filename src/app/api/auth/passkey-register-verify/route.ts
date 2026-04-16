import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { readUsers, updateUser } from "@/lib/users";
import { registrationChallenges } from "../passkey-register-options/route";

const RP_ID = "office.tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const store = readUsers();
  if (!store[username]) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const expectedChallenge = registrationChallenges.get(username);
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

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
