// /api/migrate/jobs — list (GET) + create-and-run (POST) migration jobs.
//
// Admin-gated via the shared requireAdmin (member-auth aware) — NOT the legacy
// inline isAdmin/users.json check the older sandbox routes use.
//
// GET reads migration_jobs via RAW SQL (db.execute) rather than the drizzle
// select-fields builder: tables from @tgv/module-registry can trip the cross-bundle
// is(Column) check (memory feedback_drizzle_turbopack_select_fields). Raw SQL is
// robust regardless of bundler.
//
// POST is the run-from-UI entry (the "locked process model"): create the job row,
// then SPAWN the engine worker out-of-process (tsx run-job.ts) detached, so the
// migration runs past the request lifecycle. The worker streams progress into
// migration_jobs (status + deploy_log); the modal polls GET /api/migrate/jobs/[id].
// Office connects as tgv_app — the same role the worker writes page_models with — so
// the pre-created row and the worker's updates never collide.

import { NextResponse, type NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { spawn } from "node:child_process";
import { openSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const RCS_ROOT = "/srv/refusion-core";
const TSX = `${RCS_ROOT}/node_modules/.bin/tsx`;
const WORKER = `${RCS_ROOT}/packages/@tgv/module-marketplace/migration-engine/scripts/run-job.ts`;
const LOG_DIR = `${RCS_ROOT}/data/migrate/logs`;

const CODE_TIERS = ["reinvent", "approximate", "bespoke"] as const;

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

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sourceUrl = String(body.sourceUrl ?? "").trim();

  let u: URL;
  try { u = new URL(sourceUrl); } catch { return NextResponse.json({ error: "invalid sourceUrl" }, { status: 400 }); }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return NextResponse.json({ error: "sourceUrl must be http(s)" }, { status: 400 });
  }

  const clientName = String(body.clientName ?? u.hostname).slice(0, 120) || u.hostname;
  const maxPages = Math.min(Math.max(Number(body.maxPages ?? 15) || 15, 1), 60);
  const codeTier = (CODE_TIERS as readonly string[]).includes(String(body.codeTier)) ? String(body.codeTier) : "reinvent";
  const record = body.record === true;
  const site = `migrate-${randomUUID().slice(0, 8)}`;

  // 1. create the job row (status intake) so the UI gets a jobId to poll immediately.
  const ins = await db.execute(sql`
    INSERT INTO migration_jobs (client_name, source_domain, driver, status, created_by)
    VALUES (${clientName}, ${u.hostname}, 'admin', 'intake', ${gate.username})
    RETURNING id
  `);
  const jobId = ((ins as unknown as { rows?: Array<{ id: string }> }).rows ?? [])[0]?.id;
  if (!jobId) return NextResponse.json({ error: "could not create job" }, { status: 500 });

  // 2. spawn the worker out-of-process, detached, logging to a per-job file.
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    const logFd = openSync(`${LOG_DIR}/${jobId}.log`, "a");
    const args = [
      WORKER,
      "--url", sourceUrl,
      "--job-id", jobId,
      "--site", site,
      "--client", clientName,
      "--created-by", gate.username,
      "--code", codeTier,
      "--max-pages", String(maxPages),
    ];
    if (record) args.push("--record");
    const child = spawn(TSX, args, { cwd: RCS_ROOT, detached: true, stdio: ["ignore", logFd, logFd], env: process.env });
    child.unref();
  } catch (err) {
    await db.execute(sql`UPDATE migration_jobs SET status='failed', error=${String(err)} WHERE id=${jobId}`);
    return NextResponse.json({ error: "failed to spawn worker", detail: String(err) }, { status: 500 });
  }

  return NextResponse.json({ jobId, site, status: "intake", codeTier, maxPages });
}
