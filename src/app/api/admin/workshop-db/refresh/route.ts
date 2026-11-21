// POST /api/admin/workshop-db/refresh — "Refresh now": drop the request file the
// systemd .path unit watches. Returns at once; the panel polls GET for progress.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readStatus, requestRun } from "@/lib/workshop-db/state";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const now = readStatus();
  if (!now.installed) return NextResponse.json({ error: "The refresh is not installed on this box." }, { status: 409 });
  if (now.status?.state === "running") return NextResponse.json({ error: "A refresh is already running." }, { status: 409 });
  try {
    requestRun(gate.username);
  } catch (e) {
    logHardeningAction({ action: "workshop-db.refresh.request", user: gate.username, success: false, details: (e as Error).message });
    return NextResponse.json({ error: `Could not request a run: ${(e as Error).message}` }, { status: 500 });
  }
  logHardeningAction({ action: "workshop-db.refresh.request", user: gate.username, success: true });
  return NextResponse.json({ ok: true, ...readStatus() });
}
