// GET /api/admin/migration-snapshots/shape?path=…&table=schema.table — the table's DDL in the
// snapshot vs in the live database now, plus a line diff.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { cli, findSnapshot, lineDiff, TABLE_RE } from "@/lib/migration-snapshots/state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const table = req.nextUrl.searchParams.get("table") || "";
  if (!TABLE_RE.test(table)) return NextResponse.json({ error: "table must be schema.table" }, { status: 400 });
  try {
    const s = await findSnapshot(req.nextUrl.searchParams.get("path"));
    const [then, now] = await Promise.all([cli(["ddl", s.path, table]), cli(["ddl-now", s.db, table])]);
    return NextResponse.json({ db: s.db, table, then: then.trim(), now: now.trim(), diff: lineDiff(then.trim(), now.trim()) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 409 });
  }
}
