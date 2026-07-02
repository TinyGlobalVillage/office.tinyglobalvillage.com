// GET /api/admin/performers/usage
//
// Cross-tenant performers analytics for the PerformersControlModal (Villagers → Performers). Reads
// each tenant's `performer_*` tables in tgv_db DIRECTLY via raw db.execute(sql) — Office's pool has
// NO search_path, so every table is SCHEMA-QUALIFIED (`refusionist.performer_*`) and we loop the
// per-tenant registry from the shared config. Raw SQL also dodges the Turbopack is(Column) crash.
//
// ⚠ Cross-schema GRANT wall — Office connects as `tgv_app`; the tenant's performer tables are owned
// by `<tenant>_app`, so a `GRANT SELECT` (run as the owner) is required first or every query 500s
// with "permission denied for table". See rcs-stack/postgres.md §"Cross-schema operator read grants".
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { readPerformersConfig, isSafeSchema } from "@/lib/performers-config";

export const runtime = "nodejs";

type UpcomingGig = { id: string; performer: string | null; eventAt: string | null; status: string };

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const cfg = readPerformersConfig();
  const tenants = Object.entries(cfg.perTenant);

  const out = await Promise.all(
    tenants.map(async ([siteId, t]) => {
      const base = { siteId, label: t.label ?? siteId, schema: t.schema, enabled: t.enabled };
      if (!isSafeSchema(t.schema)) {
        return { ...base, error: "bad_schema" as const };
      }
      const sch = sql.raw(`"${t.schema}"`);
      const mid = sql`${siteId}::uuid`;
      try {
        // Roster + catalog
        const profiles = (
          await db.execute(sql`
            select
              count(*)::int                                  as total,
              count(*) filter (where active)::int            as active,
              count(*) filter (where featured and active)::int as featured
            from ${sch}.performer_profiles
           where site_id = ${mid}
          `)
        ).rows[0] as { total: number; active: number; featured: number };

        const offerings = (
          await db.execute(sql`
            select count(*)::int as total, count(*) filter (where active)::int as active
              from ${sch}.performer_offerings
             where site_id = ${mid}
          `)
        ).rows[0] as { total: number; active: number };

        // Gigs by lifecycle
        const gigs = (
          await db.execute(sql`
            select
              count(*)::int                                                              as total,
              count(*) filter (where status not in ('completed','cancelled','declined','expired'))::int as upcoming,
              count(*) filter (where status = 'completed')::int                          as completed,
              count(*) filter (where status = 'requested')::int                          as requested,
              count(*) filter (where status in ('cancelled','declined','expired'))::int  as dropped
            from ${sch}.performer_gigs
           where site_id = ${mid}
          `)
        ).rows[0] as { total: number; upcoming: number; completed: number; requested: number; dropped: number };

        // Revenue (paid purchases) + earnings ledger (gross vs payouts)
        const revenue = (
          await db.execute(sql`
            select
              coalesce(sum(amount_cents) filter (where status = 'paid'), 0)::bigint as paid_cents,
              count(*) filter (where status = 'paid')::int                         as paid_count,
              count(*) filter (where status = 'pending')::int                      as pending_count
            from ${sch}.performer_purchases
           where site_id = ${mid}
          `)
        ).rows[0] as { paid_cents: string | number; paid_count: number; pending_count: number };

        const earnings = (
          await db.execute(sql`
            select
              coalesce(sum(amount_cents) filter (where amount_cents > 0), 0)::bigint     as gross_cents,
              coalesce(-sum(amount_cents) filter (where amount_cents < 0), 0)::bigint    as payout_cents
            from ${sch}.performer_earnings_ledger
           where site_id = ${mid}
          `)
        ).rows[0] as { gross_cents: string | number; payout_cents: string | number };

        // Pools (abundance) + payout rows
        const pools = (
          await db.execute(sql`
            select count(*)::int as total, count(*) filter (where status = 'open')::int as open
              from ${sch}.performer_pools
             where site_id = ${mid}
          `)
        ).rows[0] as { total: number; open: number };

        const payouts = (
          await db.execute(sql`
            select
              count(*) filter (where payout_status = 'unpaid')::int as unpaid,
              count(*) filter (where payout_status = 'paid')::int   as paid
            from ${sch}.performer_split_lines
           where site_id = ${mid}
          `)
        ).rows[0] as { unpaid: number; paid: number };

        const upcomingGigs = (
          await db.execute(sql`
            select g.id::text as id, p.stage_name as performer, g.event_at as event_at, g.status::text as status
              from ${sch}.performer_gigs g
              left join ${sch}.performer_profiles p on p.id = g.performer_id
             where g.site_id = ${mid}
               and g.status not in ('completed','cancelled','declined','expired')
             order by g.event_at asc nulls last, g.created_at desc
             limit 8
          `)
        ).rows as unknown as Array<{ id: string; performer: string | null; event_at: string | null; status: string }>;

        return {
          ...base,
          error: null,
          profiles,
          offerings,
          gigs,
          revenue: {
            paidCents: Number(revenue.paid_cents),
            paidCount: revenue.paid_count,
            pendingCount: revenue.pending_count,
          },
          earnings: {
            grossCents: Number(earnings.gross_cents),
            payoutCents: Number(earnings.payout_cents),
          },
          pools,
          payouts,
          upcomingGigs: upcomingGigs.map(
            (g): UpcomingGig => ({ id: g.id, performer: g.performer, eventAt: g.event_at, status: g.status }),
          ),
        };
      } catch (e: unknown) {
        return { ...base, error: String((e as Error)?.message ?? e) };
      }
    }),
  );

  return NextResponse.json({ tenants: out });
}
