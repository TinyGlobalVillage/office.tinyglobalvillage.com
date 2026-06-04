// GET /api/auth/passkeys
//
// Lists the CALLER'S OWN registered passkeys (label + created date). Public at
// the proxy layer (under /api/auth) but enforces its own session check, and
// only ever returns the credentials belonging to the signed-in user.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readUsers } from "@/lib/users";
import { memberUserIdForUsername } from "@/lib/member-auth/bridge";
import { officeMemberAuth } from "@/lib/member-auth/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  const username = (token?.username ?? token?.sub) as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Merge both stores, deduped by credential id — the canonical member_passkeys
  // (3d enrollment target) PLUS any not-yet-migrated legacy users.json passkeys,
  // so the user always sees all of their credentials (and can confirm ≥2).
  const byId = new Map<string, { id: string; deviceName: string; createdAt: string }>();

  for (const c of readUsers()[username]?.webauthnCredentials ?? []) {
    byId.set(c.id, { id: c.id, deviceName: c.deviceName ?? "Passkey", createdAt: c.createdAt ?? "" });
  }

  const memberUserId = await memberUserIdForUsername(username);
  if (memberUserId) {
    const mks = await officeMemberAuth.listPasskeysForUser(memberUserId);
    for (const k of mks) {
      byId.set(k.credentialId, {
        id: k.credentialId,
        deviceName: k.nickname ?? "Passkey",
        createdAt: k.createdAt ? new Date(k.createdAt).toISOString() : "",
      });
    }
  }

  return NextResponse.json({ passkeys: Array.from(byId.values()) });
}
