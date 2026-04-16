/**
 * Shared auth helpers for email API routes.
 *
 * Uses getToken() from next-auth/jwt (reads JWT directly from session cookie)
 * and verify2faCookie() (checks HMAC-signed 2FA proof cookie) for personal
 * inbox gating. No PINs, no env vars — just the same 2FA the user already
 * completed at login.
 */
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { verify2faCookie } from "@/lib/twofa-cookie";

export type AuthToken = {
  name?: string;
  username?: string;
  sub?: string;
};

/**
 * Returns the decoded JWT token if the request is authenticated, or null.
 */
export async function requireAuth(req: NextRequest): Promise<AuthToken | null> {
  try {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (!token) return null;
    return {
      name: token.name as string | undefined,
      username: (token as { username?: string }).username,
      sub: token.sub,
    };
  } catch {
    return null;
  }
}

/**
 * For personal accounts: verifies the logged-in user IS the owner AND has a
 * valid tgv-2fa cookie (i.e. completed TOTP/passkey 2FA this session).
 * Since the proxy enforces 2FA for all dashboard routes, this will always
 * pass for the legitimate owner — and always fail for anyone else.
 */
export function requirePersonalAccess(req: NextRequest, ownerUsername: string, loggedInUsername: string | undefined): "ok" | "access_denied" | "2fa_required" {
  if (loggedInUsername !== ownerUsername) return "access_denied";
  if (!verify2faCookie(req, loggedInUsername)) return "2fa_required";
  return "ok";
}
