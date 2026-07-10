// /api/admin/villagers/onboard-config — the Onboard Villager gear config.
// First lever: the AI Template Designer beta flag (platform_feature_flags
// 'ai_template_designer', PLATFORM-WIDE — gates the public wizard's AI section
// AND the Office modal's; Gio 2026-07-10: default off, 'admin' = beta preview,
// 'on' = everyone; curated gallery + migration intake are never gated).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

const KEY = "ai_template_designer";
const STATES = new Set(["off", "admin", "on"]);

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  ((r as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const r = await db.execute(sql`
    SELECT state FROM public.platform_feature_flags WHERE feature_key = ${KEY}`);
  const state = String(rowsOf(r)[0]?.state ?? "on");
  return NextResponse.json({ aiTemplateDesigner: state });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json({ ok: false, error: "no_actor_for_audit" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { aiTemplateDesigner?: string } | null;
  const state = body?.aiTemplateDesigner;
  if (!state || !STATES.has(state)) {
    return NextResponse.json({ ok: false, error: "state must be off|admin|on" }, { status: 400 });
  }

  const prev = await db.execute(sql`
    SELECT state FROM public.platform_feature_flags WHERE feature_key = ${KEY}`);
  await db.execute(sql`
    INSERT INTO public.platform_feature_flags (feature_key, state, updated_by, updated_at)
    VALUES (${KEY}, ${state}, ${gate.username}, now())
    ON CONFLICT (feature_key) DO UPDATE SET
      state = EXCLUDED.state, updated_by = EXCLUDED.updated_by, updated_at = now()`);

  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: "onboard.ai_designer_flag_set",
    targetType: "platform_feature_flag",
    targetId: KEY,
    before: { state: rowsOf(prev)[0]?.state ?? null },
    after: { state },
    note: `AI Template Designer flag set to '${state}' by ${gate.username}`,
  });

  return NextResponse.json({ ok: true, aiTemplateDesigner: state });
}
