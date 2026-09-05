// /api/admin/dashboard-settings — staff-tunable runtime values for the member
// dashboards (dashboard_runtime_settings KV, jsonb values).
//
// GET → all rows { setting_key, value, updated_at, updated_by }.
// PUT { settingKey, value } → upsert one allowlisted setting; audited.
//
// Allowlist (each entry validates its value):
//   undo_depth — integer 1..100; how many destructive actions a member can
//                reverse with cmd/ctrl+Z in one dashboard session.
//
// Office only WRITES these. Each tenant dashboard READS them server-side
// (tgv.com: src/lib/dashboard/runtime-settings.ts) — same cross-app pattern
// as platform_feature_flags / dashboard_layout_canon.
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

type SettingRow = {
  setting_key: string;
  value: unknown;
  updated_at: string | Date | null;
  updated_by: string | null;
};

const ALLOWED: Record<string, (v: unknown) => string | null> = {
  undo_depth: (v) =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100
      ? null
      : "undo_depth must be an integer between 1 and 100",
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT setting_key, value, updated_at, updated_by
    FROM public.dashboard_runtime_settings
    ORDER BY setting_key ASC
  `);
  const settings = (res as unknown as { rows?: SettingRow[] }).rows ?? [];
  return NextResponse.json({ ok: true, settings });
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

  let body: { settingKey?: string; value?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const settingKey = (body.settingKey ?? "").trim();
  const validate = ALLOWED[settingKey];
  if (!validate) {
    return NextResponse.json(
      { ok: false, error: `settingKey must be one of: ${Object.keys(ALLOWED).join(", ")}` },
      { status: 400 },
    );
  }
  const invalid = validate(body.value);
  if (invalid) {
    return NextResponse.json({ ok: false, error: invalid }, { status: 400 });
  }
  const valueJson = JSON.stringify(body.value);

  const result = await db.transaction(async (tx) => {
    const prevRes = await tx.execute(sql`
      SELECT value FROM public.dashboard_runtime_settings WHERE setting_key = ${settingKey}
    `);
    const prevValue =
      ((prevRes as unknown as { rows?: { value: unknown }[] }).rows ?? [])[0]?.value ?? null;

    await tx.execute(sql`
      INSERT INTO public.dashboard_runtime_settings (setting_key, value, updated_at, updated_by)
      VALUES (${settingKey}, ${valueJson}::jsonb, now(), ${gate.username})
      ON CONFLICT (setting_key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
    `);

    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "platform.dashboard_setting_set",
      targetType: "dashboard_setting",
      targetId: settingKey,
      before: { value: prevValue },
      after: { value: body.value },
      note: `Dashboard setting '${settingKey}' set ${JSON.stringify(prevValue)} → ${valueJson} by ${gate.username}`,
    });

    return { ok: true as const, settingKey, value: body.value };
  });

  return NextResponse.json(result);
}
