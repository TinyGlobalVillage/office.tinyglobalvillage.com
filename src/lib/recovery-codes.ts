// Single-use recovery codes — Office staff break-glass when no passkey is
// available (lost/forgotten device). Generated at first passkey enrollment,
// shown ONCE in plaintext; only bcrypt hashes are stored on the user record.
// Redemption splices the matched hash out of the array (single-use without a
// separate "consumed" table).
//
// Format: 5 lowercase groups of 4 chars (a-z + 2-9, no confusable 0/1/i/l/o/u).
// Example: "j7kp-mnz2-9qrh-fxa3-tewy". ~100 bits of entropy.
//
// NOTE: this is a deliberate copy of the pure helpers in
// @tgv/module-auth/auth/member-auth/recoveryCodes.ts. The two will be unified
// into the shared package in the passkey-only canonicalization phase
// (see checklist tgv-passkey-only-auth.md §5); kept Office-local for now to
// avoid coupling Office's file store to module-auth's Drizzle build.

import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const CODE_GROUPS = 5;
const CODE_GROUP_LEN = 4;
const ALPHABET = "abcdefghjkmnpqrstvwxyz23456789"; // 30 chars, no 0/1/i/l/o/u

export interface GeneratedRecoveryCodes {
  /** Shown to the user once at enrollment. */
  plaintext: string[];
  /** Stored on UserRecord.recoveryCodesHash. */
  hashes: string[];
}

function pickChar(): string {
  let byte: number;
  do {
    byte = randomBytes(1)[0];
  } while (byte >= 256 - (256 % ALPHABET.length));
  return ALPHABET[byte % ALPHABET.length];
}

function generateOne(): string {
  const groups: string[] = [];
  for (let g = 0; g < CODE_GROUPS; g++) {
    let s = "";
    for (let c = 0; c < CODE_GROUP_LEN; c++) s += pickChar();
    groups.push(s);
  }
  return groups.join("-");
}

export async function generateRecoveryCodes(count = 10): Promise<GeneratedRecoveryCodes> {
  const plaintext = Array.from({ length: count }, () => generateOne());
  const hashes = await Promise.all(plaintext.map((c) => bcrypt.hash(c, 12)));
  return { plaintext, hashes };
}

/**
 * Try to redeem a code against the user's stored hashes. Returns the updated
 * hashes array (matched entry removed) or null if no match. Walks EVERY hash
 * even after a match so timing doesn't leak which slot matched.
 */
export async function redeemRecoveryCode(
  code: string,
  storedHashes: string[],
): Promise<string[] | null> {
  const normalized = code.trim().toLowerCase().replace(/\s+/g, "");
  if (!normalized || !/^[a-z2-9-]+$/.test(normalized)) return null;

  let matchIdx = -1;
  for (let i = 0; i < storedHashes.length; i++) {
    const ok = await bcrypt.compare(normalized, storedHashes[i]);
    if (ok && matchIdx < 0) matchIdx = i;
  }
  if (matchIdx < 0) return null;

  return storedHashes.filter((_, i) => i !== matchIdx);
}
