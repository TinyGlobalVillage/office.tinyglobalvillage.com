import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { desc } from "drizzle-orm";

// GET /api/admin/tenant-apps/list
//
// Returns the current tenant_apps registry. Used by the Tenant Apps Table
// section of the HCM modal.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select()
    .from(schema.tenantApps)
    .orderBy(desc(schema.tenantApps.createdAt));

  return NextResponse.json({ rows });
}
