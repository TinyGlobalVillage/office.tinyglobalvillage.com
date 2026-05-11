import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { eq } from "drizzle-orm";

const exec = promisify(execFile);

// POST /api/admin/tenant-apps/restart  { slug: string }
//
// Restarts the pm2 process for a tenant app. Operator-visible action —
// recorded in the audit log.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug?.trim();
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const rows = await db
    .select({ pm2Name: schema.tenantApps.pm2Name })
    .from(schema.tenantApps)
    .where(eq(schema.tenantApps.slug, slug));
  if (rows.length === 0) {
    return NextResponse.json({ error: "unknown slug" }, { status: 404 });
  }

  try {
    await exec("pm2", ["restart", rows[0].pm2Name], { timeout: 30_000 });
    await exec("pm2", ["save"], { timeout: 15_000 });
    await db.insert(schema.tenantAppsAudit).values({
      slug,
      kind: "restarted",
      actor: auth.username,
      details: { pm2Name: rows[0].pm2Name },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    await db.insert(schema.tenantAppsAudit).values({
      slug,
      kind: "action_failed",
      actor: auth.username,
      details: { action: "restart", error: String(e) },
    });
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
