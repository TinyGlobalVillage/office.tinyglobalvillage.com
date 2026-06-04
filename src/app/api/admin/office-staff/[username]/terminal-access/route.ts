// POST /api/admin/office-staff/[username]/terminal-access
//
// Admin-only toggle for a staff member's in-dashboard terminal grant. The
// terminal (`/api/exec`) runs whitelisted RCS infra scripts, so it's gated to
// admins (always) + non-admin staff an admin has explicitly granted. The grant
// is stored as `terminalAccess` on the office-staff.json roster (the canonical
// Office roster) and read by `canUseTerminal()` for both the server gate and
// the client UI gate. Audit-logged.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readRoster } from "@/lib/member-auth/bridge";
import { logHardeningAction } from "@/lib/audit-log";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROSTER_FILE = path.join(process.cwd(), "data", "office-staff.json");

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { username } = await ctx.params;

  const roster = readRoster();
  if (!roster[username]) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: { enabled?: unknown };
  try {
    body = (await req.json()) as { enabled?: unknown };
  } catch {
    body = {};
  }
  const enabled = body.enabled === true;

  roster[username].terminalAccess = enabled;
  fs.writeFileSync(ROSTER_FILE, JSON.stringify(roster, null, 2) + "\n");

  logHardeningAction({
    action: "auth.terminal.access",
    target: username,
    user: gate.username,
    success: true,
    details: { enabled },
  });

  return NextResponse.json({ ok: true, username, enabled });
}
