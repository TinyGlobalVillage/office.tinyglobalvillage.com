// /api/payroll/revisions — the staff revision-request queue (0094 consumer).
// POST {id, action: 'resolved'|'dismissed'} → stamps status/resolved_at/resolved_by.
// Office-authed; the resolver is attributed by members.id. Staff re-file after
// resolution if still wrong (one OPEN per entry is enforced by the 0094 index).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { resolveAdminMemberId } from "@/lib/support-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as { id?: unknown; action?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const action = body.action === "resolved" || body.action === "dismissed" ? body.action : null;
  if (!id || !action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const resolvedBy = await resolveAdminMemberId(gate.username);
  const { rowCount } = await pgPool.query(
    `UPDATE staff_time_revision_requests
        SET status = $1, resolved_at = now(), resolved_by = $2
      WHERE id = $3 AND status = 'open'`,
    [action, resolvedBy, id],
  );
  if (!rowCount) return NextResponse.json({ error: "not_open_or_missing" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
