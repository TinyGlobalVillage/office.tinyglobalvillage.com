// Passkey enrollment — step 1 (options). Phase 3d: writes the canonical member
// store. Resolves the enrolling user member-session-FIRST (requireAuth, not the
// NextAuth-only getAuthToken — a member-session user has no JWT), maps to their
// member_users uuid, excludes their existing member_passkeys, and stashes the
// ceremony challenge in a durable signed cookie (no in-memory Map).
import { NextRequest, NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { requireAuth } from "@/lib/api-auth";
import { memberUserIdForUsername } from "@/lib/member-auth/bridge";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { setPasskeyRegisterChallenge } from "@/lib/passkey-challenge-cookie";

const RP_ID = "office.tinyglobalvillage.com";
const RP_NAME = "TGV Office";

function b64toUint8(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64url"));
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  const username = token?.username;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberUserId = await memberUserIdForUsername(username);
  if (!memberUserId) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const existing = await officeMemberAuth.listPasskeysForUser(memberUserId);

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: memberUserId,
    userName: username,
    userDisplayName: username,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: b64toUint8(c.credentialId),
      type: "public-key" as const,
      transports: (c.transports?.length
        ? c.transports
        : ["internal", "hybrid"]) as AuthenticatorTransport[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  const res = NextResponse.json(options);
  setPasskeyRegisterChallenge(res, options.challenge);
  return res;
}
