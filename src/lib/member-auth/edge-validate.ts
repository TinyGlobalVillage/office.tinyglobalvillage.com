// Proxy-side member-session validator.
//
// The symmetric counterpart to bridge.ts's getBridgedMember(): same cookie
// (tgv_member_session), different execution context. bridge.ts runs in route
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
import { readFileSync } from "fs";
import path from "path";
import { pgPool } from "@/lib/pg-pool";

// Read the office-staff roster directly (NOT via bridge.ts/config.ts — those
// pull next/headers, which throws in the proxy). The session cookie is now
// SHARED with tinyglobalvillage.com (single-sign-on), so a valid session may
// belong to a NON-staff member (a TGV.com client). Those must NOT reach the
// Office admin app — gate on staff-membership here, at the edge.
// Returns the staff email set, or null if the roster can't be read/parsed.
// null ⇒ the caller FAILS OPEN (skips the staff-check) rather than locking
// EVERYONE out of Office on a transient file error — the route handlers
// (requireAuth → bridge → roster) still gate non-staff out of all data.
function staffEmails(): Set<string> | null {
  try {
    const p = path.join(process.cwd(), "data", "office-staff.json");
    const roster = JSON.parse(readFileSync(p, "utf8")) as Record<string, { email: string }>;
    return new Set(Object.values(roster).map((r) => r.email?.toLowerCase()).filter(Boolean));
  } catch {
    return null;
  }
}

/**
 * Validate an opaque member-session token against member_sessions AND confirm
 * the member is Office staff. Returns null when the token is absent, unknown,
 * expired, or belongs to a non-staff member (the proxy then redirects to
 * /login — the member session is the SOLE gate post-2026-06-05 retire). On a
 * live staff session, reports whether 2FA has been satisfied.
 */
export async function validateMemberSession(
  sessionToken: string | undefined,
): Promise<{ valid: boolean; twoFactorVerified: boolean } | null> {
  if (!sessionToken) return null;
  try {
    const { rows } = await pgPool.query<{ two_factor_verified: boolean; email: string }>(
      `SELECT ms.two_factor_verified, lower(mu.email) AS email
         FROM member_sessions ms
         JOIN members mu ON mu.id = ms.user_id
        WHERE ms.session_token = $1 AND ms.expires >= now()
        LIMIT 1`,
      [sessionToken],
    );
    if (rows.length === 0) return null;
    const staff = staffEmails();
    // Reject only when the roster LOADED and this member isn't on it (a shared
    // session for a non-staff TGV.com client). On a roster read error (staff ===
    // null) fail open — route handlers still enforce staff-membership.
    if (staff && !staff.has(rows[0].email)) return null;
    return { valid: true, twoFactorVerified: rows[0].two_factor_verified === true };
  } catch {
    // DB hiccup → treat as no member session; the proxy redirects to /login
    // (fail closed). Never throw out of the proxy. A total DB outage takes the
    // whole app down anyway; the same cookie validates once Postgres recovers.
    return null;
  }
}
