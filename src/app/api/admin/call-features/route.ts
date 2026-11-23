// /api/admin/call-features — Office's switchboard for the ONE call surface (Gio 2026-11-23): which
// features Meetings, TIM calls and Sessions each offer. GET → every surface's features; PUT
// { surface, features } → save. Shared tgv_db table call_features (HQ migration 0267), read live by
// every call on tgv.com and Office. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { createCallFeatureHandlers } from "@tgv/module-video-calls/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const h = createCallFeatureHandlers({
  db,
  canEdit: async (req) => !((await requireAdmin(req as NextRequest)) instanceof NextResponse),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return h.GET(req);
}
export const PUT = (req: NextRequest) => h.PUT(req);
