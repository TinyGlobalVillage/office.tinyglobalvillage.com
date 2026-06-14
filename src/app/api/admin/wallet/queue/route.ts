// GET /api/admin/wallet/queue?statuses=requested,approved|all&limit=N
//
// Office operator view of the member cash-out queue. Reads the shared tgv_db `withdrawals` table
// DIRECTLY (mirrors the Invitations modal reading invite_codes) — resilient if tgv.com is down,
// and the launch-gated tgv.com /advance route would 403 these reads while withdrawals are off.
//
// READ-ONLY: queue TRANSITIONS (approve/markPaid/markFailed/cancel) reverse the cash ledger and
// MUST run tgv.com's engine — they are NOT implemented here. They arrive with launch (Slice 3);
// there are zero rows to act on while the launch flag is off. 1 token = $0.25.
//
// `withdrawals` is a tgv.com-only table (not in Office's @tgv/module-registry drizzle schema), so
// this uses raw db.execute(sql) rather than a typed db.select.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const ALLOWED_STATUSES = ["requested", "approved", "paid", "failed", "cancelled"];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "200")));

  const raw = (searchParams.get("statuses") ?? "all").trim();
  let statuses: string[] | null = null;
  if (raw && raw !== "all") {
    statuses = raw.split(",").map((s) => s.trim()).filter((s) => ALLOWED_STATUSES.includes(s));
    if (statuses.length === 0) statuses = null;
  }

  // Build the IN list explicitly via sql.join — embedding a JS array directly in a drizzle sql
  // template renders a tuple, not a parameter list (feedback_drizzle_sql_template_arrays_enums).
  const where = statuses
    ? sql`where status in (${sql.join(statuses.map((s) => sql`${s}`), sql`, `)})`
    : sql``;

  const res = await db.execute(sql`
    select id, member_user_id, env, amount_tokens, amount_cents, status, rail,
           external_ref, note, requested_at, updated_at
      from withdrawals
      ${where}
     order by requested_at desc
     limit ${limit}
  `);

  return NextResponse.json({ count: res.rows.length, withdrawals: res.rows });
}
