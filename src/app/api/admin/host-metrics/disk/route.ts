// GET /api/admin/host-metrics/disk — where the disk actually went.
//
//   ?refresh=1   re-run `du` instead of answering from the cache
//   ?cached=1    answer from the cache or say there isn't one; never scans
//
// A scan walks a million inodes, so the default is the 30-minute cache and the
// modal paints instantly. `cached=1` is for the first paint: it lets the UI show
// what it has and put a Refresh button next to it, rather than hanging the modal
// open for a minute the first time someone clicks the section.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { cachedScan, scanDisk } from "@/lib/host-metrics/disk-usage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);

  if (searchParams.get("cached") === "1") {
    const scan = cachedScan();
    return NextResponse.json(scan ?? { scan: null, needsScan: true });
  }

  try {
    return NextResponse.json(await scanDisk(searchParams.get("refresh") === "1"));
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
