import { NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { verify2faCookie } from "@/lib/twofa-cookie";
import { validateMemberSession } from "@/lib/member-auth/edge-validate";
import { readFileSync } from "fs";
import path from "path";

// NOTE: this proxy MUST stay on the Node runtime (no `export const runtime
// = "edge"`). validateMemberSession() uses the pg driver (TCP sockets), which
// does not exist on the edge runtime.

// Per-user 2FA enrollment check. A user counts as enrolled if they have TOTP
// enabled OR at least one registered passkey. A passkey is a phishing-resistant
// strong factor that stands on its own, so passkey-only users must NOT be
// force-marched into TOTP setup. The actual per-session gate is the tgv-2fa
// cookie check below — this only decides setup vs. verify.
function is2faEnrolled(username: string): boolean {
  try {
    const p = path.join(process.cwd(), "data", "users.json");
    const store = JSON.parse(readFileSync(p, "utf8")) as Record<
      string,
      { totpEnabled?: boolean; webauthnCredentials?: unknown[] }
    >;
    const u = store[username];
    if (!u) return false;
    return u.totpEnabled === true || (u.webauthnCredentials?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

// Paths that skip ALL checks
// NOTE: /api/announcements handles its own auth (bearer token for POST, session for GET/PATCH)
// NOTE: /api/frontdesk/{calls,sms}/webhook verify Telnyx Ed25519 signatures; the
//       intake endpoint verifies a shared-secret header (FRONTDESK_INTAKE_TOKEN).
// NOTE: /api/relay/webhook/* verify their own signatures (Telegram secret-token
//       header, WhatsApp X-Hub-Signature-256). They MUST be public so Meta and
//       Telegram can POST without a session cookie.
const PUBLIC = [
  "/login", "/api/auth", "/_next", "/favicon", "/og.png",
  "/api/auth/magic-link", "/api/announcements",
  "/api/frontdesk/calls/webhook",
  "/api/frontdesk/sms/webhook",
  "/api/frontdesk/sms/tfv-status",
  "/api/frontdesk/alerts/intake",
  "/api/relay/webhook/telegram",
  "/api/relay/webhook/whatsapp",
  // Transcription upload bypass: served on direct.tinyglobalvillage.com
  // (DNS-only, bypasses Cloudflare's 100MB body limit). Authentication is
  // via HMAC ticket minted by /api/transcripts/jobs/ticket on the main
  // host, so this endpoint MUST be exempt from cookie middleware.
  "/api/transcripts/jobs/upload-with-ticket",
];

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

  // Accept EITHER the legacy NextAuth JWT OR a VALIDATED member session
  // (tgv_office_session). The member token is opaque, so we validate it with a
  // direct DB lookup (validateMemberSession — a raw pg query, since
  // getActiveSession() uses next/headers cookies() which throws in the proxy).
  // This is a real validation, not a presence-check: `Cookie:
  // tgv_office_session=garbage` finds no live row → null → login redirect.
  const token = await getAuthToken(req);
  const member = token
    ? null
    : await validateMemberSession(req.cookies.get("tgv_office_session")?.value);

  if (!token && !member) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth-only paths don't need 2FA
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));
  if (isAuthOnly) return NextResponse.next();

  // Member-session 2FA gate. The session row carries its own twoFactorVerified
  // (passkey + recovery logins issue it true), so we trust that instead of the
  // username-keyed TOTP/tgv-2fa checks — the proxy can't resolve the member's
  // username at the edge anyway (no next/headers, no roster read here).
  if (member) {
    if (!member.twoFactorVerified) {
      const twoFaUrl = new URL("/verify-2fa", req.url);
      twoFaUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(twoFaUrl);
    }
    return NextResponse.next();
  }

  // NextAuth path (unchanged). `token` is non-null here: the guard above
  // redirected when both were absent, and the member branch returned for member
  // sessions. 2FA is MANDATORY — non-enrolled users get bounced to /setup-2fa;
  // enrolled users without a valid 2FA cookie this session get /verify-2fa.
  if (token) {
    const username = token.username as string | undefined;
    if (!username) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (!is2faEnrolled(username)) {
      const setupUrl = new URL("/setup-2fa", req.url);
      setupUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(setupUrl);
    }
    if (!verify2faCookie(req, username)) {
      const twoFaUrl = new URL("/verify-2fa", req.url);
      twoFaUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(twoFaUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
