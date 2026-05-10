import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { listTollFraudAttempts } from "@/lib/frontdesk/toll-fraud";
import { listKillswitchActions } from "@/lib/system/killswitch-log";

// GET /api/frontdesk/admin/telephony/audit-log
//
// Combined chronological timeline used by the Telephony modal's audit log
// section. Merges:
//   - toll-fraud attempts (banned IPs, regex rejections, telnyx billing alerts)
//   - killswitch action log (engage/restore events)
// Sorted newest-first. Caller can filter client-side.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(2000, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  type TimelineRow = {
    id: string;
    ts: string;
    kind: "toll-fraud" | "killswitch";
    label: string;
    detail: string | null;
    ip: string | null;
    by: string | null;
    outcome: string;
  };

  const tollFraud = listTollFraudAttempts(limit).map<TimelineRow>(r => ({
    id: r.id,
    ts: r.ts,
    kind: "toll-fraud",
    label: r.outcome.replaceAll("_", " "),
    detail: r.detail,
    ip: r.sourceIp,
    by: null,
    outcome: r.outcome,
  }));

  const killswitch = listKillswitchActions(limit).map<TimelineRow>(r => ({
    id: r.id,
    ts: r.ts,
    kind: "killswitch",
    label: `Killswitch ${r.action}`,
    detail: r.detail,
    ip: null,
    by: r.by,
    outcome: r.outcome,
  }));

  const combined = [...tollFraud, ...killswitch]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, limit);

  return NextResponse.json({ rows: combined });
}
