import { NextRequest, NextResponse } from "next/server";
import { validateMemberSession } from "@/lib/member-auth/edge-validate";

// NOTE: this proxy MUST stay on the Node runtime (no `export const runtime
// = "edge"`). validateMemberSession() uses the pg driver (TCP sockets), which
// does not exist on the edge runtime.

// Paths that skip ALL checks
// NOTE: /api/announcements handles its own auth (bearer token for POST, session for GET/PATCH)
// NOTE: /api/frontdesk/{calls,sms}/webhook verify Telnyx Ed25519 signatures; the
//       intake endpoint verifies a shared-secret header (FRONTDESK_INTAKE_TOKEN).
// NOTE: /api/relay/webhook/* verify their own signatures (Telegram secret-token
//       header, WhatsApp X-Hub-Signature-256). They MUST be public so Meta and
//       Telegram can POST without a session cookie.
const PUBLIC = [
  "/login", "/passkey", "/api/auth", "/_next", "/favicon", "/og.png",
  "/api/announcements",
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
  // nginx auth_request backend for /sip-ws: must answer 401/204 itself — a
  // middleware 307 here makes nginx auth_request fail closed as a 500 and
  // kills every softphone WS handshake. The route runs requireAuth directly.
  "/api/frontdesk/sip-ws-auth",
];

// Paths that need auth but NOT 2FA (the 2FA setup/verify flow itself, plus internal API calls from authenticated sessions)
// Local passkey routes RETIRED (F19, 2026-07-03) — Keycloak owns credentials.
const AUTH_ONLY = ["/verify-2fa", "/setup-2fa",
  "/api/auth/totp-verify", "/api/auth/totp-setup",
  "/api/presence/heartbeat"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    PUBLIC.some((p) => pathname.startsWith(p)) ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".ico");

  if (isPublic) return NextResponse.next();

  // Member session is the SOLE gate (NextAuth retired 2026-06-05). The token is
  // opaque → validate it with a direct DB lookup (validateMemberSession — a raw
  // pg query; getActiveSession() uses next/headers cookies() which throws in the
  // proxy). Real validation, not a presence-check: `Cookie:
  // tgv_member_session=garbage` finds no live row → null → login redirect. No
  // member cookie → the query short-circuits, so the cost is paid only for
  // would-be sessions.
  const member = await validateMemberSession(req.cookies.get("tgv_member_session")?.value);

  if (!member) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Auth-only paths don't need 2FA
  const isAuthOnly = AUTH_ONLY.some((p) => pathname.startsWith(p));
  if (isAuthOnly) return NextResponse.next();

  // 2FA gate. The session row carries its own twoFactorVerified (passkey +
  // recovery logins always issue it true), so we trust that — the proxy can't
  // resolve the member's username at the edge anyway (no next/headers, no roster
  // read here). A passkey is itself a strong 2-factor credential.
  if (!member.twoFactorVerified) {
    const twoFaUrl = new URL("/verify-2fa", req.url);
    twoFaUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(twoFaUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
