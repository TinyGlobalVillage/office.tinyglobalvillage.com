// Office's mount of the shared messenger (@tgv/module-tim). Office is the STAFF surface: every
// signed-in staffer gets in (a village handle is optional), staff conversations sit beside the
// village ones, and a staffer who is also a villager is one member row — so the conversation with
// a colleague is the same thread here and on their dashboard.
//
// Identity: an Office session is an Office username; the member is found by that username's
// roster email (office-staff.json, then users.json for a legacy account).
import "server-only";
import type { NextRequest } from "next/server";
import { Client } from "pg";
import { createTenantIM } from "@tgv/module-tim/server";
import { livekitEnv, mintToken } from "@tgv/module-video-calls/server/livekit";
import { requireAuth } from "@/lib/api-auth";
import { rosterEmailForUsername } from "@/lib/member-auth/bridge";
import { getUser } from "@/lib/users";
import { db } from "@/lib/db-drizzle";

export function emailForOfficeUser(username: string | undefined): string | null {
  if (!username) return null;
  return rosterEmailForUsername(username) ?? getUser(username)?.email?.toLowerCase() ?? null;
}

// Calls and attachments. Both are optional in the module and both are switched on here:
//   · a call is a LiveKit room the two apps share, so a villager on a dashboard and a staffer in
//     Office are in the same call. No LiveKit env ⇒ no call buttons, nothing else changes.
//   · attachments live in ONE private directory every app that mounts the messenger reads, and are
//     served only to members of the conversation they were sent in.
const lk = livekitEnv();
const mintCallGrant = lk
  ? async (p: { room: string; identity: string; name: string }) => {
      const g = await mintToken({ env: lk, identity: p.identity, name: p.name, room: p.room, canPublish: true, canSubscribe: true });
      return { token: g.token, url: g.url };
    }
  : undefined;
const files = { root: process.env.IM_FILES_ROOT ?? "/srv/refusion-core/cdn-private/im" };

export const im = createTenantIM({
  db,
  surface: "office",
  mintCallGrant,
  files,
  auth: async (req) => {
    if (!req) return null;
    const token = await requireAuth(req as NextRequest);
    const username = token?.username ?? token?.sub;
    const email = emailForOfficeUser(username);
    return email ? { user: { email, name: token?.name ?? username ?? null } } : null;
  },
  // Push: one dedicated connection that LISTENs for every change any app makes to a conversation.
  listen: async () => {
    const c = new Client({ connectionString: process.env.DATABASE_URL, application_name: "tim-listen-office" });
    await c.connect();
    return c;
  },
});
