// GET /api/admin/consent/tenants — the tenant picker for "Request Tenant Access" (admin-mutation-
// consent / villager-dashboard-canon P6). Operator-only. Lists members (tenants) from tgv_db.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const res = await db.execute(sql`
    select id, coalesce(client_name, domain, 'Tenant') as name, deploy_status
      from villager_sites
     order by coalesce(client_name, domain) asc
     limit 200`);
  return NextResponse.json({ tenants: res.rows });
}
