// GET   /api/admin/workshop-db — config + status of the workshop DB refresh
// PATCH /api/admin/workshop-db — merge a config update (schedule, databases, kept contacts)
//
// The refresh itself is a root systemd job (utils/scripts/build-pipeline/workshop-db-refresh.sh);
// this route only reads its status and edits its config file. See src/lib/workshop-db/state.ts.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readConfig, readStatus, writeConfig, type WorkshopDbConfig } from "@/lib/workshop-db/state";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const FIELDS = ["enabled", "time", "databases", "keepDomains", "keepEmails"] as const;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ config: readConfig(), ...readStatus() });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const o = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const f of FIELDS) if (f in o) patch[f] = o[f];

  const before = readConfig();
  let next: WorkshopDbConfig;
  try {
    next = writeConfig(patch as Partial<WorkshopDbConfig>);
  } catch (e) {
    return NextResponse.json({ error: `Could not write the config: ${(e as Error).message}` }, { status: 500 });
  }
  const changed = FIELDS.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(next[f]));
  if (changed.length) {
    logHardeningAction({
      action: "workshop-db.config.update",
      target: null,
      user: gate.username,
      success: true,
      details: Object.fromEntries(changed.map((f) => [f, `${JSON.stringify(before[f])} → ${JSON.stringify(next[f])}`])),
    });
  }
  return NextResponse.json({ config: next, ...readStatus() });
}
