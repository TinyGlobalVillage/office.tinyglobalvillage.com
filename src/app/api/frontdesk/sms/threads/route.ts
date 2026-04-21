import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listThreads } from "@/lib/frontdesk/sms";
import { findContactByPhone } from "@/lib/frontdesk/contacts";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const threads = listThreads().map(t => ({
    peerE164: t.peerE164,
    peerName: findContactByPhone(t.peerE164)?.name ?? null,
    count: t.count,
    unread: t.unreadFor(username),
    lastMessage: t.lastMessage,
  }));
  return NextResponse.json({ threads });
}
