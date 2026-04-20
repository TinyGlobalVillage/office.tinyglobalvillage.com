export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkJoinAccess, heartbeatPresence } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — record that the caller is currently in the session (heartbeat).
 * Body: `{ present: boolean }`. `false` clears the caller's presence and
 * triggers the auto-delete sweep for user-created rooms.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { present?: boolean };
  const present = body.present !== false; // default true

  if (present) {
    const check = checkJoinAccess(id, username);
    if (!check.ok) {
      const status = check.code === "not-found" ? 404 : check.code === "forbidden" ? 403 : 403;
      return NextResponse.json({ error: check.message, code: check.code }, { status });
    }
  }

  const session = heartbeatPresence(id, username, present);
  return NextResponse.json({ ok: true, session });
}
