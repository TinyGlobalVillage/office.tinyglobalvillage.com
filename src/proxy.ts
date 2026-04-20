import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { verify2faCookie } from "@/lib/twofa-cookie";
import { readFileSync } from "fs";
import path from "path";

// Per-user TOTP enrollment check. Users with totpEnabled=false (not yet
// enrolled, or opted out) pass the proxy on NextAuth JWT alone.
function isTotpEnrolled(username: string): boolean {
  try {
    const p = path.join(process.cwd(), "data", "users.json");
    const store = JSON.parse(readFileSync(p, "utf8")) as Record<string, { totpEnabled?: boolean }>;
    return store[username]?.totpEnabled === true;
  } catch {
    return false;
  }
}

// Paths that skip ALL checks
// NOTE: /api/announcements handles its own auth (bearer token for POST, session for GET/PATCH)
const PUBLIC = ["/login", "/api/auth", "/_next", "/favicon", "/og.png", "/api/auth/magic-link", "/api/announcements"];

// Paths that need auth but NOT 2FA (the 2FA setup/verify flow itself, plus internal API calls from authenticated sessions)
const AUTH_ONLY = ["/verify-2fa", "/setup-2fa", "/setup-passkey",
  "/api/auth/totp-verify", "/api/auth/totp-setup",
  "/api/auth/passkey-register-options", "/api/auth/passkey-register-verify",
  "/api/auth/passkey-auth-options", "/api/auth/passkey-auth-verify",
  "/api/presence/heartbeat"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico");

  if (isPublic) return NextResponse.next();

  // Require NextAuth JWT
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth-only paths don't need 2FA
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));
  if (isAuthOnly) return NextResponse.next();

  // All other paths require 2FA cookie — but only for users who have
  // enrolled TOTP. Users with totpEnabled=false pass on JWT alone.
  const username = token.username as string | undefined;
  if (username && isTotpEnrolled(username) && !verify2faCookie(req, username)) {
    const twoFaUrl = new URL("/verify-2fa", req.url);
    twoFaUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(twoFaUrl);
  }
  if (!username) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
