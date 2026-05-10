/**
 * GET /api/frontdesk/sms/trash
 *
 * List soft-deleted SMS threads. Each entry includes when it was deleted and
 * when it'll auto-purge (30 days after deletion). Reading this endpoint also
 * triggers a lazy purge of any threads past their retention window.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { listTrash, trashRetentionDays } from "@/lib/frontdesk/sms";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const trashed = listTrash();
  return NextResponse.json({ trashed, retentionDays: trashRetentionDays() });
}
