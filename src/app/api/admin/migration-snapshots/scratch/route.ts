// GET /api/admin/migration-snapshots/scratch?db=restore_…            → row count per table
// GET /api/admin/migration-snapshots/scratch?db=…&table=s.t&offset=N → a page of rows (50)
// Scratch databases only (restore_*): Office never browses a live database's rows here.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { counts, rows, SCRATCH_RE, TABLE_RE } from "@/lib/migration-snapshots/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PAGE = 50;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const sp = req.nextUrl.searchParams;
  const db = sp.get("db") || "";
  const table = sp.get("table");
  if (!SCRATCH_RE.test(db)) return NextResponse.json({ error: "scratch databases are named restore_*" }, { status: 400 });
  try {
    if (!table) return NextResponse.json({ db, counts: await counts(db) });
    if (!TABLE_RE.test(table)) return NextResponse.json({ error: "table must be schema.table" }, { status: 400 });
    const offset = Math.max(0, Math.min(10_000_000, Number(sp.get("offset")) || 0));
    return NextResponse.json({ db, table, offset, limit: PAGE, rows: await rows(db, table, PAGE, offset) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
