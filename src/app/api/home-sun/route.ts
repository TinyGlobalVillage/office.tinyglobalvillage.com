// /api/home-sun — the Office Home Screen editor's read/write of the living sun (shared tgv_db table
// home_sun_settings, 0283_home_sun.sql; the apps read it from tinyglobalvillage.com /api/app/home-sun).
//   GET  (Office user) → {settings, version, source, updatedAt}
//   PUT  (Office admin) {settings} → saved; Office edits are desktop/web edits, so they always land (they override
//        anything a phone did while offline — the phone only writes on the version it last saw).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { pgPool } from "@/lib/pg-pool";
import { requireAuth } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/api-admin";
import { normalizeHomeSun } from "@tgv/module-component-library/components/home-sun/settings";

const noStore = { "Cache-Control": "no-store" } as const;
const shape = (r: Record<string, unknown> | undefined) => ({
  settings: normalizeHomeSun(r?.settings),
  version: Number(r?.version ?? 0),
  source: String(r?.source ?? "web"),
  updatedAt: r ? new Date(r.updated_at as string).toISOString() : null,
});

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  const { rows } = await pgPool.query("SELECT settings, version, source, updated_at FROM public.home_sun_settings WHERE scope = 'global'");
  return NextResponse.json(shape(rows[0]), { headers: noStore });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const b = (await req.json().catch(() => ({}))) as { settings?: unknown };
  const settings = normalizeHomeSun(b.settings);
  const { rows } = await pgPool.query(
    `INSERT INTO public.home_sun_settings (scope, settings, version, source, updated_by, updated_at)
     VALUES ('global', $1::jsonb, 1, 'web', $2, now())
     ON CONFLICT (scope) DO UPDATE SET settings = EXCLUDED.settings, version = home_sun_settings.version + 1,
       source = 'web', updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING settings, version, source, updated_at`,
    [JSON.stringify(settings), (auth as { username?: string }).username ?? null],
  );
  return NextResponse.json(shape(rows[0]), { headers: noStore });
}
