import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { toE164 } from "@/lib/frontdesk/store";
import { listThreadMessages, markThreadRead, deleteThread } from "@/lib/frontdesk/sms";
import { findContactByPhone } from "@/lib/frontdesk/contacts";

export async function GET(req: NextRequest, { params }: { params: Promise<{ peer: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { peer } = await params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });
  const messages = listThreadMessages(e164);
  const contact = findContactByPhone(e164);
  return NextResponse.json({ peerE164: e164, peerName: contact?.name ?? null, messages });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ peer: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const { peer } = await params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });
  markThreadRead(e164, username);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ peer: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { peer } = await params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });
  const ok = deleteThread(e164);
  if (!ok) return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
