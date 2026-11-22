// GET /api/admin/migration-snapshots/inspect?path=… — what a snapshot holds and why it was taken:
// the tables in the dump (pg_restore -l) and the migration's destructive statements.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { findSnapshot, inspect, migrationStatements } from "@/lib/migration-snapshots/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const s = await findSnapshot(req.nextUrl.searchParams.get("path"));
    const contents = await inspect(s.path);
    return NextResponse.json({ snapshot: s, ...contents, migration: migrationStatements(s) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
