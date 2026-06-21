// /api/migrate/jobs/[id] — poll one migration job's live state. The modal hits this
// on an interval while a job runs: phase (status) + per-surface rows → a progress bar,
// the deploy_log narration, the per-job preview site, and whether a recording exists.
//
// Raw SQL (db.execute) for the same cross-bundle is(Column) reason as the list route.

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { existsSync } from "node:fs";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const RCS_ROOT = "/srv/refusion-core";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const jobRes = await db.execute(sql`
    SELECT id,
           client_name    AS "clientName",
           source_domain  AS "sourceDomain",
           status,
           fidelity_score AS "fidelityScore",
           deploy_log     AS "deployLog",
           error,
           created_at     AS "createdAt",
           updated_at     AS "updatedAt"
    FROM migration_jobs WHERE id = ${id}
  `);
  const job = ((jobRes as { rows?: unknown[] }).rows ?? [])[0];
  if (!job) return NextResponse.json({ error: "not found" }, { status: 404 });

  const surfRes = await db.execute(sql`
    SELECT id,
           target_slug             AS "slug",
           code_mode               AS "codeMode",
           data_mode               AS "dataMode",
           status,
           chosen_catalog_entry_id AS "chosenCatalogEntryId",
           target_site             AS "site",
           notes
    FROM migration_surfaces WHERE job_id = ${id} ORDER BY created_at
  `);
  const surfaces = ((surfRes as { rows?: Array<Record<string, unknown>> }).rows ?? []);

  const reviewRes = await db.execute(sql`
    SELECT r.id, r.surface_id AS "surfaceId", r.status, r.top_score AS "topScore", r.reason
    FROM migration_review_items r WHERE r.job_id = ${id} AND r.status = 'open'
  `);
  const reviews = ((reviewRes as { rows?: unknown[] }).rows ?? []);

  const total = surfaces.length;
  const ported = surfaces.filter((s) => s.status === "ported" || s.status === "validated").length;
  const halted = surfaces.filter((s) => s.status === "halted").length;
  const failed = surfaces.filter((s) => s.status === "failed").length;
  const site = (surfaces[0]?.site as string | undefined) ?? null;
  const hasRecording = existsSync(`${RCS_ROOT}/data/migrate/recordings/${id}.webm`);

  return NextResponse.json({
    job,
    surfaces,
    reviews,
    progress: { total, ported, halted, failed },
    site,
    hasRecording,
  });
}
