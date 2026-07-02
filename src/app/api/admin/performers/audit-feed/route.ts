// GET /api/admin/performers/audit-feed?limit=N
//
// Activity Timeline for the PerformersControlModal. MERGES into the shared AuditLogTimeline contract
// ({ rows: TimelineRow[] }), newest-first:
//   1. Operator config changes — admin_audit_log, action `performers.*` (shared fetchAdminAuditRows).
//   2. Per-tenant performers activity — performers has no dedicated `performer_audit` table, so we
//      synthesize a real feed from the data: recent gigs (the booking row) + the append-only
//      `performer_earnings_ledger` (gig_gross / pool_share / split_adjust / payout / clawback). Both
//      schema-qualified + site_id-scoped, each in its own try/catch (missing table / GRANT skipped).
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { readPerformersConfig, isSafeSchema } from "@/lib/performers-config";
import { type TimelineRow, fetchAdminAuditRows } from "@/lib/suite-oversight";

export const runtime = "nodejs";

const ADMIN_ACTIONS = [
  "performers.killswitch_on",
  "performers.killswitch_off",
  "performers.tenant_enabled",
  "performers.tenant_disabled",
] as const;

const ADMIN_LABEL: Record<string, string> = {
  "performers.killswitch_on": "GLOBAL killswitch engaged",
  "performers.killswitch_off": "global killswitch released",
  "performers.tenant_enabled": "tenant enabled",
  "performers.tenant_disabled": "tenant disabled",
};
const ADMIN_OUTCOME: Record<string, string> = {
  "performers.killswitch_on": "warn",
  "performers.killswitch_off": "ok",
  "performers.tenant_enabled": "ok",
  "performers.tenant_disabled": "warn",
};

const WARN_GIG_STATUS = new Set(["cancelled", "declined", "expired"]);
const WARN_EARNING_REASON = new Set(["clawback"]);
const CENTS = (c: number) => `$${(c / 100).toFixed(2)}`;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "120")));
  const perSource = Math.min(120, limit);

  // 1) operator config changes (shared helper)
  const rows: TimelineRow[] = await fetchAdminAuditRows({
    actions: ADMIN_ACTIONS,
    labels: ADMIN_LABEL,
    outcomes: ADMIN_OUTCOME,
    prefix: "performers.",
    limit,
  });

  // 2) per-tenant synthesized activity (gigs + earnings ledger)
  const cfg = readPerformersConfig();
  await Promise.all(
    Object.entries(cfg.perTenant).map(async ([siteId, t]) => {
      if (!isSafeSchema(t.schema)) return;
      const sch = sql.raw(`"${t.schema}"`);
      const mid = sql`${siteId}::uuid`;
      const tenant = t.label ?? t.schema;

      // recent gigs
      try {
        const gigRows = (
          await db.execute(sql`
            select g.id::text as id, g.status::text as status, p.stage_name as performer,
                   g.buyer_member_id::text as buyer, g.created_at
              from ${sch}.performer_gigs g
              left join ${sch}.performer_profiles p on p.id = g.performer_id
             where g.site_id = ${mid}
             order by g.created_at desc
             limit ${perSource}
          `)
        ).rows as unknown as Array<{
          id: string;
          status: string;
          performer: string | null;
          buyer: string | null;
          created_at: string | Date;
        }>;
        for (const r of gigRows) {
          rows.push({
            id: `gig_${r.id}`,
            ts: new Date(r.created_at).toISOString(),
            kind: "performers.gig",
            label: `${tenant}: gig ${r.status.replaceAll("_", " ")}`,
            detail: r.performer ? `with ${r.performer}` : null,
            ip: null,
            by: r.buyer,
            outcome: WARN_GIG_STATUS.has(r.status) ? "warn" : "ok",
          });
        }
      } catch {
        // missing table / missing GRANT — skip this tenant's gigs, not fatal
      }

      // recent earnings ledger (the append-only money trail)
      try {
        const ledgerRows = (
          await db.execute(sql`
            select l.id::text as id, l.reason::text as reason, l.amount_cents::int as amount_cents,
                   p.stage_name as performer, l.actor_user_id::text as actor_user_id, l.created_at
              from ${sch}.performer_earnings_ledger l
              left join ${sch}.performer_profiles p on p.id = l.performer_id
             where l.site_id = ${mid}
             order by l.created_at desc
             limit ${perSource}
          `)
        ).rows as unknown as Array<{
          id: string;
          reason: string;
          amount_cents: number;
          performer: string | null;
          actor_user_id: string | null;
          created_at: string | Date;
        }>;
        for (const r of ledgerRows) {
          const sign = r.amount_cents >= 0 ? `+${CENTS(r.amount_cents)}` : `−${CENTS(-r.amount_cents)}`;
          rows.push({
            id: `earn_${r.id}`,
            ts: new Date(r.created_at).toISOString(),
            kind: "performers.earning",
            label: `${tenant}: ${r.reason.replaceAll("_", " ")}${r.performer ? ` — ${r.performer}` : ""}`,
            detail: sign,
            ip: null,
            by: r.actor_user_id,
            outcome: WARN_EARNING_REASON.has(r.reason) ? "warn" : "ok",
          });
        }
      } catch {
        // missing table / missing GRANT — skip this tenant's ledger, not fatal
      }
    }),
  );

  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return NextResponse.json({ rows: rows.slice(0, limit) });
}
