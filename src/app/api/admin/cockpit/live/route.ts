// GET /api/admin/cockpit/live — one live frame for the Cockpit (CPU per core, RAM, swap, disk, load,
// temps, network, disk I/O, pm2 apps, workshop slice) + the annunciator lights. Admin only.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { liveFrame } from "@/lib/cockpit/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(await liveFrame(), { headers: { "Cache-Control": "no-store" } });
}
