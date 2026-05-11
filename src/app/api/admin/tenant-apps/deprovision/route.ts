import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { eq } from "drizzle-orm";

const exec = promisify(execFile);

// POST /api/admin/tenant-apps/deprovision  { slug: string, finalize?: boolean }
//
// Soft-delete by default: pm2 stop + status='deprovisioning'. With finalize=true,
// fully tears down (pm2 delete + nginx rm + clients/<slug>/ rm + DB row delete).
// finalize requires the row to already be in 'deprovisioning' state — two-step
// gate prevents accidental nuke.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    slug?: string;
    finalize?: boolean;
  };
  const slug = body.slug?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const rows = await db
    .select()
    .from(schema.tenantApps)
    .where(eq(schema.tenantApps.slug, slug));
  if (rows.length === 0) {
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });
  }
  const row = rows[0];

  const args = body.finalize
    ? [
        "--silent", "dlx", "tsx",
        "/srv/refusion-core/utils/scripts/project/provision-tenant/deprovisionTenant.ts",
        slug, "--finalize",
      ]
    : [
        "--silent", "dlx", "tsx",
        "/srv/refusion-core/utils/scripts/project/provision-tenant/deprovisionTenant.ts",
        slug,
      ];

  try {
    await exec("pnpm", args, { timeout: 120_000 });
    await db.insert(schema.tenantAppsAudit).values({
      slug,
      kind: body.finalize ? "finalized" : "deprovisioned",
      actor: auth.username,
      details: { pm2Name: row.pm2Name, port: row.port, finalize: !!body.finalize },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await db.insert(schema.tenantAppsAudit).values({
      slug,
      kind: "action_failed",
      actor: auth.username,
      details: { action: body.finalize ? "finalize" : "deprovision", error: String(e) },
    });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
