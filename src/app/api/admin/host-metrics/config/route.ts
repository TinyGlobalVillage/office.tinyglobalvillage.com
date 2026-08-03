// GET  /api/admin/host-metrics/config  — current tunables
// PATCH /api/admin/host-metrics/config — merge a partial update
//
// The Hardening modal's write path. Values are clamped in the config layer, not
// rejected here, so a slip in a number field can't leave the box unmonitored —
// see CLAMPS in src/lib/host-metrics/config.ts.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readConfig, writeConfig, type HostMetricsConfig } from "@/lib/host-metrics/config";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

const FIELDS = [
  "sampleIntervalMs",
  "retentionDays",
  "nicCapMbps",
  "warnPct",
  "criticalPct",
  "samplingEnabled",
  "alertsEnabled",
] as const;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(readConfig());
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

  // Allow-list, so a stray key in the request can't write itself into the file.
  const patch: Partial<HostMetricsConfig> = {};
  for (const f of FIELDS) {
    if (!(f in o)) continue;
    const v = o[f];
    if (f === "samplingEnabled" || f === "alertsEnabled") {
      if (typeof v === "boolean") patch[f] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      patch[f] = v;
    }
  }

  const before = readConfig();
  const next = writeConfig(patch);

  // Retuning a threshold changes what the box is allowed to do quietly, so it
  // belongs in the audit log next to the other hardening changes.
  const changed = FIELDS.filter((f) => before[f] !== next[f]);
  if (changed.length) {
    logHardeningAction({
      action: "host-metrics.config.update",
      target: null,
      user: gate.username,
      success: true,
      details: Object.fromEntries(
        changed.map((f) => [f, `${String(before[f])} → ${String(next[f])}`]),
      ),
    });
  }

  return NextResponse.json(next);
}
