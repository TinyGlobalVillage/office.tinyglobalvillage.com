// GET   /api/admin/failover — RCS1 warm standby: status, health, next drill, file copies, settings
// PATCH /api/admin/failover — merge a settings update (clamped)
// POST  /api/admin/failover — { action: "drill" } asks RCS2 to run a sealed drill on RCS1 now
//
// The standby itself runs from root cron on both boxes (mono utils/scripts/system/failover/);
// this route only reads what they publish and edits settings.env. See src/lib/failover/state.ts.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readSettings, readSnapshot, requestDrill, writeSettings, TUNABLE, type FailoverSettings } from "@/lib/failover/state";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json(readSnapshot());
}

async function body(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const o = await body(req);
  if (!o) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (!readSnapshot().installed) return NextResponse.json({ error: "Failover is not installed on this box." }, { status: 409 });
  const patch: Record<string, unknown> = {};
  for (const f of TUNABLE) if (f in o) patch[f] = o[f];

  const before = readSettings();
  let next: FailoverSettings;
  try {
    next = writeSettings(patch as Partial<FailoverSettings>);
  } catch (e) {
    logHardeningAction({ action: "failover.settings.update", user: gate.username, success: false, details: (e as Error).message });
    return NextResponse.json({ error: `Could not write the settings: ${(e as Error).message}` }, { status: 500 });
  }
  const show = (v: unknown) => (Array.isArray(v) ? v.join(" ") : String(v));
  const changed = TUNABLE.filter((f) => show(before[f]) !== show(next[f]));
  if (changed.length) {
    const action =
      "hold" in patch && before.hold !== next.hold ? `failover.hold.${next.hold ? "on" : "off"}`
      : "autoTakeover" in patch && before.autoTakeover !== next.autoTakeover ? `failover.auto.${next.autoTakeover ? "on" : "off"}`
      : "failover.settings.update";
    logHardeningAction({
      action,
      target: null,
      user: gate.username,
      success: true,
      details: Object.fromEntries(changed.map((f) => [f, `${show(before[f])} → ${show(next[f])}`])),
    });
  }
  return NextResponse.json(readSnapshot());
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const o = await body(req);
  if (o?.action !== "drill") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const snap = readSnapshot();
  if (!snap.installed) return NextResponse.json({ error: "Failover is not installed on this box." }, { status: 409 });
  if (snap.rcs1?.role && snap.rcs1.role !== "standby") return NextResponse.json({ error: "RCS1 is not in standby — no drill while it serves." }, { status: 409 });
  try {
    requestDrill();
  } catch (e) {
    logHardeningAction({ action: "failover.drill.request", user: gate.username, success: false, details: (e as Error).message });
    return NextResponse.json({ error: `Could not request the drill: ${(e as Error).message}` }, { status: 500 });
  }
  logHardeningAction({ action: "failover.drill.request", target: "rcs1", user: gate.username, success: true });
  return NextResponse.json(readSnapshot());
}
