// /api/admin/fundraiser — the staff view of every fundraiser on tgv.com (Fundraiser tile).
//
//   GET   the beta switch's state, totals, and one row per fundraiser.
//   POST  { id, close: true }   staff-close a fundraiser (it stops taking gifts; its coordinator
//                               cannot reopen it), or { id, close: false } to lift that hold.
//
// Reads tgv_db DIRECTLY (Office and tgv.com share it; the fundraiser_* tables live in public and are
// granted to tgv_app — tgv.com's manual/0264_fundraiser_grants.sql). Raw db.execute(sql).
// STAFF ONLY: requireStaff (roster admin or employee). Send-to addresses are sealed with a key only
// tgv.com holds and are never read here. Every close / lift writes an admin_audit_log row.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireStaff } from "@/lib/api-staff";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tgvBase = () => (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const flag = (await db.execute(sql`select state from public.platform_feature_flags where feature_key = 'fundraiser'`)).rows[0] as { state?: string } | undefined;
    // What a received item counts for is the coordinator's value: cost new + tax, plus shipping when
    // the donor covered it — once per item, the same rule as the meter in @tgv/module-fundraiser/core.
    const rows = (
      await db.execute(sql`
        select f.id, f.slug, f.title, f.status, f.currency, f.ends_at, f.created_at, f.closed_by_staff,
               m.name as coordinator_name, m.email as coordinator_email,
               f.cash_goal_cents + coalesce(i.need_cents, 0) as goal_cents,
               coalesce(i.items, 0) as items,
               coalesce(g.cash_cents, 0) as cash_cents,
               coalesce(g.fee_cents, 0) as fee_cents,
               coalesce(k.in_kind_cents, 0) as in_kind_cents,
               coalesce(k.received, 0) as received,
               coalesce(g.waiting, 0) as waiting,
               coalesce(g.on_the_way, 0) as on_the_way
          from public.fundraisers f
          join public.members m on m.id = f.member_id
          left join lateral (
            select count(*)::int as items,
                   sum(cost_new_cents + coalesce(shipping_cents, 0) + tax_cents)::bigint as need_cents
              from public.fundraiser_items where fundraiser_id = f.id
          ) i on true
          left join lateral (
            select sum(amount_cents) filter (where status = 'paid' and kind in ('cash', 'shipping'))::bigint as cash_cents,
                   sum(fee_cents) filter (where status = 'paid' and kind in ('cash', 'shipping'))::bigint as fee_cents,
                   count(*) filter (where status = 'offered')::int as waiting,
                   count(*) filter (where status in ('accepted', 'accepted_end', 'shipped'))::int as on_the_way
              from public.fundraiser_gifts where fundraiser_id = f.id
          ) g on true
          left join lateral (
            select count(*)::int as received,
                   sum(x.cost_new_cents + x.tax_cents + case when x.pays_shipping then coalesce(x.shipping_cents, 0) else 0 end)::bigint as in_kind_cents
              from (
                select distinct on (it.id) it.cost_new_cents, it.tax_cents, it.shipping_cents, gf.pays_shipping
                  from public.fundraiser_gifts gf
                  join public.fundraiser_items it on it.id = gf.item_id
                 where gf.fundraiser_id = f.id and gf.kind in ('item', 'lend') and gf.status = 'received'
                 order by it.id, gf.received_at
              ) x
          ) k on true
         order by (f.status = 'live') desc, f.updated_at desc
         limit 500
      `)
    ).rows as Record<string, unknown>[];

    const n = (v: unknown) => Number(v ?? 0);
    const fundraisers = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      status: String(r.status),
      currency: String(r.currency),
      endsAt: r.ends_at ? new Date(r.ends_at as string).toISOString() : null,
      createdAt: new Date(r.created_at as string).toISOString(),
      closedByStaff: (r.closed_by_staff as string | null) ?? null,
      coordinator: { name: String(r.coordinator_name ?? ""), email: String(r.coordinator_email ?? "") },
      goalCents: n(r.goal_cents),
      cashCents: n(r.cash_cents),
      feeCents: n(r.fee_cents),
      inKindCents: n(r.in_kind_cents),
      items: n(r.items),
      received: n(r.received),
      waiting: n(r.waiting),
      onTheWay: n(r.on_the_way),
      url: `${tgvBase()}/en/fundraiser/${String(r.slug)}`,
    }));
    const totals = {
      fundraisers: fundraisers.length,
      live: fundraisers.filter((f) => f.status === "live").length,
      cashCents: fundraisers.reduce((s, f) => s + f.cashCents, 0),
      feeCents: fundraisers.reduce((s, f) => s + f.feeCents, 0),
      inKindCents: fundraisers.reduce((s, f) => s + f.inKindCents, 0),
      received: fundraisers.reduce((s, f) => s + f.received, 0),
      waiting: fundraisers.reduce((s, f) => s + f.waiting, 0),
    };
    return NextResponse.json({ flag: flag?.state ?? "on", totals, fundraisers, viewerRole: gate.role });
  } catch (e) {
    return NextResponse.json({ error: "read_failed", detail: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req);
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { id?: unknown; close?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ? body.id : null;
  if (!id || typeof body?.close !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });

  const before = (await db.execute(sql`select status, closed_by_staff from public.fundraisers where id = ${id}::uuid`)).rows[0] as
    | { status: string; closed_by_staff: string | null }
    | undefined;
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Closing holds it closed; lifting only removes the hold — the coordinator decides when to reopen.
  const after = (
    body.close
      ? await db.execute(sql`update public.fundraisers set status = 'closed', closed_by_staff = ${gate.username}, updated_at = now() where id = ${id}::uuid returning status, closed_by_staff`)
      : await db.execute(sql`update public.fundraisers set closed_by_staff = null, updated_at = now() where id = ${id}::uuid returning status, closed_by_staff`)
  ).rows[0] as { status: string; closed_by_staff: string | null };

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: body.close ? "fundraiser.staff_close" : "fundraiser.staff_close_lifted",
    targetType: "fundraiser",
    targetId: id,
    before: before as unknown as Record<string, unknown>,
    after: after as unknown as Record<string, unknown>,
    note: `${body.close ? "Staff-closed" : "Staff close lifted on"} fundraiser — by ${gate.username}`,
  });
  return NextResponse.json({ ok: true, status: after.status, closedByStaff: after.closed_by_staff });
}
