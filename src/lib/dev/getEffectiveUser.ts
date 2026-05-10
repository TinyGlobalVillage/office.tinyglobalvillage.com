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
 */
import type { NextRequest } from "next/server";
import { readUsers } from "@/lib/users";
import { getAuthToken } from "@/lib/auth-cookie";

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
  if (!username) return null;
  const store = readUsers() as Record<string, { role?: string }>;
  return store[username]?.role ?? null;
}

function readImpersonateCookie(req: NextRequest): string | null {
  const raw = req.cookies.get("__dev_impersonate")?.value;
  return raw ? decodeURIComponent(raw) : null;
}

export async function getEffectiveUser(req: NextRequest): Promise<EffectiveToken | null> {
  const token = await getAuthToken(req);
  if (!token) return null;

  const realUsername = (token as { username?: string }).username;
  if (!realUsername) return null;

  const realRole = getRole(realUsername);

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
    name: token.name as string | undefined,
    username: realUsername,
    sub: token.sub,
    impersonating: false,
  };
}
