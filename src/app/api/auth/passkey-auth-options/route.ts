import { NextRequest, NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { readUsers } from "@/lib/users";

// In-memory challenge store for authentication
export const authChallenges = new Map<string, string>();

const RP_ID = "office.tinyglobalvillage.com";

export async function POST(req: NextRequest) {
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

  // Store challenge keyed by username or "anonymous"
  authChallenges.set(username ?? "anonymous", options.challenge);

  return NextResponse.json(options);
}
