// GET /api/admin/villagers/members?q=<search> — operator member search for the Villagers surface.
//
// Reads the shared tgv_db `member_users` table directly (raw SQL — it lives in @tgv/module-registry,
// not Office's drizzle schema; raw db.execute avoids the cross-bundle is(Column) crash). Operator-
// only (requireAdmin). Returns a small id/email/name/role projection for the picker.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ members: [] });
  const like = `%${q}%`;

  const res = await db.execute(sql`
    select id, email, name, role
      from member_users
     where email ilike ${like} or coalesce(name, '') ilike ${like}
     order by coalesce(last_login_at, created_at) desc nulls last
     limit 25
  `);
  return NextResponse.json({ members: res.rows });
}
