// src/lib/suite-oversight.ts
//
// Server-side shared helpers for the Villagers "feature suite" master-modal tiles (Course, Studio,
// Performers, …) — the server counterpart to app/components/villagers/_suite/SuiteControlKit.tsx.
// Per checklist `feature-suite-villagers-tiles`, every suite tile reads cross-tenant usage + a merged
// Activity Timeline from tgv_db and writes an enablement killswitch. These helpers factor out the
// bits that were identical across each suite's usage/audit-feed routes.
//
// Read-only DB helpers; every consuming route still gates with requireAdmin.
import "server-only";
import { desc, inArray } from "drizzle-orm";
import { db, schema } from "./db-drizzle";

/** The contract AuditLogTimeline (the shared HCM timeline component) consumes: `{ rows: TimelineRow[] }`. */
export type TimelineRow = {
  id: string;
  ts: string;
  kind: string;
  label: string;
  detail: string | null;
  ip: string | null;
  by: string | null;
  outcome: string;
};

/**
 * Strict Postgres identifier guard. Suite config carries each tenant's schema name, which the
 * cross-tenant analytics routes interpolate RAW into SQL (Drizzle sql`` cannot parameterise an
 * identifier), so reject anything that isn't a plain lower-snake ident before it touches a query.
 * Canonical home — course-config.ts / studio-config.ts re-export this.
 */
export function isSafeSchema(s: string): boolean {
  return typeof s === "string" && /^[a-z_][a-z0-9_]*$/.test(s);
}

/**
 * The operator-config half of a suite's Activity Timeline: the `admin_audit_log` rows for this
 * suite's `<prefix>.*` actions, mapped into TimelineRow[]. Identical across every suite's
 * audit-feed route — only the action list + label/outcome maps differ. The per-tenant half (a
 * `<schema>.<suite>_audit` table, or a synthesized feed) stays suite-specific.
 *
 * @param prefix the `"<suite>."` action prefix, stripped for the fallback label (e.g. "course.").
 */
export async function fetchAdminAuditRows(opts: {
  actions: readonly string[];
  labels: Record<string, string>;
  outcomes: Record<string, string>;
  prefix: string;
  limit: number;
}): Promise<TimelineRow[]> {
  const adminRows = await db
    .select({
      id: schema.adminAuditLog.id,
      createdAt: schema.adminAuditLog.createdAt,
      action: schema.adminAuditLog.action,
      note: schema.adminAuditLog.note,
      actorUserId: schema.adminAuditLog.actorUserId,
    })
    .from(schema.adminAuditLog)
    .where(inArray(schema.adminAuditLog.action, opts.actions as unknown as string[]))
    .orderBy(desc(schema.adminAuditLog.createdAt))
    .limit(opts.limit);

  return adminRows.map((r) => ({
    id: r.id,
    ts: r.createdAt.toISOString(),
    kind: r.action,
    label: opts.labels[r.action] ?? r.action.replace(opts.prefix, "").replaceAll("_", " "),
    detail: r.note ?? null,
    ip: null,
    by: r.actorUserId,
    outcome: opts.outcomes[r.action] ?? "ok",
  }));
}
