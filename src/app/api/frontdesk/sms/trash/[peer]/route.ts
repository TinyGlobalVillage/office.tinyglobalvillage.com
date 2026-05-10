/**
 * DELETE /api/frontdesk/sms/trash/<peer>
 *
 * Permanently delete a soft-deleted thread. Cannot be undone.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { permanentDeleteThread } from "@/lib/frontdesk/sms";
import { toE164 } from "@/lib/frontdesk/store";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ peer: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { peer } = await ctx.params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });
  const ok = permanentDeleteThread(e164);
  if (!ok) return NextResponse.json({ error: "Not in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
