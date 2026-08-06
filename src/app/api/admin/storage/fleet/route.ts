// Office superadmin fleet-config API for @tgv/module-storage. GET/PUT the runtime-tunable fleet settings
// (tier caps, dormant-hosting pricing, lifecycle timings, Stripe price pointers) that back the Villagers →
// "Dashboard Storage config" modal. Uses the SAME shared helpers the module's own /api/storage/fleet route
// uses (buildFleetView / sanitizeFleetPatch / writeFleetSettings) so Office and every tenant speak one
// identical contract — no drift. Superadmin-gated via requireAdmin; reads/writes the shared tgv_db through
// office's pgPool. Table: public.member_storage_fleet_settings (migration 0108/0109).
//
// basePath the client passes is "/api/admin/storage" → the gear fetches "{base}/fleet" = this route.
// NOTE (deploy): office's DB role must have DML on member_storage_fleet_settings (0108 grants it to tgv_app);
// grant office's role, or confirm office connects as tgv_app, before PUT will succeed in prod.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { buildFleetView, sanitizeFleetPatch, writeFleetSettings, FLEET_GLOBAL_KEY } from "@tgv/module-storage/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json(await buildFleetView(pgPool));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load fleet settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  let body: { scopeKey?: string; patch?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  // Raw slug kept (parameterized SQL, no injection); it must equal the tenantSlug the resolver looks up.
  const scopeKey = String(body.scopeKey || "").trim().slice(0, 128) || FLEET_GLOBAL_KEY;
  try {
    // Office admins are usernames, not member UUIDs → leave the updated_by audit column null.
    const row = await writeFleetSettings(pgPool, scopeKey, sanitizeFleetPatch(body.patch), null);
    return NextResponse.json({ row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Save failed" }, { status: 500 });
  }
}
