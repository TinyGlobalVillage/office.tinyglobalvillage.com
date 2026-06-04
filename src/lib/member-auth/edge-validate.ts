// Proxy-side member-session validator.
//
// The symmetric counterpart to bridge.ts's getBridgedMember(): same cookie
// (tgv_office_session), different execution context. bridge.ts runs in route
// handlers and uses officeMemberAuth.getActiveSession() (which reads cookies()
// from next/headers). THIS file runs in the proxy/middleware, where
// next/headers cookies() throws — so it reads the raw token off req.cookies
// (passed in by the caller) and validates it with a direct pgPool query.
//
// Raw pgPool.query (NOT a Drizzle select-fields call): a Drizzle
// `db.select({ col: memberSessions.col })` against an @tgv/module-registry
// table crashes under Turbopack with `Object.entries(undefined)` (cross-bundle
// is(Column) mismatch — see team memory feedback_drizzle_turbopack_select_fields).
// A scalar raw query sidesteps that entirely.
//
// Node-runtime ONLY. proxy.ts has no `export const runtime = "edge"`; Next 16
// runs the proxy on Node by default, so the pg driver (TCP sockets) works. If
// anyone adds an edge runtime to proxy.ts, this validator silently breaks —
// keep the proxy on Node.

import "server-only";
import { pgPool } from "@/lib/pg-pool";

/**
 * Validate an opaque member-session token against member_sessions.
 * Returns null when the token is absent, unknown, or expired (caller then
 * falls through to the NextAuth path / login redirect). When a live row
 * exists, reports whether 2FA has been satisfied for that session.
 */
export async function validateMemberSession(
  sessionToken: string | undefined,
): Promise<{ valid: boolean; twoFactorVerified: boolean } | null> {
  if (!sessionToken) return null;
  try {
    const { rows } = await pgPool.query<{ two_factor_verified: boolean }>(
      "SELECT two_factor_verified FROM member_sessions WHERE session_token = $1 AND expires >= now() LIMIT 1",
      [sessionToken],
    );
    if (rows.length === 0) return null;
    return { valid: true, twoFactorVerified: rows[0].two_factor_verified === true };
  } catch {
    // DB hiccup → treat as no member session; NextAuth path / login redirect
    // still gates the request. Never throw out of the proxy.
    return null;
  }
}
