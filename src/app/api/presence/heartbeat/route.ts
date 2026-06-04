/**
 * POST /api/presence/heartbeat
 * Called every 30s by the client shell while the Office site is open.
 * Resolves the pinging user via getEffectiveUser() so BOTH a member session
 * (tgv_office_session) and a legacy NextAuth JWT identify the same person —
 * otherwise a passkey/member-only user would be invisible to presence.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/dev/getEffectiveUser";
import { recordHeartbeat } from "@/lib/presence-store";

export async function POST(req: NextRequest) {
  const eff = await getEffectiveUser(req);
  const username = eff?.username;

  if (!username) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  recordHeartbeat(username);
  return NextResponse.json({ ok: true, username });
}
