// Passkey enrollment — step 2 (verify). Phase 3d: verifies the registration
// assertion and writes the credential to member_passkeys (the canonical store),
// minting member recovery codes if the member has none yet. Member-aware auth
// (requireAuth) so a member-session user can enroll a 2nd passkey.
import { NextRequest, NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { requireAuth } from "@/lib/api-auth";
import { memberUserIdForUsername } from "@/lib/member-auth/bridge";
import { officeMemberAuth } from "@/lib/member-auth/config";
import {
  readPasskeyRegisterChallenge,
  clearPasskeyRegisterChallenge,
} from "@/lib/passkey-challenge-cookie";
import { generateRecoveryCodes } from "@/lib/recovery-codes";
import { pgPool } from "@/lib/pg-pool";
import { logAuthEvent } from "@/lib/audit-log";

// New passkeys bind to the PARENT domain (SSO across both apps). ORIGIN stays
// this app's own origin — verifyRegistrationResponse checks clientDataJSON.origin
// against ORIGIN and the credential's rpIdHash against RP_ID separately.
const RP_ID = "tinyglobalvillage.com";
const ORIGIN = "https://office.tinyglobalvillage.com";
const VALID_TRANSPORTS = ["usb", "nfc", "ble", "internal", "hybrid", "cable", "smart-card"];

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  const username = token?.username;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberUserId = await memberUserIdForUsername(username);
  if (!memberUserId) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const expectedChallenge = readPasskeyRegisterChallenge(req);
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
      const res = NextResponse.json({ error: "Verification failed" }, { status: 400 });
      clearPasskeyRegisterChallenge(res); // single-use — don't leave it replayable
      return res;
    }

    const {
      credentialID,
      credentialPublicKey,
      counter,
      credentialDeviceType,
      credentialBackedUp,
    } = result.registrationInfo;
    const credentialId = Buffer.from(credentialID).toString("base64url");

    // Count BEFORE insert so we can report firstCredential in the audit log.
    const existing = await officeMemberAuth.listPasskeysForUser(memberUserId);

    await officeMemberAuth.insertPasskey({
      credentialId,
      memberUserId,
      publicKey: Buffer.from(credentialPublicKey).toString("base64url"),
      counter,
      transports: Array.isArray(body.response?.response?.transports)
        ? body.response.response.transports.filter(
            (t: unknown): t is string => typeof t === "string" && VALID_TRANSPORTS.includes(t),
          )
        : [],
      deviceType: credentialDeviceType ?? null,
      backedUp: !!credentialBackedUp,
      nickname: deviceName,
    });

    // Mint single-use recovery codes if the member has NONE yet (covers a
    // first-ever enrollment AND a member migrated with a passkey but no codes).
    // Returned ONCE here for the user to save; only bcrypt hashes persist.
    let recoveryCodes: string[] | undefined;
    const { rows } = await pgPool.query<{ recovery_codes_hash: string[] }>(
      "SELECT recovery_codes_hash FROM member_users WHERE id = $1",
      [memberUserId],
    );
    const currentCodes = rows[0]?.recovery_codes_hash ?? [];
    if (currentCodes.length === 0) {
      const gen = await generateRecoveryCodes(10);
      // Optimistic: only mint if STILL empty, so a concurrent enroll can't
      // double-mint and clobber a freshly-issued set. Show the codes only if
      // this write actually persisted them.
      const upd = await pgPool.query(
        "UPDATE member_users SET recovery_codes_hash = $1 WHERE id = $2 AND (recovery_codes_hash = '{}' OR recovery_codes_hash IS NULL)",
        [gen.hashes, memberUserId],
      );
      if (upd.rowCount && upd.rowCount > 0) recoveryCodes = gen.plaintext;
    }

    const res = NextResponse.json({ ok: true, ...(recoveryCodes ? { recoveryCodes } : {}) });
    clearPasskeyRegisterChallenge(res);
    logAuthEvent({
      event: "passkey.enroll",
      username,
      success: true,
      details: { deviceName, path: "member", firstCredential: existing.length === 0 },
    });
    return res;
  } catch (e) {
    const res = NextResponse.json({ error: String(e) }, { status: 400 });
    clearPasskeyRegisterChallenge(res); // single-use even on error
    return res;
  }
}
