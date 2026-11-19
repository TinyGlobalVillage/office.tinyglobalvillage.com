// /api/hardening/rcs-maintenance — Utils → System Hardening → RCS Maintenance.
//   GET  → { ok, report, reboots[], samplerError }
//   POST → { config: Partial<MaintenanceConfig> }  retune (audit-logged)
//        | { action: "test" }                      send a [TEST] notice on both channels
// The notices themselves are sent by the host-metrics sampler's tick
// (src/lib/rcs-maintenance/maintenance.ts); this route only reads and tunes.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { hostMetricsState } from "@/lib/host-metrics/state";
import { type MaintenanceConfig, readMaintenanceConfig, writeMaintenanceConfig } from "@/lib/rcs-maintenance/config";
import { maintenanceStatus, readReboots, sendMaintenanceTest } from "@/lib/rcs-maintenance/maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TUNABLE: Array<keyof MaintenanceConfig> = [
  "enabled", "rebootAlerts", "updatesAlerts", "updatesScope", "updatesThresholdHours",
  "rebootThresholdHours", "reminderDays", "frontDesk", "email", "recipients", "aptCheckEveryMin",
];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const report = await maintenanceStatus();
  return NextResponse.json({
    ok: true,
    report,
    reboots: readReboots(20),
    samplerError: hostMetricsState().lastMaintenanceError ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { action?: string; config?: Record<string, unknown> };

  if (body.action === "test") {
    const rec = await sendMaintenanceTest(auth.username);
    return NextResponse.json({ ok: rec.frontDesk === "sent" || rec.email === "sent", send: rec });
  }

  const patch: Partial<MaintenanceConfig> = {};
  for (const k of TUNABLE) if (body.config && k in body.config) (patch as Record<string, unknown>)[k] = body.config[k];
  if (!Object.keys(patch).length) return NextResponse.json({ ok: false, error: "nothing to change" }, { status: 400 });
  const before = readMaintenanceConfig();
  const next = writeMaintenanceConfig(patch, auth.username);
  const changed = Object.fromEntries(
    TUNABLE.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(next[k])).map((k) => [k, { from: before[k], to: next[k] }]),
  );
  logHardeningAction({ action: "rcs-maintenance.config.update", target: "rcs-maintenance-config", user: auth.username, success: true, details: changed });
  return NextResponse.json({ ok: true, config: next });
}
