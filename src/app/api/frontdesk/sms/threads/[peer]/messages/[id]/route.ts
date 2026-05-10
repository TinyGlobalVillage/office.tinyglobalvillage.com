/**
 * Delete a single SMS message from a thread.
 *   DELETE /api/frontdesk/sms/threads/<peer>/messages/<id>
 *
 * Local persistence only (sms.json). Telnyx-side records are unaffected.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { deleteMessage } from "@/lib/frontdesk/sms";
import { toE164 } from "@/lib/frontdesk/store";

export const runtime = "nodejs";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ peer: string; id: string }> }
) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { peer, id } = await ctx.params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164 || !id) return NextResponse.json({ error: "Invalid peer or id" }, { status: 400 });
  const ok = deleteMessage(e164, id);
  if (!ok) return NextResponse.json({ error: "Message not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
