// /api/migrate/jobs — list (GET) + create (POST) migration jobs.
//
// Admin-gated via the shared requireAdmin (member-auth aware) — NOT the legacy
// inline isAdmin/users.json check the older sandbox routes use. Every mutation
// emits a TimelineRow into the job's audit feed for the modal's AuditLogTimeline.
//
// STUB: wiring to @tgv/migration-engine (createMigrationJob / analyze) is TODO.

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // TODO: SELECT from migration_jobs (active=1 → status NOT IN live/failed/cancelled),
  // newest-first. For now return an empty list so the modal renders cleanly.
  const _active = req.nextUrl.searchParams.get("active") === "1";
  return NextResponse.json({ jobs: [] });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // TODO: validate { source, sourceRef, targetSlug, targetDomain }, INSERT a
  // migration_jobs row (driver:'admin', createdBy: office username), kick Stage A
  // (intake) + Stage B (analyze) as a spawned job, return { jobId, phase }.
  return NextResponse.json(
    { error: "not-implemented", note: "engine wiring pending — see MIGRATION-ARCHITECTURE.md" },
    { status: 501 },
  );
}
