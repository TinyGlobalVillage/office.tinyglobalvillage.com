// GET /api/admin/course/audit-feed?limit=N
//
// Activity Timeline for the CourseControlModal. MERGES two sources into the shared
// AuditLogTimeline contract ({ rows: TimelineRow[] }), newest-first:
//   1. Operator config changes — admin_audit_log, action `course.*` (typed select; public schema).
//   2. Per-tenant course activity — each tenant's `<schema>.course_audit` (raw, schema-qualified).
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { readCourseConfig, isSafeSchema } from "@/lib/course-config";
import { type TimelineRow, fetchAdminAuditRows } from "@/lib/suite-oversight";

export const runtime = "nodejs";

// Operator config actions (admin_audit_log).
const ADMIN_ACTIONS = [
  "course.killswitch_on",
  "course.killswitch_off",
  "course.tenant_enabled",
  "course.tenant_disabled",
  "course.config_update",
] as const;

const ADMIN_LABEL: Record<string, string> = {
  "course.killswitch_on": "GLOBAL killswitch engaged",
  "course.killswitch_off": "global killswitch released",
  "course.tenant_enabled": "tenant enabled",
  "course.tenant_disabled": "tenant disabled",
  "course.config_update": "config updated",
};
const ADMIN_OUTCOME: Record<string, string> = {
  "course.killswitch_on": "warn",
  "course.killswitch_off": "ok",
  "course.tenant_enabled": "ok",
  "course.tenant_disabled": "warn",
  "course.config_update": "ok",
};

// Per-tenant course_audit kinds → friendly labels.
const TENANT_LABEL: Record<string, string> = {
  course_created: "course created",
  course_published: "course published",
  tree_changed: "structure changed",
  page_saved: "page saved",
  media_changed: "media changed",
  assessment_changed: "assessment changed",
  enrollment_changed: "enrollment changed",
  config_changed: "course config changed",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(searchParams.get("limit") ?? "120")));

  // 1) operator config changes (shared helper — identical across every suite tile)
  const rows: TimelineRow[] = await fetchAdminAuditRows({
    actions: ADMIN_ACTIONS,
    labels: ADMIN_LABEL,
    outcomes: ADMIN_OUTCOME,
    prefix: "course.",
    limit,
  });

  // 2) per-tenant course_audit
  const cfg = readCourseConfig();
  await Promise.all(
    Object.values(cfg.perTenant).map(async (t) => {
      if (!isSafeSchema(t.schema)) return;
      const sch = sql.raw(`"${t.schema}"`);
      try {
        const tenantRows = (
          await db.execute(sql`
            select id::text as id, kind::text as kind, actor_user_id::text as actor_user_id,
                   details, created_at
              from ${sch}.course_audit
             order by created_at desc
             limit ${limit}
          `)
        ).rows as unknown as Array<{
          id: string;
          kind: string;
          actor_user_id: string | null;
          details: Record<string, unknown> | null;
          created_at: string | Date;
        }>;
        for (const r of tenantRows) {
          const title =
            (r.details && (r.details.title ?? r.details.name ?? r.details.slug)) ?? null;
          rows.push({
            id: r.id,
            ts: new Date(r.created_at).toISOString(),
            kind: `course.${r.kind}`,
            label: `${t.label ?? t.schema}: ${TENANT_LABEL[r.kind] ?? r.kind.replaceAll("_", " ")}`,
            detail: title ? String(title) : null,
            ip: null,
            by: r.actor_user_id,
            outcome: r.kind === "course_published" ? "ok" : "ok",
          });
        }
      } catch {
        // a tenant schema without course_audit (or unreachable) is skipped, not fatal
      }
    }),
  );

  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
  return NextResponse.json({ rows: rows.slice(0, limit) });
}
