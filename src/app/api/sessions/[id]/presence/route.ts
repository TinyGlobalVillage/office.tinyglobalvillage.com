export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { checkJoinAccess, heartbeatPresence } from "@/lib/sessions";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST — record that the caller's device is currently in the session (heartbeat).
 * Body: `{ present?: boolean; deviceId: string }`. `present: false` clears the
 * specific (user, device) seat and triggers the auto-delete sweep for user
 * rooms. `deviceId` is a per-tab UUID so multi-device users each get a seat.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as { present?: boolean; deviceId?: string };
  const present = body.present !== false; // default true
  const deviceId = typeof body.deviceId === "string" && body.deviceId.trim()
    ? body.deviceId.trim()
    : "";
  if (!deviceId) {
    return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
  }

  if (present) {
    const check = checkJoinAccess(id, username);
    if (!check.ok) {
      const status = check.code === "not-found" ? 404 : check.code === "forbidden" ? 403 : 403;
      return NextResponse.json({ error: check.message, code: check.code }, { status });
    }
  }

  const session = heartbeatPresence(id, username, deviceId, present);
  return NextResponse.json({ ok: true, session });
}
