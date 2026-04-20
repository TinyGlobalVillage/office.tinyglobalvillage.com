export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  startRing,
  cancelRing,
  resolveRingForUser,
  getRingFor,
  type RingChannel,
} from "@/lib/ring-calls";
import { readGroupDb } from "../group/route";
import { getSession } from "@/lib/sessions";

function parseChannel(body: unknown): RingChannel | null {
  if (!body || typeof body !== "object") return null;
  const c = (body as { channel?: unknown }).channel as RingChannel | undefined;
  if (!c || typeof c !== "object") return null;
  if (c.type !== "dm" && c.type !== "group" && c.type !== "session") return null;
  if (typeof c.id !== "string" || !c.id) return null;
  if (typeof c.name !== "string") return null;
  return c;
}

function resolveRecipients(channel: RingChannel, caller: string): string[] {
  if (channel.type === "dm") {
    // DM channel id: `[a, b].sort().join("_")`.
    const parts = channel.id.split("_");
    return parts.filter(p => p && p !== caller);
  }
  if (channel.type === "group") {
    const db = readGroupDb();
    const group = db.groups[channel.id];
    if (!group) return [];
    return group.memberIds.filter(m => m !== caller);
  }
  // session
  const s = getSession(channel.id);
  if (!s) return [];
  // For session rings, target every current member minus the caller.
  return s.memberIds.filter(m => m !== caller);
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const ring = getRingFor(username);
  return NextResponse.json({ ring });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const channel = parseChannel(body);
  if (!channel) return NextResponse.json({ error: "Invalid channel" }, { status: 400 });

  const recipients = resolveRecipients(channel, username);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "No recipients" }, { status: 400 });
  }

  const ring = startRing({ from: username, to: recipients, channel });
  return NextResponse.json({ ok: true, ring });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const channel = parseChannel(body);
  if (!channel) return NextResponse.json({ error: "Invalid channel" }, { status: 400 });

  const action = (body as { action?: string } | null)?.action ?? "cancel";
  const fromRaw = (body as { from?: string } | null)?.from;

  if (action === "cancel") {
    // Caller cancelling their own outgoing ring.
    cancelRing(username, channel);
    return NextResponse.json({ ok: true });
  }

  // reject / accept / accept-notify — clear this user's slot from the ring.
  if (!fromRaw) return NextResponse.json({ error: "Missing from" }, { status: 400 });
  resolveRingForUser(fromRaw, channel, username);
  return NextResponse.json({ ok: true });
}
