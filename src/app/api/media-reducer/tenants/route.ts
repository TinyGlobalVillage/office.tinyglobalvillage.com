// GET /api/media-reducer/tenants — tenant picker for the Media Reducer's
// "upload to tenant storage (CDN)" destination. Staff-gated (requireAuth, not
// admin — reducing media for a client is routine staff work). Returns the
// domain too: it names the tenant's CDN bucket (/media/<domain>/…), matching
// how deployed projects already appear in the Storage page dropdown.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const res = await db.execute(sql`
    select id,
           domain,
           coalesce(client_name, domain, 'Tenant') as label
      from villager_sites
     order by coalesce(client_name, domain) asc
     limit 200`);
  return NextResponse.json({ tenants: res.rows });
}
