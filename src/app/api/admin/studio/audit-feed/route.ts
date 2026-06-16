// GET /api/admin/studio/audit-feed?limit=N
//
// Activity Timeline for the StudioControlModal. MERGES into the shared AuditLogTimeline contract
// ({ rows: TimelineRow[] }), newest-first:
//   1. Operator config changes — admin_audit_log, action `studio.*` (typed select; public schema).
//   2. Per-tenant studio activity — studio has no dedicated `studio_audit` table, so we synthesize
//      a real feed from the data: recent bookings (the roster row) + the append-only
//      `studio_entitlement_ledger` (grant/consume/refund/expire/adjust). Both schema-qualified +
//      member_id-scoped, each in its own try/catch (missing table / missing GRANT is skipped).
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { sql, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { readStudioConfig, isSafeSchema } from "@/lib/studio-config";

export const runtime = "nodejs";

type TimelineRow = {
  id: string;
  ts: string;
  kind: string;
  label: string;
  detail: string | null;
  ip: string | null;
  by: string | null;
  outcome: string;
};

// Operator config actions (admin_audit_log).
const ADMIN_ACTIONS = [
  "studio.killswitch_on",
  "studio.killswitch_off",
  "studio.tenant_enabled",
  "studio.tenant_disabled",
] as const;

const ADMIN_LABEL: Record<string, string> = {
  "studio.killswitch_on": "GLOBAL killswitch engaged",
  "studio.killswitch_off": "global killswitch released",
  "studio.tenant_enabled": "tenant enabled",
  "studio.tenant_disabled": "tenant disabled",
};
const ADMIN_OUTCOME: Record<string, string> = {
  "studio.killswitch_on": "warn",
  "studio.killswitch_off": "ok",
  "studio.tenant_enabled": "ok",
  "studio.tenant_disabled": "warn",
};

const WARN_BOOKING_STATUS = new Set(["no_show", "cancelled", "late_cancelled"]);

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "120")));
  const perSource = Math.min(120, limit);

  // 1) operator config changes
  const adminRows = await db
    .select({
      id: schema.adminAuditLog.id,
      createdAt: schema.adminAuditLog.createdAt,
      action: schema.adminAuditLog.action,
      note: schema.adminAuditLog.note,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(inArray(schema.adminAuditLog.action, ADMIN_ACTIONS as unknown as string[]))
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(limit);

  const rows: TimelineRow[] = adminRows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.action,
    label: ADMIN_LABEL[r.action] ?? r.action.replace("studio.", "").replaceAll("_", " "),
    detail: r.note ?? null,
    ip: null,
    by: r.actorUserId,
    outcome: ADMIN_OUTCOME[r.action] ?? "ok",
  }));

  // 2) per-tenant synthesized activity (bookings + entitlement ledger)
  const cfg = readStudioConfig();
  await Promise.all(
    Object.entries(cfg.perTenant).map(async ([memberId, t]) => {
      if (!isSafeSchema(t.schema)) return;
      const sch = sql.raw(`"${t.schema}"`);
      const mid = sql`${memberId}::uuid`;
      const tenant = t.label ?? t.schema;

      // recent bookings
      try {
        const bookingRows = (
          await db.execute(sql`
            select id::text as id, status::text as status, booked_online,
                   member_user_id::text as member_user_id, created_at
              from ${sch}.studio_bookings
             where member_id = ${mid}
             order by created_at desc
             limit ${perSource}
          `)
        ).rows as unknown as Array<{
          id: string;
          status: string;
          booked_online: boolean;
          member_user_id: string | null;
          created_at: string | Date;
        }>;
        for (const r of bookingRows) {
          rows.push({
            id: `bk_${r.id}`,
            ts: new Date(r.created_at).toISOString(),
            kind: "studio.booking",
            label: `${tenant}: booking ${r.status.replaceAll("_", " ")}`,
            detail: r.booked_online ? "online self-service" : "operator / walk-in",
            ip: null,
            by: r.member_user_id,
            outcome: WARN_BOOKING_STATUS.has(r.status) ? "warn" : "ok",
          });
        }
      } catch {
        // missing table / missing GRANT — skip this tenant's bookings, not fatal
      }

      // recent entitlement ledger (the append-only audit trail)
      try {
        const ledgerRows = (
          await db.execute(sql`
            select id::text as id, reason::text as reason, delta::int as delta,
                   balance_after, actor_user_id::text as actor_user_id, created_at
              from ${sch}.studio_entitlement_ledger
             where member_id = ${mid}
             order by created_at desc
             limit ${perSource}
          `)
        ).rows as unknown as Array<{
          id: string;
          reason: string;
          delta: number;
          balance_after: number | null;
          actor_user_id: string | null;
          created_at: string | Date;
        }>;
        for (const r of ledgerRows) {
          const sign = r.delta > 0 ? `+${r.delta}` : String(r.delta);
          const bal = r.balance_after == null ? "" : ` → ${r.balance_after} left`;
          rows.push({
            id: `led_${r.id}`,
            ts: new Date(r.created_at).toISOString(),
            kind: "studio.entitlement",
            label: `${tenant}: pass ${r.reason}`,
            detail: `${sign} sessions${bal}`,
            ip: null,
            by: r.actor_user_id,
            outcome: r.reason === "refund" || r.reason === "expire" ? "warn" : "ok",
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
