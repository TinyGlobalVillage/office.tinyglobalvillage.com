import { type NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";
import { recordKillswitchAction } from "@/lib/system/killswitch-log";

// Office UI killswitch endpoint — telephony-security Item 5 (2026-05-02).
//
// Wraps `/usr/local/bin/sip-killswitch` (the on-disk script that toggles
// UFW + Sofia profiles in one command). Admin-only via the shared
// `requireAdmin` — it resolves the role roster-first (office-staff.json,
// legacy users.json only as a fallback), so an admin who exists solely on
// the roster isn't refused here while every other admin surface lets them
// in. This route used to carry its own users.json-only copy of the gate,
// which pre-dated the roster and silently drifted from it. Voice goes
// OFFLINE on `engage`, comes back ONLINE on `restore`. `status` is
// read-only.
//
// The whole point is that the operator can lock SIP from any browser,
// from anywhere, in 60 seconds — no SSH, no script paths to remember.

const execAsync = promisify(exec);

const KILLSWITCH = "/usr/local/bin/sip-killswitch";

// GET — current killswitch + gateway state. Used by SystemToolsModal to
// render the engaged/restored pill.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { stdout } = await execAsync(`sudo -n ${KILLSWITCH} --status`, {
      timeout: 8000,
    });
    // Parse: if the status output mentions "REGED" anywhere, voice is up.
    const reged = /REGED/.test(stdout);
    // If both UFW deny rules are active, killswitch is engaged.
    const engaged =
      /5080(\/udp)?\s+DENY/.test(stdout) ||
      /Sofia profiles:\s*\n\s*$/.test(stdout); // empty profile list = engaged
    return NextResponse.json({
      engaged,
      gatewayRegistered: reged,
      raw: stdout,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Killswitch script failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}

// POST — engage or restore. Body: { action: "engage" | "restore" }.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (action !== "engage" && action !== "restore") {
    return NextResponse.json(
      { error: "action must be 'engage' or 'restore'" },
      { status: 400 },
    );
  }

  const flag = action === "engage" ? "--engage" : "--restore";
  try {
    const { stdout, stderr } = await execAsync(`sudo -n ${KILLSWITCH} ${flag}`, {
      timeout: 30000,
    });
    recordKillswitchAction({
      by: auth.username,
      action,
      outcome: "ok",
      detail: (stdout + stderr).slice(-400) || null,
    });
    return NextResponse.json({
      ok: true,
      action,
      by: auth.username,
      stdout,
      stderr,
    });
  } catch (err) {
    recordKillswitchAction({
      by: auth.username,
      action,
      outcome: "fail",
      detail: (err as Error).message.slice(0, 400),
    });
    return NextResponse.json(
      { error: "Killswitch script failed", detail: (err as Error).message },
      { status: 500 },
    );
  }
}
