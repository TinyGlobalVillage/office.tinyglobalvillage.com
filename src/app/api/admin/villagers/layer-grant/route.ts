// /api/admin/villagers/layer-grant — Editor layers gate ("design mode") for the
// TGV page editor.
//
//   GET  → { ok, memberIds } — every member with a design-mode grant
//          (public.editor_layer_grants). Superadmins are NOT listed here — they
//          always have design mode; the editor gates that on members.role.
//   POST { memberId, granted } → grant (INSERT, granted_by = the operator's
//          member id when resolvable, else NULL) or revoke (DELETE). Idempotent
//          both ways; audit-logged.
//
// Members WITHOUT a row get the Regular ("content") editor — content edits only;
// a row unlocks full layer manipulation. Gated by requireAdmin (villagers-route
// precedent); raw SQL via db.execute() (memory
// feedback_drizzle_turbopack_select_fields).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { logHardeningAction } from "@/lib/audit-log";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT member_id::text AS member_id
    FROM public.editor_layer_grants
    ORDER BY created_at DESC
  `);
  const rows =
    (res as unknown as { rows?: { member_id: string }[] }).rows ?? [];
  return NextResponse.json({
    ok: true,
    memberIds: rows.map((r) => r.member_id),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as
    | { memberId?: string; granted?: boolean }
    | null;
  const memberId = (body?.memberId ?? "").trim();
  const granted = body?.granted;
  if (!UUID_RE.test(memberId) || typeof granted !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "memberId (uuid) + granted (boolean) required" },
      { status: 400 },
    );
  }

  // Honest attribution for granted_by — nullable by design (column is
  // ON DELETE SET NULL), so an unresolvable operator still writes cleanly.
  const grantedBy = await resolveAdminActorId(gate.username);

  let ok = false;
  let error: string | null = null;
  try {
    if (granted) {
      await db.execute(sql`
        INSERT INTO public.editor_layer_grants (member_id, granted_by)
        VALUES (${memberId}, ${grantedBy})
        ON CONFLICT (member_id) DO NOTHING
      `);
    } else {
      await db.execute(sql`
        DELETE FROM public.editor_layer_grants
        WHERE member_id = ${memberId}
      `);
    }
    ok = true;
  } catch {
    // Most likely an unknown member (FK) — surface a clean error, not a 500 page.
    error = "db_write_failed";
  }

  logHardeningAction({
    action: granted ? "editor.layer_grant.grant" : "editor.layer_grant.revoke",
    target: memberId,
    user: gate.username,
    success: ok,
    details: { granted, grantedBy, ...(error ? { error } : {}) },
  });

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: error ?? "write_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, granted });
}
