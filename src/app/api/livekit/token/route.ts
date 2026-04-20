export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { requireAuth } from "@/lib/api-auth";
import { checkJoinAccess, roomNameToSessionId, isExec } from "@/lib/sessions";
import { readGroupDb } from "@/app/api/chat/group/route";

type AccessResult =
  | { ok: true }
  | { ok: false; code: string; message: string; status: number };

/**
 * Map a room name to an access decision.
 *
 * Conventions:
 * - `dm:<sortedPair>` — both halves of the pair must be part of the dm id
 * - `group:<groupId>` — user must be a group member (or exec)
 * - `session:<id>` or bare legacy id — delegate to sessions registry
 */
function evaluateRoomAccess(room: string, username: string): AccessResult {
  if (room.startsWith("dm:")) {
    // DM channel-id format matches `threadKey` in /api/chat/dm: `[a, b].sort().join("_")`.
    const pair = room.slice("dm:".length);
    const parts = pair.split("_");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { ok: false, code: "forbidden", message: "Invalid DM room", status: 403 };
    }
    if (!parts.includes(username) && !isExec(username)) {
      return { ok: false, code: "forbidden", message: "Not a participant of this DM", status: 403 };
    }
    return { ok: true };
  }

  if (room.startsWith("group:")) {
    const groupId = room.slice("group:".length);
    const db = readGroupDb();
    const group = db.groups[groupId];
    if (!group) return { ok: false, code: "not-found", message: "Group not found", status: 404 };
    if (!group.memberIds.includes(username) && !isExec(username)) {
      return { ok: false, code: "forbidden", message: "Not a member of this group", status: 403 };
    }
    return { ok: true };
  }

  const sessionId = roomNameToSessionId(room);
  if (!sessionId) {
    return { ok: false, code: "forbidden", message: "Unknown room type", status: 403 };
  }
  const check = checkJoinAccess(sessionId, username);
  if (check.ok) return { ok: true };
  const status = check.code === "not-found" ? 404 : 403;
  return { ok: false, code: check.code, message: check.message, status };
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = token.username ?? token.sub ?? "unknown";
  const displayName = token.name ?? username;

  const url = process.env.LIVEKIT_URL;
  const key = process.env.LIVEKIT_API_KEY;
  const secret = process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) {
    return NextResponse.json({ error: "LiveKit not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as { room?: string };
  const room = typeof body.room === "string" && body.room.trim() ? body.room.trim() : null;
  if (!room) {
    return NextResponse.json({ error: "Room required" }, { status: 400 });
  }

  const access = evaluateRoomAccess(room, username);
  if (!access.ok) {
    return NextResponse.json({ error: access.message, code: access.code }, { status: access.status });
  }

  const at = new AccessToken(key, secret, { identity: username, name: displayName });
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: true,
    canPublishData: true,
  });

  return NextResponse.json({ token: await at.toJwt(), url, room });
}
