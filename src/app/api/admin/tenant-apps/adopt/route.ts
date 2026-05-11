import { type NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { sql } from "drizzle-orm";

const exec = promisify(execFile);

const STATE_PATH = "/srv/refusion-core/logs/tgv-office/pm2-drift-state.json";

// POST /api/admin/tenant-apps/adopt  { pm2Name, hostname, slug? }
//
// Promotes a drifting pm2 app into the tenant_apps registry. Reads the live
// cwd + port from `pm2 jlist`, then INSERTs a tenant_apps row. If the live
// port is < 3101 (tenant floor), the caller must rerun the app on a reassigned
// port — adopt itself only registers the existing state.
//
// Caller can override `slug` (defaults to pm2Name). After insert, the offender
// is removed from the drift state file so the cron stops re-announcing.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    pm2Name?: string;
    hostname?: string;
    slug?: string;
  };
  const pm2Name = body.pm2Name?.trim();
  const hostname = body.hostname?.trim();
  const slug = (body.slug ?? body.pm2Name)?.trim();
  if (!pm2Name || !hostname || !slug) {
    return NextResponse.json(
      { error: "pm2Name, hostname, and slug required" },
      { status: 400 },
    );
  }

  type Pm2Proc = { name: string; pm2_env?: { pm_cwd?: string; PORT?: string } };
  let proc: Pm2Proc | null = null;
  try {
    const { stdout } = await exec("pm2", ["jlist"], { timeout: 10_000 });
    const list = JSON.parse(stdout) as Pm2Proc[];
    proc = list.find((p) => p?.name === pm2Name) ?? null;
  } catch (e) {
    return NextResponse.json({ error: `pm2 jlist: ${String(e)}` }, { status: 500 });
  }
  if (!proc) return NextResponse.json({ error: "pm2 process not found" }, { status: 404 });

  const cwd = proc.pm2_env?.pm_cwd;
  const portStr = proc.pm2_env?.PORT;
  if (!cwd || !portStr) {
    return NextResponse.json(
      { error: "pm2 process missing cwd or PORT — cannot adopt without explicit reassignment" },
      { status: 422 },
    );
  }
  const port = Number(portStr);
  if (!Number.isInteger(port) || port < 3101 || port > 3999) {
    return NextResponse.json(
      {
        error: `port ${port} outside tenant range (3101-3999) — stop the app, free the port, then re-run via provisionTenant`,
      },
      { status: 422 },
    );
  }

  try {
    await db.insert(schema.tenantApps).values({
      slug,
      hostname,
      port,
      cwd,
      pm2Name,
      status: "active",
    });
    await db.insert(schema.tenantAppsAudit).values({
      slug,
      kind: "adopted",
      actor: auth.username,
      details: { pm2Name, port, cwd, hostname },
    });
  } catch (e) {
    return NextResponse.json({ error: `DB insert: ${String(e)}` }, { status: 500 });
  }

  // Scrub from drift state so the cron emits a 'drift_resolved' on the next tick
  // rather than re-firing.
  try {
    if (fs.existsSync(STATE_PATH)) {
      const s = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as {
        drifting: Record<string, string>;
        lastRunAt: string;
      };
      if (s.drifting?.[pm2Name]) {
        delete s.drifting[pm2Name];
        fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
      }
    }
  } catch { /* state file is advisory — silent fail ok */ }

  // Record a synthetic resolved event immediately so the timeline shows it now.
  await db.execute(
    sql`INSERT INTO tenant_apps_audit (slug, kind, actor, details)
        VALUES (${slug}, 'drift_resolved', ${auth.username}, ${JSON.stringify({ pm2Name, via: "adopt" })}::jsonb)`,
  );

  return NextResponse.json({ ok: true, slug, port });
}
