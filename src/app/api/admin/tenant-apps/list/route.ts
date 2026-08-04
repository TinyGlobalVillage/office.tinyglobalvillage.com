import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { desc, eq } from "drizzle-orm";

// GET /api/admin/tenant-apps/list
//
// Returns the current tenant_apps registry. Used by the Tenant Apps Table
// section of the HCM modal.
//
// Each row carries the VILLAGE it serves, joined on villager_sites.tenant_app_slug
// (plan 21 — sql/villager-sites-tenant-app-slug.sql). Before that column the two
// registries shared no key and the link lived in a deploy_log JSON blob, so this
// table could tell you a process existed but not whose site it was. An app with
// no village is a real answer, not a gap: it means nothing claims the process.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const rows = await db
    .select({
      slug: schema.tenantApps.slug,
      hostname: schema.tenantApps.hostname,
      port: schema.tenantApps.port,
      cwd: schema.tenantApps.cwd,
      pm2Name: schema.tenantApps.pm2Name,
      status: schema.tenantApps.status,
      createdAt: schema.tenantApps.createdAt,
      updatedAt: schema.tenantApps.updatedAt,
      lastDriftCheckAt: schema.tenantApps.lastDriftCheckAt,
      villageId: schema.villagerSites.id,
      villageName: schema.villagerSites.clientName,
      villageDomain: schema.villagerSites.domain,
    })
    .from(schema.tenantApps)
    .leftJoin(
      schema.villagerSites,
      eq(schema.villagerSites.tenantAppSlug, schema.tenantApps.slug),
    )
    .orderBy(desc(schema.tenantApps.createdAt));

  return NextResponse.json({
    rows: rows.map(({ villageId, villageName, villageDomain, ...app }) => ({
      ...app,
      village: villageId
        ? { id: villageId, label: villageName || villageDomain || villageId }
        : null,
    })),
  });
}
