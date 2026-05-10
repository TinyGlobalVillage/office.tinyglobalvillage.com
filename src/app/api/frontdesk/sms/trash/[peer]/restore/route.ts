/**
 * POST /api/frontdesk/sms/trash/<peer>/restore
 *
 * Move a soft-deleted thread back to the active thread list. Idempotent —
 * safe to call multiple times.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { restoreThread } from "@/lib/frontdesk/sms";
import { toE164 } from "@/lib/frontdesk/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest, ctx: { params: Promise<{ peer: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { peer } = await ctx.params;
  const e164 = toE164(decodeURIComponent(peer));
  if (!e164) return NextResponse.json({ error: "Invalid peer" }, { status: 400 });
  const ok = restoreThread(e164);
  if (!ok) return NextResponse.json({ error: "Not in trash" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
