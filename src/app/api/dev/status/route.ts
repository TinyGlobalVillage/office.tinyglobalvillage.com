/**
 * DEV MODE — diagnostic snapshot. Lets us see, with a single browser hit
 * while signed in, exactly which gate is blocking the drawer:
 *   - Is the dev switcher env enabled on the server?
 *   - Can the server read the JWT?
 *   - What role does it see for the real user?
 *   - Is impersonation active right now?
 *
 * 200 for everyone who reaches this handler (proxy middleware still
 * enforces the session). No admin gate here intentionally — we want the
 * diagnostic to be readable whether the drawer would render or not.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { getRole, isDevSwitcherEnabled } from "@/lib/dev/getEffectiveUser";

export async function GET(req: NextRequest) {
  const token = await getAuthToken(req);
  const realUsername = (token as { username?: string } | null)?.username ?? null;
  const impersonateCookie = req.cookies.get("__dev_impersonate")?.value ?? null;

  // What would @/lib/api-auth's requireAuth return right now? This is what
  // module-inbox (and every other API route) sees as the effective user.
  const { getEffectiveUser } = await import("@/lib/dev/getEffectiveUser");
  const eff = await getEffectiveUser(req);

  return NextResponse.json({
    envEnabled: isDevSwitcherEnabled(),
    node_env: process.env.NODE_ENV ?? null,
    dev_switcher_env: process.env.NEXT_PUBLIC_DEV_SWITCHER ?? null,
    hasToken: !!token,
    realUsername,
    realRole: realUsername ? getRole(realUsername) : null,
    impersonateCookie,
    effectiveUser: eff,
    hasFastmailTokenForEffective: eff?.username === "admin"
      ? !!process.env.FASTMAIL_TOKEN_GIO
      : eff?.username === "marmar"
      ? !!process.env.FASTMAIL_TOKEN_MARMAR
      : false,
    gate: {
      would_api_route_return_200_for_demo_users:
        isDevSwitcherEnabled() &&
        !!realUsername &&
        getRole(realUsername) === "admin",
    },
  });
}
