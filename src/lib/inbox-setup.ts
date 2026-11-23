/**
 * Boot-time adapter wiring for @tgv/module-inbox.
 *
 * Imported from root layout (and defensively from a handful of API routes
 * in case a request hits before the layout-side import fires).
 *
 * Wires three adapters into module-inbox:
 *
 *  1. AuthAdapter        — re-exposes office's existing requireAuth +
 *                          requirePersonalAccess for the package's API routes.
 *  2. ProviderResolver   — given (username, accountKey), returns the
 *                          MailProvider credentials + the account meta.
 *                          V1 wraps the static FASTMAIL_TOKEN_<USER> env vars
 *                          + JMAP enumerate (cached at the JMAP session
 *                          layer). DB-backed inbox_accounts comes when
 *                          @tgv/module-registry/members is real.
 *  3. ThemeAdapter       — hands the package office's color palette so
 *                          components match the rest of the dashboard.
 *
 * Access model: ONE Fastmail token per Office user, that token enumerates
 * every JMAP account the user can touch (their personal + shared business
 * folders inside others' accounts). Per-folder privacy is enforced by
 * Fastmail's `myRights.mayReadItems` ACL at JMAP-time — the package's UI
 * filters mailboxes accordingly. The resolver does NOT filter accounts by
 * owner; routes apply the personal-account 2FA gate via requirePersonalAccess.
 */
import type { NextRequest } from "next/server";
import {
  registerAuthAdapter,
  registerProviderResolver,
  registerThemeAdapter,
  registerDavResolver,
  type ResolvedAccount,
} from "@tgv/module-inbox";
import { enumerateAccounts } from "@tgv/module-inbox/fastmail/client";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { memberIdFor } from "@/lib/inbox/caller";
import { resolveInboxAccount, resolveInboxAccounts } from "@/lib/inbox/store";
import { tokenForUser, appPasswordForUser } from "@/lib/fastmail-token";
import { colors, rgb } from "@/app/theme";

let registered = false;

/** Wrap a JMAP-enumerated account in the resolver's ResolvedAccount shape. */
function toResolvedAccount(accountId: string, email: string, token: string): ResolvedAccount {
  return {
    accountId,
    email,
    provider: "fastmail",
    credentials: { provider: "fastmail", token },
  };
}

export function setupInbox(): void {
  if (registered) return;
  registered = true;

  registerAuthAdapter({
    requireAuth: async (req: NextRequest) => {
      const t = await requireAuth(req);
      if (!t || !t.username) return null;
      return { username: t.username, name: t.name, sub: t.sub };
    },
    requirePersonalAccess,
  });

  // Accounts come from two places: the mailboxes this staff member connected themselves
  // (inbox_accounts, shared with their tinyglobalvillage.com dashboard — any provider), and
  // the legacy FASTMAIL_TOKEN_<USER> env token, kept as a fallback so the original staff
  // inboxes keep working. A mailbox present in both is listed once, from the database.
  const envAccounts = async (username: string): Promise<ResolvedAccount[]> => {
    const token = tokenForUser(username);
    if (!token) return [];
    try {
      return (await enumerateAccounts(token)).map((a) => toResolvedAccount(a.key, a.email, token));
    } catch {
      return [];
    }
  };
  const ownAccounts = async (username: string): Promise<ResolvedAccount[]> => {
    try {
      const memberId = await memberIdFor(username);
      return memberId ? await resolveInboxAccounts(memberId) : [];
    } catch {
      return [];
    }
  };

  registerProviderResolver({
    listAccountsForUser: async (username) => {
      const [own, env] = await Promise.all([ownAccounts(username), envAccounts(username)]);
      const seen = new Set(own.map((a) => a.accountId));
      return [...own, ...env.filter((a) => !seen.has(a.accountId))];
    },
    resolve: async (username, accountKey) => {
      try {
        const memberId = await memberIdFor(username);
        const own = memberId ? await resolveInboxAccount(memberId, accountKey) : null;
        if (own) return own;
      } catch { /* fall through to the env token */ }
      return (await envAccounts(username)).find((a) => a.accountId === accountKey) ?? null;
    },
  });

  registerThemeAdapter({ colors, rgb });

  // Calendar (CalDAV), Notes (IMAP) and Files (WebDAV) need a Fastmail app password —
  // the JMAP token doesn't cover them. The DAV/IMAP username is the Fastmail login address.
  registerDavResolver((username, loginEmail, service) => {
    const password = appPasswordForUser(username, service);
    return password ? { user: loginEmail, password } : null;
  });
}

setupInbox();
