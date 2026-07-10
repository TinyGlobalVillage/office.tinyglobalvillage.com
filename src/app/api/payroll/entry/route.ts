// /api/payroll/entry — audited clock adjustments (HANDOFF-office-payroll.md §2.2).
// PATCH {entryId, reason, clockInAt?, clockOutAt?, breaks?: [{id, breakStart?, breakEnd?}]}.
// Transactional: reads before-values, applies the edits, and writes ONE
// staff_time_adjustments row (0095) per changed field — never a silent edit.
// The adjuster is attributed by members.id (office username → roster email → member).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { resolveAdminMemberId } from "@/lib/support-proxy";
import type { PayrollEntryPatch } from "@tgv/module-payroll/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as PayrollEntryPatch | null;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
  if (!body?.entryId || reason.length < 3) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const adjustedBy = await resolveAdminMemberId(gate.username);

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    const { rows: entryRows } = await client.query(
      `SELECT id, clock_in_at, clock_out_at FROM staff_time_entries WHERE id = $1 FOR UPDATE`,
      [body.entryId],
    );
    const entry = entryRows[0];
    if (!entry) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "entry_not_found" }, { status: 404 });
    }

    const audit: Array<{ breakId: string | null; field: string; before: Date | null; after: Date | null }> = [];

    const nextIn = body.clockInAt !== undefined ? new Date(body.clockInAt) : undefined;
    const nextOut = body.clockOutAt !== undefined ? (body.clockOutAt ? new Date(body.clockOutAt) : null) : undefined;
    if (nextIn !== undefined && Number.isNaN(nextIn.getTime())) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "bad_timestamp" }, { status: 400 });
    }
    if (nextOut !== undefined && nextOut !== null && Number.isNaN(nextOut.getTime())) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "bad_timestamp" }, { status: 400 });
    }
    // Ordering sanity: out (when set) must follow in.
    const effIn = nextIn ?? entry.clock_in_at;
    const effOut = nextOut !== undefined ? nextOut : entry.clock_out_at;
    if (effOut && effOut.getTime() <= effIn.getTime()) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "out_before_in" }, { status: 400 });
    }

    if (nextIn !== undefined && nextIn.getTime() !== entry.clock_in_at.getTime()) {
      await client.query(`UPDATE staff_time_entries SET clock_in_at = $1 WHERE id = $2`, [nextIn, entry.id]);
      audit.push({ breakId: null, field: "clock_in_at", before: entry.clock_in_at, after: nextIn });
    }
    if (nextOut !== undefined && (nextOut?.getTime() ?? null) !== (entry.clock_out_at?.getTime() ?? null)) {
      await client.query(`UPDATE staff_time_entries SET clock_out_at = $1 WHERE id = $2`, [nextOut, entry.id]);
      audit.push({ breakId: null, field: "clock_out_at", before: entry.clock_out_at, after: nextOut });
    }

    for (const b of body.breaks ?? []) {
      const { rows: brRows } = await client.query(
        `SELECT id, break_start, break_end FROM staff_time_breaks WHERE id = $1 AND entry_id = $2 FOR UPDATE`,
        [b.id, entry.id],
      );
      const br = brRows[0];
      if (!br) continue;
      const nextStart = b.breakStart !== undefined ? new Date(b.breakStart) : undefined;
      const nextEnd = b.breakEnd !== undefined ? (b.breakEnd ? new Date(b.breakEnd) : null) : undefined;
      if (nextStart !== undefined && nextStart.getTime() !== br.break_start.getTime()) {
        await client.query(`UPDATE staff_time_breaks SET break_start = $1 WHERE id = $2`, [nextStart, br.id]);
        audit.push({ breakId: br.id, field: "break_start", before: br.break_start, after: nextStart });
      }
      if (nextEnd !== undefined && (nextEnd?.getTime() ?? null) !== (br.break_end?.getTime() ?? null)) {
        await client.query(`UPDATE staff_time_breaks SET break_end = $1 WHERE id = $2`, [nextEnd, br.id]);
        audit.push({ breakId: br.id, field: "break_end", before: br.break_end, after: nextEnd });
      }
    }

    if (audit.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "no_changes" }, { status: 400 });
    }

    for (const a of audit) {
      await client.query(
        `INSERT INTO staff_time_adjustments (entry_id, break_id, field, before_value, after_value, reason, adjusted_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [entry.id, a.breakId, a.field, a.before, a.after, reason, adjustedBy],
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, adjusted: audit.length });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("[payroll/entry]", err);
    return NextResponse.json({ error: "adjustment_failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
