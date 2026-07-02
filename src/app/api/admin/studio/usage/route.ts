// GET /api/admin/studio/usage
//
// Cross-tenant studio analytics for the StudioControlModal (Villagers → Studio Suite). Reads each
// tenant's `studio_*` tables in tgv_db DIRECTLY via raw db.execute(sql) — Office's pool has NO
// search_path, so every table is SCHEMA-QUALIFIED (`refusionist.studio_*` / `public.studio_*`) and
// we loop the per-tenant registry from the shared config. Each row is additionally scoped
// `site_id = <tenant venue>` because the `public` schema is shared platform space (one schema can
// hold more than one Site). Raw SQL also dodges the Turbopack is(Column) crash.
//
// Studio has no operator-"preview" flag (unlike course's source='member'), so no exclusion filter is
// needed; `booked_online` instead splits online self-service from operator/walk-in bookings (shown,
// not filtered).
//
// Read-only. Gated by requireAdmin. Each tenant is in its own try/catch so a missing table or a
// missing GRANT surfaces as that tenant's `error` without breaking the others.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { readStudioConfig, isSafeSchema } from "@/lib/studio-config";

export const runtime = "nodejs";

type UpcomingClass = {
  id: string;
  startAt: string;
  booked: number;
  capacity: number;
  name: string | null;
};

function n(v: unknown): number {
  return Number(v ?? 0) || 0;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const cfg = readStudioConfig();
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
        // 1) Catalog counts
        const catalog = (
          await db.execute(sql`
            select
              (select count(*) from ${sch}.studio_service_categories where site_id = ${mid})::int as service_categories,
              (select count(*) from ${sch}.studio_session_types     where site_id = ${mid})::int as session_types,
              (select count(*) from ${sch}.studio_appointment_types  where site_id = ${mid})::int as appointment_types,
              (select count(*) from ${sch}.studio_pricing_options    where site_id = ${mid})::int as pricing_total,
              (select count(*) from ${sch}.studio_pricing_options    where site_id = ${mid} and active)::int as pricing_active
          `)
        ).rows[0] as Record<string, unknown>;

        // 2) Classes rollup
        const classes = (
          await db.execute(sql`
            select
              count(*)::int                                                                    as total,
              count(*) filter (where is_canceled = false and start_at >  now())::int           as upcoming,
              count(*) filter (where is_canceled = false and start_at <= now())::int           as past,
              count(*) filter (where is_canceled)::int                                         as canceled,
              coalesce(sum(booked_count) filter (where is_canceled = false), 0)::int           as seats_booked
            from ${sch}.studio_classes
            where site_id = ${mid}
          `)
        ).rows[0] as Record<string, unknown>;

        // 3) Bookings rollup (+ distinct clients)
        const bookings = (
          await db.execute(sql`
            select
              count(*)::int                                           as total,
              count(*) filter (where booked_online)::int              as online,
              count(*) filter (where status = 'booked')::int          as booked,
              count(*) filter (where status = 'waitlisted')::int      as waitlisted,
              count(*) filter (where status = 'checked_in')::int      as checked_in,
              count(*) filter (where status = 'completed')::int       as completed,
              count(*) filter (where status = 'no_show')::int         as no_show,
              count(*) filter (where status = 'late_cancelled')::int  as late_cancelled,
              count(*) filter (where status = 'cancelled')::int       as cancelled,
              count(distinct member_user_id)::int                     as clients
            from ${sch}.studio_bookings
            where site_id = ${mid}
          `)
        ).rows[0] as Record<string, unknown>;

        // 4) Appointments + entitlements (both small)
        const apptEnt = (
          await db.execute(sql`
            select
              (select count(*) from ${sch}.studio_appointments
                 where site_id = ${mid})::int as appts_total,
              (select count(*) from ${sch}.studio_appointments
                 where site_id = ${mid} and start_at > now()
                   and status not in ('cancelled','no_show','late_cancelled'))::int as appts_upcoming,
              (select count(*) from ${sch}.studio_entitlements
                 where site_id = ${mid} and status = 'active')::int as ent_active,
              (select count(*) from ${sch}.studio_entitlements
                 where site_id = ${mid})::int as ent_total,
              (select coalesce(sum(remaining_sessions), 0) from ${sch}.studio_entitlements
                 where site_id = ${mid} and status = 'active' and remaining_sessions is not null)::int as ent_outstanding
          `)
        ).rows[0] as Record<string, unknown>;

        // 5) Next upcoming class instances (oversight mini-table)
        const upcomingClasses = (
          await db.execute(sql`
            select
              c.id::text                          as id,
              c.start_at                          as start_at,
              c.booked_count::int                 as booked,
              c.max_capacity::int                 as capacity,
              cd.name                             as name
            from ${sch}.studio_classes c
            left join ${sch}.studio_class_descriptions cd on cd.id = c.class_description_id
            where c.site_id = ${mid} and c.is_canceled = false and c.start_at > now()
            order by c.start_at asc
            limit 8
          `)
        ).rows.map((r) => {
          const row = r as Record<string, unknown>;
          return {
            id: String(row.id),
            startAt: new Date(row.start_at as string | Date).toISOString(),
            booked: n(row.booked),
            capacity: n(row.capacity),
            name: row.name == null ? null : String(row.name),
          } as UpcomingClass;
        });

        const noShowDenom = n(bookings.completed) + n(bookings.no_show);
        const emptyUpcoming = upcomingClasses.filter((c) => c.booked === 0).length;

        return {
          ...base,
          error: null,
          catalog: {
            serviceCategories: n(catalog.service_categories),
            sessionTypes: n(catalog.session_types),
            appointmentTypes: n(catalog.appointment_types),
            pricingOptions: n(catalog.pricing_total),
            pricingActive: n(catalog.pricing_active),
          },
          classes: {
            total: n(classes.total),
            upcoming: n(classes.upcoming),
            past: n(classes.past),
            canceled: n(classes.canceled),
            seatsBooked: n(classes.seats_booked),
          },
          bookings: {
            total: n(bookings.total),
            online: n(bookings.online),
            inHouse: n(bookings.total) - n(bookings.online),
            clients: n(bookings.clients),
            byStatus: {
              booked: n(bookings.booked),
              waitlisted: n(bookings.waitlisted),
              checkedIn: n(bookings.checked_in),
              completed: n(bookings.completed),
              noShow: n(bookings.no_show),
              lateCancelled: n(bookings.late_cancelled),
              cancelled: n(bookings.cancelled),
            },
          },
          appointments: {
            total: n(apptEnt.appts_total),
            upcoming: n(apptEnt.appts_upcoming),
          },
          entitlements: {
            active: n(apptEnt.ent_active),
            total: n(apptEnt.ent_total),
            outstandingSessions: n(apptEnt.ent_outstanding),
          },
          upcomingClasses,
          health: {
            emptyUpcomingClasses: emptyUpcoming,
            noShowRate: noShowDenom > 0 ? Math.round((n(bookings.no_show) / noShowDenom) * 100) : null,
          },
        };
      } catch (e: unknown) {
        return { ...base, error: String((e as Error)?.message ?? e) };
      }
    }),
  );

  return NextResponse.json({ tenants: out });
}
