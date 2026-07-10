// /api/payroll/overview — the Payroll desk's all-staff read (HANDOFF-office-payroll.md §2.2).
// GET ?days=N (1..92, default 30) → PayrollOverview: every staffer with time entries in the
// window (entries + breaks + workedMs per the shared contract), open revision requests, recent
// adjustments, and payroll profiles (0096). Office-authed (requireAdmin — the role gate; the two
// TGV superadmins are the operators, never hardcoded). Reads tgv_db directly via pgPool — the
// central tgv.com rail is deliberately staffer-scoped, so the admin read lives here.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import type {
  PayrollOverview,
  PayrollStaffer,
  PayrollEntry,
} from "@tgv/module-payroll/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const raw = Number(req.nextUrl.searchParams.get("days") ?? 30);
  const days = Math.min(92, Math.max(1, Number.isFinite(raw) ? Math.floor(raw) : 30));

  const [entries, breaks, revisions, adjustments, profiles] = await Promise.all([
    pgPool.query(
      `SELECT e.id, e.member_id, e.clock_in_at, e.clock_out_at,
              m.name, m.username, m.email
         FROM staff_time_entries e
         JOIN members m ON m.id = e.member_id
        WHERE e.clock_in_at >= now() - make_interval(days => $1)
        ORDER BY e.clock_in_at DESC`,
      [days],
    ),
    pgPool.query(
      `SELECT b.id, b.entry_id, b.break_start, b.break_end
         FROM staff_time_breaks b
         JOIN staff_time_entries e ON e.id = b.entry_id
        WHERE e.clock_in_at >= now() - make_interval(days => $1)
        ORDER BY b.break_start`,
      [days],
    ),
    pgPool.query(
      `SELECT r.id, r.entry_id, r.member_id, r.note, r.status, r.created_at,
              m.name AS staffer_name, m.username AS staffer_username,
              e.clock_in_at AS entry_clock_in_at
         FROM staff_time_revision_requests r
         JOIN members m ON m.id = r.member_id
         LEFT JOIN staff_time_entries e ON e.id = r.entry_id
        WHERE r.status = 'open' OR r.created_at >= now() - make_interval(days => $1)
        ORDER BY r.created_at DESC`,
      [days],
    ),
    pgPool.query(
      `SELECT a.id, a.entry_id, a.break_id, a.field, a.before_value, a.after_value,
              a.reason, a.adjusted_by, a.created_at, m.name AS adjusted_by_name
         FROM staff_time_adjustments a
         LEFT JOIN members m ON m.id = a.adjusted_by
        WHERE a.created_at >= now() - make_interval(days => $1)
        ORDER BY a.created_at DESC
        LIMIT 500`,
      [days],
    ),
    pgPool.query(`SELECT member_id, hourly_rate_cents, classification FROM payroll_profiles`),
  ]);

  const breaksByEntry = new Map<string, Array<{ id: string; breakStart: string; breakEnd: string | null }>>();
  for (const b of breaks.rows) {
    const list = breaksByEntry.get(b.entry_id) ?? [];
    list.push({ id: b.id, breakStart: b.break_start.toISOString(), breakEnd: b.break_end?.toISOString() ?? null });
    breaksByEntry.set(b.entry_id, list);
  }

  const openRevByEntry = new Set(revisions.rows.filter((r) => r.status === "open").map((r) => r.entry_id));
  const profileByMember = new Map(profiles.rows.map((p) => [p.member_id, p]));

  const staffMap = new Map<string, PayrollStaffer>();
  for (const e of entries.rows) {
    let s = staffMap.get(e.member_id);
    if (!s) {
      const prof = profileByMember.get(e.member_id);
      s = {
        memberId: e.member_id,
        name: e.name ?? null,
        username: e.username ?? null,
        email: e.email,
        hourlyRateCents: prof?.hourly_rate_cents ?? 0,
        classification: prof?.classification ?? "unclassified",
        entries: [],
        workedMsTotal: 0,
        openRevisions: 0,
      };
      staffMap.set(e.member_id, s);
    }
    const entryBreaks = breaksByEntry.get(e.id) ?? [];
    // workedMs = clock_out (or now) − clock_in − Σ breaks (shared contract §3)
    const end = e.clock_out_at ? e.clock_out_at.getTime() : Date.now();
    const breakMs = entryBreaks.reduce(
      (a, b) => a + ((b.breakEnd ? new Date(b.breakEnd).getTime() : Date.now()) - new Date(b.breakStart).getTime()),
      0,
    );
    const workedMs = Math.max(0, end - e.clock_in_at.getTime() - breakMs);
    const entry: PayrollEntry = {
      id: e.id,
      clockInAt: e.clock_in_at.toISOString(),
      clockOutAt: e.clock_out_at?.toISOString() ?? null,
      breaks: entryBreaks,
      workedMs,
      openRevision: openRevByEntry.has(e.id),
    };
    s.entries.push(entry);
    s.workedMsTotal += workedMs;
    if (entry.openRevision) s.openRevisions += 1;
  }

  const overview: PayrollOverview = {
    days,
    staff: [...staffMap.values()].sort((a, b) => b.workedMsTotal - a.workedMsTotal),
    revisions: revisions.rows.map((r) => ({
      id: r.id,
      entryId: r.entry_id,
      memberId: r.member_id,
      stafferName: r.staffer_name ?? null,
      stafferUsername: r.staffer_username ?? null,
      note: r.note,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      entryClockInAt: r.entry_clock_in_at?.toISOString() ?? null,
    })),
    adjustments: adjustments.rows.map((a) => ({
      id: a.id,
      entryId: a.entry_id,
      breakId: a.break_id ?? null,
      field: a.field,
      beforeValue: a.before_value?.toISOString() ?? null,
      afterValue: a.after_value?.toISOString() ?? null,
      reason: a.reason,
      adjustedBy: a.adjusted_by ?? null,
      adjustedByName: a.adjusted_by_name ?? null,
      createdAt: a.created_at.toISOString(),
    })),
  };

  return NextResponse.json(overview);
}
