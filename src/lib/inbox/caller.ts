// Who is asking, for the mailbox-connecting routes: the signed-in staff member, with a
// passed second step, resolved to their member id (the key `inbox_accounts` is held by).
import "server-only";
import type { NextRequest } from "next/server";
import { requireAuth, requirePersonalAccess } from "@/lib/api-auth";
import { resolveAdminActorId } from "@/lib/admin-actor";

export type InboxCaller = { username: string; memberId: string; name: string };

export async function resolveInboxCaller(req: NextRequest): Promise<InboxCaller | null> {
  const t = await requireAuth(req);
  if (!t?.username) return null;
  // Same door as reading the mail itself: a session that has passed its second step.
  if (requirePersonalAccess(req, "", t.username) !== "ok") return null;
  const memberId = await memberIdFor(t.username);
  return memberId ? { username: t.username, memberId, name: (t.name ?? "").trim() || t.username } : null;
}

/** Office username → members.id (roster email → members row). Null when the staff member has no member record. */
export const memberIdFor = (username: string): Promise<string | null> => resolveAdminActorId(username);
