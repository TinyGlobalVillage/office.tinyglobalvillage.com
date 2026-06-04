/**
 * DEV MODE impersonation — effective-user resolver.
 *
 * Every user-gated API route funnels through `requireAuth` in api-auth.ts,
 * which calls this helper. When the real JWT belongs to an admin AND the
 * dev switcher is enabled AND a `__dev_impersonate` cookie is set to a
 * valid target username, this helper returns the *impersonated* identity.
 * Otherwise it returns the real identity unchanged.
 *
 * Enabled when either:
 *   - NODE_ENV === "development" (local dev always on), OR
 *   - NEXT_PUBLIC_DEV_SWITCHER === "true" (prod escape hatch; admin-gated)
 *
 * Ported from @tgv/module-auth's getEffectiveUser (DB+drizzle flavor) and
 * adapted to office's JSON-file user store + JWT (getToken) auth shape.
 *
 * Phase 3b: the REAL (non-impersonated) identity now resolves from the
 * canonical member session FIRST (officeMemberAuth, cookie tgv_office_session)
 * and falls back to the legacy NextAuth JWT. The existing admin-impersonation
 * logic runs unchanged on top of whichever path produced the base identity, so
 * impersonation composes with member sessions for free. Because requireAuth()
 * funnels through here, bridging this one function covers all ~125 call sites.
 * Dormant until 3c sets the member cookie (getBridgedMember() returns null
 * with no cookie → NextAuth fallback → byte-identical to pre-3b behavior).
 */
import type { NextRequest } from "next/server";
import { readUsers } from "@/lib/users";
import { getAuthToken } from "@/lib/auth-cookie";
import { getBridgedMember, getOfficeRole } from "@/lib/member-auth/bridge";

export type EffectiveToken = {
  name?: string;
  username?: string;
  sub?: string;
  impersonating: boolean;
};

export function isDevSwitcherEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_DEV_SWITCHER === "true"
  );
}

export function getRole(username: string | undefined): string | null {
  // Roster-first (office-staff.json), legacy users.json fallback. See
  // getOfficeRole — keeps member sessions and legacy JWTs on one role source.
  return getOfficeRole(username);
}

function readImpersonateCookie(req: NextRequest): string | null {
  const raw = req.cookies.get("__dev_impersonate")?.value;
  return raw ? decodeURIComponent(raw) : null;
}

export async function getEffectiveUser(req: NextRequest): Promise<EffectiveToken | null> {
  // Resolve the REAL identity: canonical member session first, NextAuth JWT
  // fallback. Member path is dormant until 3c sets tgv_office_session.
  let realName: string | undefined;
  let realUsername: string | undefined;
  let realSub: string | undefined;

  const member = await getBridgedMember();
  if (member) {
    realName = member.name;
    realUsername = member.username;
    realSub = member.sub; // == username
  } else {
    const token = await getAuthToken(req);
    if (!token) return null;
    realUsername = (token as { username?: string }).username;
    if (!realUsername) return null;
    realName = token.name as string | undefined;
    realSub = token.sub;
  }
  if (!realUsername) return null;

  // On the member path the role is already resolved from the roster (the
  // authoritative source); only re-read for the NextAuth path.
  const realRole = member ? member.role : getRole(realUsername);

  if (isDevSwitcherEnabled() && realRole === "admin") {
    const target = readImpersonateCookie(req);
    if (target && target !== realUsername) {
      const store = readUsers() as Record<string, { displayName?: string }>;
      const targetRecord = store[target];
      if (targetRecord) {
        return {
          name: targetRecord.displayName ?? target,
          username: target,
          sub: target,
          impersonating: true,
        };
      }
    }
  }

  return {
    name: realName,
    username: realUsername,
    sub: realSub,
    impersonating: false,
  };
}
