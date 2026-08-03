// POST /api/admin/host-metrics/sample
//
// "Sample now" — writes a row immediately instead of waiting out the cadence.
// Used when someone changes something on the box and wants a data point either
// side of it, and to prove the pipeline works right after the DDL is applied.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { sampleOnce, samplerStatus } from "@/lib/host-metrics/sampler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  try {
    // force: bypasses both the disabled switch and the priming skip, because a
    // human pressing a button is an explicit request, not a scheduled tick.
    const row = await sampleOnce(true);
    if (!row) {
      const { lastSkip } = samplerStatus();
      return NextResponse.json(
        { ok: false, reason: lastSkip ?? "unknown", sampler: samplerStatus() },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, row, sampler: samplerStatus() });
  } catch (err) {
    // The message is the DB's own — admin-only route, and hiding it here just
    // means the operator has to go read pm2 logs to learn the table is missing.
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
