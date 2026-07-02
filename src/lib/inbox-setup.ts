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
  type ResolvedAccount,
} from "@tgv/module-inbox";
import { enumerateAccounts } from "@tgv/module-inbox/fastmail/client";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { colors, rgb } from "@/app/theme";

let registered = false;

/** Maps an Office username to its Fastmail bearer token (or null if user has no inbox access). */
function tokenForUser(username: string): string | null {
  if (username === "admin") return process.env.FASTMAIL_TOKEN_GIO ?? null;
  if (username === "marmar") return process.env.FASTMAIL_TOKEN_MARMAR ?? null;
  return null;
}

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

  registerProviderResolver({
    listAccountsForUser: async (username) => {
      const token = tokenForUser(username);
      if (!token) return [];
      const accounts = await enumerateAccounts(token);
      return accounts.map((a) => toResolvedAccount(a.key, a.email, token));
    },
    resolve: async (username, accountKey) => {
      const token = tokenForUser(username);
      if (!token) return null;
      const accounts = await enumerateAccounts(token);
      const match = accounts.find((a) => a.key === accountKey);
      if (!match) return null;
      return toResolvedAccount(match.key, match.email, token);
    },
  });

  registerThemeAdapter({ colors, rgb });
}

setupInbox();
