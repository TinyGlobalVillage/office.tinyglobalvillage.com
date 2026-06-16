// GET /api/admin/course/usage
//
// Cross-tenant course analytics for the CourseControlModal (Villagers → Course). Reads each tenant's
// `course_*` tables in tgv_db DIRECTLY via raw db.execute(sql) — Office's pool has NO search_path, so
// every table is SCHEMA-QUALIFIED (`refusionist.course_*`) and we loop the per-tenant registry from
// the shared config. Typed db.select can't reach these (they're not in Office's @tgv/module-registry
// schema), and raw SQL also dodges the Turbopack is(Column) crash.
//
// ⚠ Phase-7 §0: EVERY count filters `course_enrollments.source = 'member'` so operator "take as
// student" preview/dogfood runs never inflate real-learner numbers. The filter cascades —
// certificates/attempts join through course_enrollments, so they inherit it.
//
// Read-only. Gated by requireAdmin.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { readCourseConfig, isSafeSchema } from "@/lib/course-config";

export const runtime = "nodejs";

type PerCourse = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  enrollments: number;
  completions: number;
  certificates: number;
  attempts: number;
  passed: number;
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const cfg = readCourseConfig();
  const tenants = Object.entries(cfg.perTenant);

  const out = await Promise.all(
    tenants.map(async ([memberId, t]) => {
      const base = { memberId, label: t.label ?? memberId, schema: t.schema, enabled: t.enabled };
      if (!isSafeSchema(t.schema)) {
        return { ...base, error: "bad_schema" as const };
      }
      const sch = sql.raw(`"${t.schema}"`);
      try {
        const perCourse = (
          await db.execute(sql`
            select
              c.id::text                          as id,
              c.title                             as title,
              c.status::text                      as status,
              coalesce(e.enrollments, 0)::int     as enrollments,
              coalesce(e.completions, 0)::int     as completions,
              coalesce(ct.certificates, 0)::int   as certificates,
              coalesce(at.attempts, 0)::int       as attempts,
              coalesce(at.passed, 0)::int         as passed
            from ${sch}.course_courses c
            left join (
              select course_id,
                     count(*)::int as enrollments,
                     count(*) filter (where status = 'completed' or completed_at is not null)::int as completions
                from ${sch}.course_enrollments
               where source = 'member'
               group by course_id
            ) e on e.course_id = c.id
            left join (
              select en.course_id, count(*)::int as certificates
                from ${sch}.course_certificates cc
                join ${sch}.course_enrollments en on en.id = cc.enrollment_id and en.source = 'member'
               group by en.course_id
            ) ct on ct.course_id = c.id
            left join (
              select en.course_id,
                     count(*)::int as attempts,
                     count(*) filter (where a.passed)::int as passed
                from ${sch}.course_attempts a
                join ${sch}.course_enrollments en on en.id = a.enrollment_id and en.source = 'member'
               where a.status = 'graded'
               group by en.course_id
            ) at on at.course_id = c.id
            order by c.status, c.title
          `)
        ).rows as unknown as PerCourse[];

        const learners =
          Number(
            (
              await db.execute(sql`
                select count(distinct user_id)::int as learners
                  from ${sch}.course_enrollments
                 where source = 'member'
              `)
            ).rows[0]?.learners ?? 0,
          );

        const courses = { draft: 0, published: 0, archived: 0, total: perCourse.length };
        let enrollments = 0,
          completions = 0,
          certificates = 0,
          attempts = 0,
          passed = 0,
          zeroEnrollPublished = 0;
        for (const r of perCourse) {
          if (r.status in courses) courses[r.status] += 1;
          enrollments += r.enrollments;
          completions += r.completions;
          certificates += r.certificates;
          attempts += r.attempts;
          passed += r.passed;
          if (r.status === "published" && r.enrollments === 0) zeroEnrollPublished += 1;
        }

        return {
          ...base,
          error: null,
          courses,
          enrollments,
          completions,
          certificates,
          learners,
          attempts: { graded: attempts, passed },
          health: { zeroEnrollPublished },
          perCourse,
        };
      } catch (e: unknown) {
        return { ...base, error: String((e as Error)?.message ?? e) };
      }
    }),
  );

  return NextResponse.json({ tenants: out });
}
