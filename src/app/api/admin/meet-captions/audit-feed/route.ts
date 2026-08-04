// GET /api/admin/meet-captions/audit-feed?limit=N
//
// Activity Timeline for the MeetCaptionsControlModal — operator config changes from
// admin_audit_log (action `meet_captions.*`). Captions themselves are ephemeral (never stored),
// so unlike the suites there is no per-tenant activity to synthesize. Read-only, requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { fetchAdminAuditRows } from "@/lib/suite-oversight";

export const runtime = "nodejs";

const ADMIN_ACTIONS = [
  "meet_captions.killswitch_on",
  "meet_captions.killswitch_off",
  "meet_captions.config_updated",
] as const;

const ADMIN_LABEL: Record<string, string> = {
  "meet_captions.killswitch_on": "killswitch engaged — captions off platform-wide",
  "meet_captions.killswitch_off": "killswitch released — captions available",
  "meet_captions.config_updated": "engine config updated",
};
const ADMIN_OUTCOME: Record<string, string> = {
  "meet_captions.killswitch_on": "warn",
  "meet_captions.killswitch_off": "ok",
  "meet_captions.config_updated": "ok",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "120")));

  const rows = await fetchAdminAuditRows({
    actions: ADMIN_ACTIONS,
    labels: ADMIN_LABEL,
    outcomes: ADMIN_OUTCOME,
    prefix: "meet_captions.",
    limit,
  });

  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return NextResponse.json({ rows: rows.slice(0, limit) });
}
