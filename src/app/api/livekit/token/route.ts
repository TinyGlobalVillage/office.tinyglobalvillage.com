export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { AccessToken } from "livekit-server-sdk";

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

  const { room = "tgv-office-team" } = await req.json().catch(() => ({})) as { room?: string };

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
