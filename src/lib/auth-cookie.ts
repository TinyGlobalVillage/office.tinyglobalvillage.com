/**
 * Resolves the next-auth session-cookie name for this environment, matching
 * what NextAuth's `auth()` handler expects with `trustHost: true`.
 *
 * On HTTPS (production), next-auth uses the `__Secure-` prefix; on HTTP it
 * doesn't. Custom cookie-setting routes (magic-link/verify, passkey-auth-
 * verify) must use this helper so the cookie they write is the SAME one
 * `auth()` / `/api/auth/session` will read — otherwise `useSession` returns
 * null even though the JWT is valid.
 */
const BASE = "authjs.session-token";

function isHttps(): boolean {
  return (
    (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").startsWith("https://") ||
    process.env.NODE_ENV === "production"
  );
}

export function sessionCookieName(): string {
  return isHttps() ? `__Secure-${BASE}` : BASE;
}

/**
 * Thin wrapper around getToken() that always resolves the cookie name the
 * same way auth() does. Required because getToken's own defaulting uses
 * req.url's protocol — which is HTTP at the origin when Cloudflare fronts
 * the app — while auth() respects x-forwarded-proto (HTTPS). Without
 * explicit cookieName+salt, the two disagree on which cookie to read.
 */
import type { NextRequest } from "next/server";
import { getToken as nextAuthGetToken, type JWT } from "next-auth/jwt";

export async function getAuthToken(req: NextRequest): Promise<JWT | null> {
  const name = sessionCookieName();
  return nextAuthGetToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName: name,
    salt: name,
  });
}
