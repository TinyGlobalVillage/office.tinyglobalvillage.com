/**
 * Shared auth helpers for email API routes.
 *
 * Uses getEffectiveUser() (which wraps getToken + dev-mode impersonation
 * cookie) and verify2faCookie() (checks HMAC-signed 2FA proof cookie) for
 * personal inbox gating. No PINs, no env vars — just the same 2FA the user
 * already completed at login.
 *
 * Because every user-gated route funnels through requireAuth(), the
 * impersonation swap in getEffectiveUser() propagates to the inbox adapter,
 * chat, presence, etc. automatically. See src/lib/dev/getEffectiveUser.ts.
 */
import type { NextRequest } from "next/server";
import { verify2faCookie } from "@/lib/twofa-cookie";
import { readFileSync } from "fs";
import path from "path";
import { getEffectiveUser } from "@/lib/dev/getEffectiveUser";

function isTotpEnrolled(username: string): boolean {
  try {
    const p = path.join(process.cwd(), "data", "users.json");
    const store = JSON.parse(readFileSync(p, "utf8")) as Record<string, { totpEnabled?: boolean }>;
    return store[username]?.totpEnabled === true;
  } catch {
    return false;
  }
}

export type AuthToken = {
  name?: string;
  username?: string;
  sub?: string;
};

/**
 * Returns the effective auth token — respects dev-mode impersonation when
 * the real JWT belongs to an admin and the impersonation cookie is set.
 *
 * Phase 3b note: the member-session bridge lives in getEffectiveUser() (the
 * single chokepoint), so requireAuth inherits member-auth support without a
 * change here — it still returns the exact { name, username, sub } shape the
 * ~125 downstream call sites depend on. Don't re-add a member branch here.
 */
export async function requireAuth(req: NextRequest): Promise<AuthToken | null> {
  try {
    const eff = await getEffectiveUser(req);
    if (!eff) return null;
    return { name: eff.name, username: eff.username, sub: eff.sub };
  } catch {
    return null;
  }
}

/**
 * For personal accounts: verifies the logged-in user has a valid tgv-2fa
 * cookie (i.e. completed TOTP/passkey 2FA this session). Ownership is
 * already enforced by the adapter's getTokenForUser() which only returns
 * the Fastmail token scoped to the logged-in user — so the JMAP account
 * IDs surfaced by enumerateAccounts() are inherently that user's accounts.
 */
export function requirePersonalAccess(req: NextRequest, _accountKey: string, loggedInUsername: string | undefined): "ok" | "access_denied" | "2fa_required" {
  if (!loggedInUsername) return "access_denied";
  if (isTotpEnrolled(loggedInUsername) && !verify2faCookie(req, loggedInUsername)) return "2fa_required";
  return "ok";
}
