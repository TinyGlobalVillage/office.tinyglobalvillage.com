// Office's mount of the shared forum (@tgv/module-forum) — the twin of src/lib/im/server.ts.
//
// Office is not a site, so "my forum" has no single answer here: a staffer who is also a villager
// may stand in several forums at once. The chat drawer's Forums list reads `GET /api/forum/mine`
// and opens whichever one they pick by naming its site, and naming a site grants nothing — the
// module re-derives what the caller may do there from their own relationship to it.
import "server-only";
import type { NextRequest } from "next/server";
import { createTenantForum } from "@tgv/module-forum/server";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db-drizzle";
import { emailForOfficeUser } from "@/lib/im/server";

export const forum = createTenantForum({
  db,
  auth: async (req) => {
    if (!req) return null;
    const token = await requireAuth(req as NextRequest);
    const username = token?.username ?? token?.sub;
    const email = emailForOfficeUser(username);
    return email ? { user: { email, name: token?.name ?? username ?? null } } : null;
  },
});
