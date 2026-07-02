// /api/admin/villagers/member-billing — operator sets a member's billing INTENT.
//
// PUT { memberId, planInterval?, chargeStartAt?, customAmountCents?,
//       waiverUntil?, notifyToPay? } → upsert member_billing; audited.
//
// This records the OPERATOR'S onboarding decisions only — it moves NO money and
// creates NO Stripe objects. The membership billing ENGINE (tgv.com / billing
// lane) owns subscriptions + charges and READS this table as the contract:
//   planInterval       'monthly' | 'yearly' (null = not chosen)
//   chargeStartAt      ISO date — begin charging on/after (null = not set)
//   customAmountCents  null = normal monthly rate; else operator override
//   waiverUntil        ISO date — comp through this date (waive N months/years)
//   notifyToPay        the "needs to be notified to pay by renewal" flag
//
// Raw SQL via db.execute(); audit via schema.adminAuditLog (memory
// feedback_drizzle_turbopack_select_fields).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type BillingSnapshot = {
  plan_interval: string | null;
  charge_start_at: string | Date | null;
  custom_amount_cents: number | null;
  waiver_until: string | Date | null;
  notify_to_pay: boolean;
};

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  let body: {
    memberId?: string;
    planInterval?: string | null;
    chargeStartAt?: string | null;
    customAmountCents?: number | null;
    waiverUntil?: string | null;
    notifyToPay?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const memberId = (body.memberId ?? "").trim();
  if (!UUID_RE.test(memberId)) {
    return NextResponse.json(
      { ok: false, error: "memberId must be a uuid" },
      { status: 400 },
    );
  }

  const planInterval =
    body.planInterval === "monthly" || body.planInterval === "yearly"
      ? body.planInterval
      : null;
  const chargeStartAt =
    typeof body.chargeStartAt === "string" && body.chargeStartAt.trim()
      ? body.chargeStartAt.trim()
      : null;
  const waiverUntil =
    typeof body.waiverUntil === "string" && body.waiverUntil.trim()
      ? body.waiverUntil.trim()
      : null;
  const customAmountCents =
    typeof body.customAmountCents === "number" &&
    Number.isFinite(body.customAmountCents) &&
    body.customAmountCents >= 0
      ? Math.floor(body.customAmountCents)
      : null;
  const notifyToPay = body.notifyToPay === true;

  for (const [k, v] of [
    ["chargeStartAt", chargeStartAt],
    ["waiverUntil", waiverUntil],
  ] as const) {
    if (v && Number.isNaN(Date.parse(v))) {
      return NextResponse.json(
        { ok: false, error: `${k} must be an ISO date` },
        { status: 400 },
      );
    }
  }

  const result = await db.transaction(async (tx) => {
    const prevRes = await tx.execute(sql`
      SELECT plan_interval, charge_start_at, custom_amount_cents,
             waiver_until, notify_to_pay
      FROM public.member_billing WHERE member_id = ${memberId}
    `);
    const before =
      ((prevRes as unknown as { rows?: BillingSnapshot[] }).rows ?? [])[0] ?? null;

    await tx.execute(sql`
      INSERT INTO public.member_billing
        (member_id, plan_interval, charge_start_at, custom_amount_cents,
         waiver_until, notify_to_pay, updated_by, updated_at)
      VALUES
        (${memberId}, ${planInterval}, ${chargeStartAt}::timestamptz,
         ${customAmountCents}::integer, ${waiverUntil}::timestamptz,
         ${notifyToPay}, ${gate.username}, now())
      ON CONFLICT (member_id) DO UPDATE SET
        plan_interval       = EXCLUDED.plan_interval,
        charge_start_at     = EXCLUDED.charge_start_at,
        custom_amount_cents = EXCLUDED.custom_amount_cents,
        waiver_until        = EXCLUDED.waiver_until,
        notify_to_pay       = EXCLUDED.notify_to_pay,
        updated_by          = EXCLUDED.updated_by,
        updated_at          = now()
    `);

    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "member.billing_intent_set",
      targetType: "member_user",
      targetId: memberId,
      before: before ?? {},
      after: {
        planInterval,
        chargeStartAt,
        customAmountCents,
        waiverUntil,
        notifyToPay,
      },
      note: `Member billing intent set by Office admin ${gate.username}`,
    });

    return { ok: true as const };
  });

  return NextResponse.json(result);
}
