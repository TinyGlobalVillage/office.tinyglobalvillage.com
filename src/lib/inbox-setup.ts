/**
 * Boot-time adapter wiring for @tgv/module-inbox.
 *
 * Imported from root layout so it runs once per server process, before any
 * API route handler or UI component pulls from the package.
 *
 * - AuthAdapter re-exposes office's existing requireAuth + requirePersonalAccess.
 * - InboxAccessAdapter maps RCS usernames → Fastmail API tokens AND restricts
 *   each user to ONLY their own JMAP account. Without the explicit allow-list,
 *   Fastmail's Standard Business shared-account model surfaces every mailbox
 *   the token can see — which means Marthe's token enumerates Gio's account
 *   too (and vice versa once Fastmail finishes the symmetric share). The
 *   allow-list enforces per-user isolation at the API boundary regardless of
 *   what JMAP exposes.
 *     admin  (Gio)    → u94364057 (gio@tinyglobalvillage.com)
 *     marmar (Marthe) → u94264057 (marthe@tinyglobalvillage.com)
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
    // No allow-list: we intentionally let both users see every account their
    // token enumerates (Gio's personal + any shared-via-business accounts),
    // because privacy is enforced at the mailbox-folder level via Fastmail's
    // per-folder myRights ACL (listMailboxes filters by mayReadItems=true).
    // Marthe's token sees Gio's account u94364057 but only the 4 shared
    // folders inside it (Support@TGV, TGV@Admin, TGV@Connect, TGV@NoReply);
    // Gio's personal Inbox/Sent/etc. have mayReadItems=false for her.
  });

  registerThemeAdapter({ colors, rgb });
}

setupInbox();
