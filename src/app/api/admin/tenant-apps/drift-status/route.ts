import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";

const exec = promisify(execFile);

const STATE_PATH = "/srv/refusion-core/logs/tgv-office/pm2-drift-state.json";
const ECOSYSTEM = "/srv/refusion-core/ecosystem.config.cjs";

// GET /api/admin/tenant-apps/drift-status
//
// Snapshot of the drift situation right now — recomputed live, plus the
// persisted state from the cron's JSON state file. The cron writes the state
// file hourly; this endpoint runs the same diff on-demand so the modal can
// show fresh data after a recent provision/deprovision without waiting.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  // Live pm2 list
  let pm2List: Array<{ name: string; pm2_env?: { pm_cwd?: string; PORT?: string } }> = [];
  try {
    const { stdout } = await exec("pm2", ["jlist"], { timeout: 10_000 });
    pm2List = JSON.parse(stdout);
  } catch (e) {
    return NextResponse.json({ error: `pm2 jlist: ${String(e)}` }, { status: 500 });
  }

  // Authorized infra set — shell out to node to evaluate ecosystem.config.cjs,
  // since webpack tries to bundle any in-process require(<variable>) call.
  // The child process gets a fresh module cache for free.
  let infra: Set<string>;
  try {
    const { stdout } = await exec(
      "node",
      [
        "-e",
        `const c = require(${JSON.stringify(ECOSYSTEM)}); ` +
          `process.stdout.write(JSON.stringify((c.apps || []).map(a => a.name)));`,
      ],
      { timeout: 5_000 },
    );
    infra = new Set(JSON.parse(stdout) as string[]);
  } catch (e) {
    return NextResponse.json({ error: `ecosystem read: ${String(e)}` }, { status: 500 });
  }

  const tenants = await db
    .select({ pm2Name: schema.tenantApps.pm2Name })
    .from(schema.tenantApps);
  const tenantSet = new Set(tenants.map((t) => t.pm2Name));

  const drifting = pm2List
    .filter((p) => !infra.has(p.name) && !tenantSet.has(p.name))
    .map((p) => ({
      pm2Name: p.name,
      cwd: p.pm2_env?.pm_cwd ?? null,
      port: p.pm2_env?.PORT ?? null,
    }));

  let persistedState: unknown = null;
  try {
    if (fs.existsSync(STATE_PATH)) {
      persistedState = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    drifting,
    persistedState,
    counts: {
      pm2: pm2List.length,
      infra: infra.size,
      tenants: tenantSet.size,
      drifting: drifting.length,
    },
  });
}
