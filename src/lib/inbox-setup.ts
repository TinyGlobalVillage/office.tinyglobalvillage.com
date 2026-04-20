/**
 * Boot-time adapter wiring for @tgv/module-inbox.
 *
 * Imported from root layout so it runs once per server process, before any
 * API route handler or UI component pulls from the package.
 *
 * - AuthAdapter re-exposes office's existing requireAuth + requirePersonalAccess.
 * - InboxAccessAdapter maps RCS usernames → Fastmail API tokens. Gio (admin)
 *   uses FASTMAIL_TOKEN_GIO; Marthe (marmar) uses FASTMAIL_TOKEN_MARMAR.
 *   Fastmail's own ACLs decide which shared mailboxes each token enumerates,
 *   so no allow-list is needed here — JMAP visibility IS the gate.
 * - ThemeAdapter hands the package office's color palette so components match
 *   the rest of the dashboard.
 */
import type { NextRequest } from "next/server";
import {
  registerAuthAdapter,
  registerInboxAccessAdapter,
  registerThemeAdapter,
} from "@tgv/module-inbox";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { colors, rgb } from "@/app/theme";

let registered = false;

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

  registerInboxAccessAdapter({
    getTokenForUser: (username) => {
      if (username === "admin")  return process.env.FASTMAIL_TOKEN_GIO ?? null;
      if (username === "marmar") return process.env.FASTMAIL_TOKEN_MARMAR ?? null;
      return null;
    },
  });

  registerThemeAdapter({ colors, rgb });
}

setupInbox();
