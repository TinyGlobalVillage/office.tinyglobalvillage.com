// GET /api/admin/villagers/tenants?q=<search> — operator search of TENANT deployments (members) for
// the Managed Onboarding tile. Raw SQL (members lives in @tgv/module-registry, not Office's drizzle
// schema — avoids the cross-bundle is(Column) crash). Operator-only (requireAdmin).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ tenants: [] });
  const like = `%${q}%`;

  const res = await db.execute(sql`
    select id, client_name, domain, env, stripe_mode, connected_account_id,
           contact->>'email' as contact_email
      from villager_sites
     where client_name ilike ${like} or domain ilike ${like}
     order by created_at desc
     limit 25
  `);
  return NextResponse.json({ tenants: res.rows });
}
