// Member-session → Office-token bridge.
//
// Phase 3b of the passkey-only migration: Office's central auth helpers learn
// to read the canonical DB-backed member session (officeMemberAuth, cookie
// `tgv_member_session`) in addition to the legacy NextAuth JWT. This file is
// the SINGLE place that knows how to turn an `ActiveSession` into the
// `{ username, sub, name }` shape the ~125 existing Office call sites expect,
// so api-auth / getEffectiveUser / future route handlers don't each
// re-implement the email→username reverse lookup.
//
// Why email→username: `getActiveSession()` exposes `user.email` + a
// `members` uuid, but every Office call site keys on the legacy short
// username ("admin", "marmar", "employee3", …) into data/users.json. The only
// field common to both stores is the email. data/office-staff.json is the
// Office-local roster (username → { email, role }); emails are unique and
// lowercased, so the reverse map is unambiguous.
//
// `sub = username` (NOT the member uuid): the live passkey-auth-verify route
// already mints `sub: username`, and dev-impersonation already sets
// `sub: <username>`. Keeping `sub = username` here means the existing
// `token.sub === "admin"` checks and `token.username ?? token.sub` fallbacks
// all keep working unchanged.
//
// DORMANT until Phase 3c: nothing sets `tgv_member_session` yet, so
// getActiveSession() returns null (no cookie → no DB query) and every caller
// transparently falls through to the NextAuth path. This is additive.

import "server-only";
import { readFileSync } from "fs";
import path from "path";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { pgPool } from "@/lib/pg-pool";

export type BridgedMember = {
  username: string;
  name: string;
  sub: string; // == username (keeps `token.sub === "admin"` checks working)
  role: string | null;
  twoFactorVerified: boolean;
};

export type RosterEntry = {
  email: string;
  role: string;
  /** Per-user grant for the in-dashboard terminal (/api/exec). Admins are
   *  always allowed regardless; this opts a non-admin staffer in. */
  terminalAccess?: boolean;
};
export type Roster = Record<string, RosterEntry>;

export function readRoster(): Roster {
  try {
    const p = path.join(process.cwd(), "data", "office-staff.json");
    return JSON.parse(readFileSync(p, "utf8")) as Roster;
  } catch {
    return {};
  }
}

// email (lowercased) → { username, role }
function emailToStaff(): Record<string, { username: string; role: string }> {
  const out: Record<string, { username: string; role: string }> = {};
  for (const [username, rec] of Object.entries(readRoster())) {
    if (rec?.email) out[rec.email.toLowerCase()] = { username, role: rec.role };
  }
  return out;
}

/**
 * Authoritative role resolver for an Office username. The office-staff.json
 * roster is the canonical source going forward (it covers both member-session
 * users and the legacy short-username staff, which share the same usernames);
 * data/users.json is consulted ONLY for a username not present on the roster,
 * as a transitional fallback until users.json is retired in 3f. Roster-present
 * usernames never fall through, so a member admin can't be silently de-admined
 * by a stale users.json entry.
 */
export function getOfficeRole(username: string | undefined): string | null {
  if (!username) return null;
  const roster = readRoster();
  if (roster[username]) return roster[username].role ?? null;
  try {
    const p = path.join(process.cwd(), "data", "users.json");
    const users = JSON.parse(readFileSync(p, "utf8")) as Record<string, { role?: string }>;
    return users[username]?.role ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether a user may use the in-dashboard terminal (the `/api/exec` command
 * runner). Admins always may; any other staffer needs an explicit per-user
 * grant (`terminalAccess` in office-staff.json), which an admin toggles from
 * the member's settings. This is the single source of truth used by both the
 * `/api/exec` server gate and the client UI gate (via `/api/users/me`).
 */
export function canUseTerminal(username: string | undefined): boolean {
  if (!username) return false;
  if (getOfficeRole(username) === "admin") return true;
  return readRoster()[username]?.terminalAccess === true;
}

/**
 * Reads the member session (tgv_member_session cookie) and maps it to the
 * Office token shape. Returns null when:
 *   - there is no member session (no cookie / expired), OR
 *   - the member's email is not on the Office staff roster.
 * In every null case the caller falls back to the NextAuth JWT path.
 *
 * Route-handler / server-component context ONLY — it uses next/headers
 * cookies() under the hood, which throws in middleware (the proxy reads the
 * cookie off `req.cookies` instead). The try/catch degrades any
 * out-of-request-scope call to a clean null rather than throwing.
 */
/** Office username → roster email (office-staff.json), lowercased. */
export function rosterEmailForUsername(username: string | undefined): string | null {
  if (!username) return null;
  return readRoster()[username]?.email?.toLowerCase() ?? null;
}

/** Office username → members.id (via the roster email). Resolves the
 *  member uuid for the CURRENT authenticated user regardless of session kind
 *  (member-session or NextAuth — both produce the same Office username). Used by
 *  the enrollment + recovery flows. Null if the username isn't on the roster or
 *  has no members row. */
export async function memberIdForUsername(
  username: string | undefined,
): Promise<string | null> {
  const email = rosterEmailForUsername(username);
  if (!email) return null;
  try {
    const { rows } = await pgPool.query<{ id: string }>(
      "SELECT id FROM members WHERE lower(email) = $1 LIMIT 1",
      [email],
    );
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Office username for a members uuid (via email → roster), for
 *  human-readable audit logs on the member login path. Null if the uuid has no
 *  email or the email isn't on the Office staff roster. */
export async function usernameForMemberId(
  memberId: string,
): Promise<string | null> {
  try {
    const { rows } = await pgPool.query<{ email: string }>(
      "SELECT email FROM members WHERE id = $1 LIMIT 1",
      [memberId],
    );
    const email = rows[0]?.email?.toLowerCase();
    if (!email) return null;
    return emailToStaff()[email]?.username ?? null;
  } catch {
    return null;
  }
}

export async function getBridgedMember(): Promise<BridgedMember | null> {
  let session: Awaited<ReturnType<typeof officeMemberAuth.getActiveSession>>;
  try {
    session = await officeMemberAuth.getActiveSession();
  } catch {
    return null;
  }
  if (!session) return null;

  const email = session.user.email?.toLowerCase();
  if (!email) return null;

  const staff = emailToStaff()[email];
  if (!staff) return null; // member exists but isn't Office staff → not our user

  return {
    username: staff.username,
    name: session.user.name ?? staff.username,
    sub: staff.username,
    role: staff.role,
    twoFactorVerified: session.twoFactorVerified,
  };
}
