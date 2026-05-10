/**
 * POST /api/presence/heartbeat
 * Called every 30s by the client shell while the Office site is open.
 * Reads the JWT directly (same as middleware) to identify who is pinging.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { recordHeartbeat } from "@/lib/presence-store";

const USERS: Record<string, string> = { "1": "admin", "2": "marmar" };

export async function POST(req: NextRequest) {
  const token = await getAuthToken(req);

  // token.username is set by the jwt callback; fall back to sub (user id) lookup
  const username =
    (token?.username as string | undefined) ??
    (token?.sub ? USERS[token.sub] : undefined);

  if (!username) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  recordHeartbeat(username);
  return NextResponse.json({ ok: true, username });
}
