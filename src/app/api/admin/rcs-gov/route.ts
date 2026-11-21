// GET   /api/admin/rcs-gov — Dev Server Pool: config + live status of the rcs-gov daemon
// PATCH /api/admin/rcs-gov — merge a config update (switch, thresholds, slice caps), clamped
//
// The governor itself is a root systemd daemon (mono utils/scripts/build-pipeline/rcs-gov.py);
// this route only reads its status and edits its config file. See src/lib/rcs-gov/state.ts.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readConfig, readStatus, writeConfig, TUNABLE, type RcsGovConfig } from "@/lib/rcs-gov/state";
import { logHardeningAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

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
  for (const f of TUNABLE) if (f in o) patch[f] = o[f];
  if (!readStatus().installed) return NextResponse.json({ error: "rcs-gov is not installed on this box." }, { status: 409 });

  const before = readConfig();
  let next: RcsGovConfig;
  try {
    next = writeConfig(patch as Partial<RcsGovConfig>);
  } catch (e) {
    logHardeningAction({ action: "rcs-gov.config.update", user: gate.username, success: false, details: (e as Error).message });
    return NextResponse.json({ error: `Could not write the config: ${(e as Error).message}` }, { status: 500 });
  }
  const changed = TUNABLE.filter((f) => before[f] !== next[f]);
  if (changed.length) {
    logHardeningAction({
      action: "enabled" in patch && before.enabled !== next.enabled ? `rcs-gov.switch.${next.enabled ? "on" : "off"}` : "rcs-gov.config.update",
      target: null,
      user: gate.username,
      success: true,
      details: Object.fromEntries(changed.map((f) => [f, `${before[f]} → ${next[f]}`])),
    });
  }
  return NextResponse.json({ config: next, ...readStatus() });
}
