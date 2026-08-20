// /api/admin/villagers/page-grant — the page-editor PERMISSION LIST (Gio
// 2026-08-19) for the TGV house pages. Sibling of layer-grant, backed by
// public.editor_page_grants (tgv.com migration 0135).
//
//   GET  → { ok, grants: [{ memberId, perm }] } — every (member, perm) row.
//          perm is 'edit' (open the house editor + save drafts) or 'publish'
//          (push the edited page live / flip its public eye). Admin+ members
//          never need a row — the editor gates them on members.role; only
//          role='editor' members are admitted via these grants.
//   POST { memberId, perm, granted } → grant (INSERT, granted_by = the
//          operator's member id when resolvable, else NULL) or revoke (DELETE).
//          Idempotent both ways; audit-logged.
//
// Gated by requireAdmin (villagers-route precedent); raw SQL via db.execute()
// (memory feedback_drizzle_turbopack_select_fields).
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

const PERMS = ["edit", "publish"] as const;
type Perm = (typeof PERMS)[number];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT member_id::text AS member_id, perm
    FROM public.editor_page_grants
    ORDER BY created_at DESC
  `);
  const rows =
    (res as unknown as { rows?: { member_id: string; perm: Perm }[] }).rows ??
    [];
  return NextResponse.json({
    ok: true,
    grants: rows.map((r) => ({ memberId: r.member_id, perm: r.perm })),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as
    | { memberId?: string; perm?: string; granted?: boolean }
    | null;
  const memberId = (body?.memberId ?? "").trim();
  const perm = body?.perm as Perm | undefined;
  const granted = body?.granted;
  if (
    !UUID_RE.test(memberId) ||
    !perm ||
    !PERMS.includes(perm) ||
    typeof granted !== "boolean"
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "memberId (uuid) + perm ('edit'|'publish') + granted (boolean) required",
      },
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
        INSERT INTO public.editor_page_grants (member_id, perm, granted_by)
        VALUES (${memberId}, ${perm}, ${grantedBy})
        ON CONFLICT (member_id, perm) DO NOTHING
      `);
    } else {
      await db.execute(sql`
        DELETE FROM public.editor_page_grants
        WHERE member_id = ${memberId} AND perm = ${perm}
      `);
    }
    ok = true;
  } catch {
    // Most likely an unknown member (FK) or a pre-0135 schema — clean error,
    // not a 500 page.
    error = "db_write_failed";
  }

  logHardeningAction({
    action: granted ? "editor.page_grant.grant" : "editor.page_grant.revoke",
    target: memberId,
    user: gate.username,
    success: ok,
    details: { perm, granted, grantedBy, ...(error ? { error } : {}) },
  });

  if (!ok) {
    return NextResponse.json(
      { ok: false, error: error ?? "write_failed" },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, perm, granted });
}
