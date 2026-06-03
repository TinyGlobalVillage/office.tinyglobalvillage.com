import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { readUsers } from "@/lib/users";

// In-memory challenge store (per-user, single-process), with a 5-min TTL so
// abandoned enrollments expire instead of lingering (re-checked on verify).
export const registrationChallenges = new Map<string, { challenge: string; exp: number }>();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const RP_ID = "office.tinyglobalvillage.com";
const RP_NAME = "TGV Office";

function b64toUint8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

export async function POST(req: NextRequest) {
  const token = await getAuthToken(req);
  const username = token?.username as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const store = readUsers();
  const user = store[username];
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: username,
    userName: username,
    userDisplayName: user.displayName,
    attestationType: "none",
    excludeCredentials: user.webauthnCredentials.map((c) => ({
      id: b64toUint8(c.id),
      type: "public-key" as const,
      transports: ["internal", "hybrid"] as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  registrationChallenges.set(username, {
    challenge: options.challenge,
    exp: Date.now() + CHALLENGE_TTL_MS,
  });

  return NextResponse.json(options);
}
