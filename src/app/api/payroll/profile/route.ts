// /api/payroll/profile — per-staffer payroll profile upsert (0096: hourly rate,
// worker classification, notes). Office-authed; updated_by attributed by members.id.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { resolveAdminMemberId } from "@/lib/support-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLASSIFICATIONS = new Set(["unclassified", "employee", "contractor"]);

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => ({}))) as {
    memberId?: unknown;
    hourlyRateCents?: unknown;
    classification?: unknown;
    notes?: unknown;
  };
  const memberId = typeof body.memberId === "string" ? body.memberId : "";
  if (!memberId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const rate =
    typeof body.hourlyRateCents === "number" && Number.isInteger(body.hourlyRateCents) && body.hourlyRateCents >= 0
      ? body.hourlyRateCents
      : null;
  const classification =
    typeof body.classification === "string" && CLASSIFICATIONS.has(body.classification)
      ? body.classification
      : null;
  const notes = typeof body.notes === "string" ? body.notes.slice(0, 4000) : null;
  if (rate === null && classification === null && notes === null) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const updatedBy = await resolveAdminMemberId(gate.username);
  try {
    await pgPool.query(
      `INSERT INTO payroll_profiles (member_id, hourly_rate_cents, classification, notes, updated_at, updated_by)
       VALUES ($1, COALESCE($2, 0), COALESCE($3, 'unclassified'), $4, now(), $5)
       ON CONFLICT (member_id) DO UPDATE SET
         hourly_rate_cents = COALESCE($2, payroll_profiles.hourly_rate_cents),
         classification    = COALESCE($3, payroll_profiles.classification),
         notes             = COALESCE($4, payroll_profiles.notes),
         updated_at        = now(),
         updated_by        = $5`,
      [memberId, rate, classification, notes, updatedBy],
    );
  } catch {
    // FK violation (unknown member) or bad uuid — clean 400 instead of a 500.
    return NextResponse.json({ error: "member_not_found" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
