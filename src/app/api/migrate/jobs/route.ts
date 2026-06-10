// /api/migrate/jobs — list (GET) + create (POST) migration jobs.
//
// Admin-gated via the shared requireAdmin (member-auth aware) — NOT the legacy
// inline isAdmin/users.json check the older sandbox routes use.
//
// GET reads migration_jobs via RAW SQL (db.execute) rather than the drizzle
// select-fields builder: tables from @tgv/module-registry can trip the cross-bundle
// is(Column) check (memory feedback_drizzle_turbopack_select_fields). Raw SQL is
// robust regardless of bundler.

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const active = req.nextUrl.searchParams.get("active") === "1";
  const res = await db.execute(sql`
    SELECT id,
           client_name     AS "clientName",
           source_domain   AS "sourceDomain",
           status,
           fidelity_score  AS "fidelityScore",
           created_at      AS "createdAt"
    FROM migration_jobs
    ${active ? sql`WHERE status NOT IN ('live','failed','cancelled')` : sql``}
    ORDER BY created_at DESC
    LIMIT 50
  `);
  const rows = (res as { rows?: unknown[] }).rows ?? [];
  return NextResponse.json({ jobs: rows });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // TODO(migration-engine): validate intake { clientName, sourceDomain, sources[] },
  // then spawn the engine out-of-process (the locked process model) to run
  // analyze → persistContentFirst. Returns { jobId, phase }. See MIGRATION-ARCHITECTURE.md §10.
  return NextResponse.json(
    { error: "not-implemented", note: "run-from-UI is the next slice — see MIGRATION-ARCHITECTURE.md" },
    { status: 501 },
  );
}
