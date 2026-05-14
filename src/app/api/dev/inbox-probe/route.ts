/**
 * DEV MODE — inbox diagnostic. Walks the full module-inbox chain with the
 * current effective identity and reports where it fails:
 *   1. Who is the effective user?
 *   2. Does getTokenForUser return a Fastmail token for them?
 *   3. Does enumerateAccounts succeed? What accounts are returned?
 *   4. For each account, does listMailboxes succeed? How many boxes?
 *
 * Only exposed when the dev switcher is enabled; admin-gated on the REAL
 * user (impersonation must not let a non-admin poke this).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import "@/lib/inbox-setup";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { getEffectiveUser, getRole, isDevSwitcherEnabled } from "@/lib/dev/getEffectiveUser";
import { enumerateAccounts, listMailboxes } from "@tgv/module-inbox/fastmail/client";
import { getInboxAccessAdapter } from "@tgv/module-inbox/adapters";

export async function GET(req: NextRequest) {
  if (!isDevSwitcherEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const realToken = await getAuthToken(req);
  const realUsername = (realToken as { username?: string } | null)?.username ?? null;
  if (!realUsername || getRole(realUsername) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const eff = await getEffectiveUser(req);
  const effUsername = eff?.username ?? null;

  const access = getInboxAccessAdapter();
  const token = effUsername ? access.getTokenForUser(effUsername) : null;

  const probe: Record<string, unknown> = {
    realUsername,
    effectiveUsername: effUsername,
    impersonating: eff?.impersonating ?? false,
    hasInboxToken: !!token,
    tokenPrefix: token ? token.slice(0, 12) : null,
  };

  if (!token) {
    probe.error = "no_inbox_token_for_effective_user";
    return NextResponse.json(probe);
  }

  try {
    const accounts = await enumerateAccounts(token);
    probe.accounts = accounts.map((a) => ({
      key: a.key,
      email: a.email,
      label: a.label,
      personal: a.personal,
      isPrimary: a.isPrimary,
    }));

    const perAccountMailboxes: Record<string, unknown> = {};
    for (const a of accounts) {
      try {
        const boxes = await listMailboxes(token, a.key);
        perAccountMailboxes[a.key] = {
          count: boxes.length,
          names: boxes.map((b) => b.name).slice(0, 20),
        };
      } catch (e) {
        perAccountMailboxes[a.key] = { error: String(e) };
      }
    }
    probe.perAccountMailboxes = perAccountMailboxes;
  } catch (e) {
    probe.enumerateAccountsError = String(e);
  }

  return NextResponse.json(probe);
}
