// /api/admin/dashboard-config — GLOBAL dashboard feature killswitch (3-state).
//
// GET → all platform_feature_flags rows { feature_key, state, updated_at, updated_by }.
// PUT { featureKey, state } → set one flag's state ('off' | 'admin' | 'on'); audited.
//
//   off   = feature hidden for EVERYONE (members AND admins)
//   admin = visible ONLY to platform admins (preview/test before launch)
//   on    = no global restriction; the per-member dashboard_features toggle decides
//
// Office only WRITES these flags. Each tenant dashboard ENFORCES them in its
// feature resolution (a one-line filter that reads this table — see
// docs/dashboard-feature-flags-enforcement.md, handed to the tgv.com lane).
//
// Raw SQL via db.execute() — this table isn't in the drizzle schema, and @tgv
// registry tables trip the cross-bundle is(Column) check anyway (memory
// feedback_drizzle_turbopack_select_fields). Audit writes use schema.adminAuditLog.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

type FlagRow = {
  feature_key: string;
  state: "off" | "admin" | "on";
  updated_at: string | Date | null;
  updated_by: string | null;
};

const STATES = ["off", "admin", "on"] as const;
type FlagState = (typeof STATES)[number];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT feature_key, state, updated_at, updated_by
    FROM public.platform_feature_flags
    ORDER BY feature_key ASC
  `);
  const flags = (res as unknown as { rows?: FlagRow[] }).rows ?? [];
  return NextResponse.json({ ok: true, flags });
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // Audit integrity over convenience: no resolvable actor uuid → refuse.
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json(
      { ok: false, error: "Admin actor not registered in users table" },
      { status: 403 },
    );
  }

  let body: { featureKey?: string; state?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const featureKey = (body.featureKey ?? "").trim();
  const state = (body.state ?? "").trim() as FlagState;
  if (!featureKey) {
    return NextResponse.json({ ok: false, error: "featureKey required" }, { status: 400 });
  }
  if (!STATES.includes(state)) {
    return NextResponse.json(
      { ok: false, error: "state must be off | admin | on" },
      { status: 400 },
    );
  }

  const result = await db.transaction(async (tx) => {
    const prevRes = await tx.execute(sql`
      SELECT state FROM public.platform_feature_flags WHERE feature_key = ${featureKey}
    `);
    const prevState =
      ((prevRes as unknown as { rows?: { state: string }[] }).rows ?? [])[0]?.state ?? null;

    await tx.execute(sql`
      INSERT INTO public.platform_feature_flags (feature_key, state, updated_at, updated_by)
      VALUES (${featureKey}, ${state}, now(), ${gate.username})
      ON CONFLICT (feature_key) DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
    `);

    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "platform.feature_flag_set",
      targetType: "feature_flag",
      targetId: featureKey,
      before: { state: prevState },
      after: { state },
      note: `Dashboard feature '${featureKey}' set ${prevState ?? "(none)"} → ${state} by ${gate.username}`,
    });

    return { ok: true as const, featureKey, state };
  });

  return NextResponse.json(result);
}
