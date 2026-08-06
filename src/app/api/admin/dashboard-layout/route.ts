// /api/admin/dashboard-layout — the fleet's dashboard LAYOUT policy.
//
// Sibling of /api/admin/dashboard-config, and the distinction between them matters:
//   • dashboard-config  → WHICH FEATURES exist at all (platform_feature_flags, off/admin/on).
//   • this              → WHOSE ARRANGEMENT of them everyone sees (dashboard_layout_canon).
//
//   GET → { mode, hasLayout, updatedBy, updatedAt, personalLayouts }
//   PUT { mode: 'overwritten' | 'custom' }  → flip the switch; audited.
//   DELETE → clear the published tree, so the fleet falls back to the layout built from the
//            feature registry. Audited. Does NOT touch the mode.
//
// Gio 2026-08-05: "a toggle between overwritten (which resets all users to the default settings of
// their dashboard) and custom, and right now we'll keep it on overwritten so I can tweak how I need
// it to tweak and it reach everyone."
//
// NOTHING HERE DELETES A MEMBER'S ARRANGEMENT. `overwritten` makes the canon win at RENDER time and
// leaves member_dashboard_layout alone, so flipping to `custom` hands everyone their own layout
// back. A switch that destroyed data on the way through would be a one-way door wearing a toggle's
// clothes. `personalLayouts` in the GET is how many rows are sitting there waiting, so the operator
// can see what `custom` would restore before choosing it.
//
// The canon TREE is published from HQ's own dashboard (arrange it, save, done) rather than edited
// here — Office has no dashboard to arrange. This route owns the switch and the reset.
//
// Raw SQL via db.execute(): this table isn't in Office's drizzle schema, and @tgv registry tables
// trip the cross-bundle is(Column) check anyway (memory feedback_drizzle_turbopack_select_fields).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

const MODES = ["overwritten", "custom"] as const;
type Mode = (typeof MODES)[number];

function rowsOf(r: unknown): any[] {
  return Array.isArray(r) ? r : ((r as { rows?: any[] })?.rows ?? []);
}

async function readState() {
  const res = await db.execute(sql`
    SELECT mode, (layout IS NOT NULL) AS has_layout, updated_by, updated_at
    FROM public.dashboard_layout_canon
    WHERE id = 1
    LIMIT 1`);
  const row = rowsOf(res)[0];
  const counted = await db.execute(sql`SELECT count(*)::int AS n FROM public.member_dashboard_layout`);
  return {
    // No row yet (the DDL hasn't run) reads as the built-in default rather than as an error: the
    // fleet is already rendering the registry canon in that state, so saying anything else here
    // would misreport what people are actually looking at.
    mode: (row?.mode === "custom" ? "custom" : "overwritten") as Mode,
    hasLayout: Boolean(row?.has_layout),
    updatedBy: row?.updated_by ?? null,
    updatedAt: row?.updated_at ?? null,
    personalLayouts: Number(rowsOf(counted)[0]?.n ?? 0),
  };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  try {
    return NextResponse.json({ ok: true, ...(await readState()) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  // Audit integrity over convenience: no resolvable actor uuid → refuse. Same rule as the feature
  // killswitch beside it, and for a bigger blast radius — this one changes every dashboard at once.
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json({ ok: false, error: "Admin actor not registered in users table" }, { status: 403 });
  }

  let body: { mode?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const mode = (body.mode ?? "").trim() as Mode;
  if (!MODES.includes(mode)) {
    return NextResponse.json({ ok: false, error: "mode must be overwritten | custom" }, { status: 400 });
  }

  try {
    const result = await db.transaction(async (tx) => {
      const prev = rowsOf(await tx.execute(sql`SELECT mode FROM public.dashboard_layout_canon WHERE id = 1`))[0]?.mode ?? null;

      await tx.execute(sql`
        INSERT INTO public.dashboard_layout_canon (id, mode, updated_at, updated_by)
        VALUES (1, ${mode}, now(), ${gate.username})
        ON CONFLICT (id) DO UPDATE SET
          mode = EXCLUDED.mode,
          updated_at = now(),
          updated_by = EXCLUDED.updated_by`);

      await tx.insert(schema.adminAuditLog).values({
        actorUserId,
        action: "platform.dashboard_layout_mode_set",
        targetType: "dashboard_layout",
        targetId: "canon",
        before: { mode: prev },
        after: { mode },
        note:
          mode === "overwritten"
            ? `Dashboard layout set to OVERWRITTEN by ${gate.username} — every dashboard renders the canon; personal layouts are ignored, not deleted.`
            : `Dashboard layout set to CUSTOM by ${gate.username} — members with a saved layout get their own arrangement back.`,
      });

      return { mode, previous: prev };
    });
    return NextResponse.json({ ok: true, ...result, ...(await readState()) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) {
    return NextResponse.json({ ok: false, error: "Admin actor not registered in users table" }, { status: 403 });
  }
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`UPDATE public.dashboard_layout_canon SET layout = NULL, updated_at = now(), updated_by = ${gate.username} WHERE id = 1`);
      await tx.insert(schema.adminAuditLog).values({
        actorUserId,
        action: "platform.dashboard_layout_canon_cleared",
        targetType: "dashboard_layout",
        targetId: "canon",
        before: { hasLayout: true },
        after: { hasLayout: false },
        note: `Published dashboard layout cleared by ${gate.username} — the fleet falls back to the layout built from the feature registry.`,
      });
    });
    return NextResponse.json({ ok: true, ...(await readState()) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
