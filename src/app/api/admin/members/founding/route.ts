// /api/admin/members/founding — Yellow Pages founding-members master toggle.
//
// Founding members (SCOPE.md §2 of @tgv/module-yellow-pages) hold UNLIMITED
// listings at billing='founding' — the billing run only ever charges 'token'.
// This is the PLATFORM-side (tgv_app) Office surface; tenant roles can only
// READ their own status via RLS.
//
// GET  → union of every known member that could be toggled:
//        (a) yellow_pages_founding_members rows  (source 'founding')
//        (b) yellow_pages_role_bindings rows     (source 'site' — known tenant Sites)
//        (c) public.villager_sites rows           (source 'tenant' — platform deployments)
//        each as { member_id, label, source, active, revoked_at }.
// POST { memberId, on, label?, note? } → mirrors applyFoundingToggle() in
//        @tgv/module-yellow-pages/server/founding.ts (any change there MUST be
//        applied here too — the engine carries the same warning):
//        ON  = upsert + un-revoke + promote the member's 'token' listings to 'founding'
//        OFF = stamp revoked_at + demote 'founding' listings back to 'token',
//              then restore the one-free entitlement if the member ended up
//              with no 'free' listing (members founding since before their
//              first create never got a 'free' row). Writes admin_audit_log.
//
// Office cannot import @tgv/module-yellow-pages server code (and tables from
// @tgv packages trip the cross-bundle is(Column) check — see memory
// feedback_drizzle_turbopack_select_fields), so the yellow_pages_* statements
// are raw SQL via db.execute().
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db, schema } from "@/lib/db-drizzle";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";

type FoundingRow = {
  member_id: string;
  label: string;
  source: "founding" | "site" | "tenant";
  active: boolean;
  revoked_at: Date | string | null;
};

export async function GET(req: NextRequest) {
  // Member-aware admin gate (the legacy NextAuth auth() was retired 2026-06-05
  // and returns null in prod). requireAdmin also enforces role==="admin".
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const res = await db.execute(sql`
    SELECT f.member_id::text       AS member_id,
           f.label                 AS label,
           'founding'::text        AS source,
           (f.revoked_at IS NULL)  AS active,
           f.revoked_at            AS revoked_at
    FROM public.yellow_pages_founding_members f
    UNION ALL
    SELECT b.member_id::text,
           regexp_replace(b.role_name, '_app$', ''),
           'site'::text,
           false,
           NULL::timestamptz
    FROM public.yellow_pages_role_bindings b
    WHERE NOT EXISTS (
      SELECT 1 FROM public.yellow_pages_founding_members f
      WHERE f.member_id = b.member_id
    )
    UNION ALL
    SELECT m.id::text,
           m.client_name || ' — ' || m.domain,
           'tenant'::text,
           false,
           NULL::timestamptz
    FROM public.villager_sites m
    WHERE NOT EXISTS (
      SELECT 1 FROM public.yellow_pages_founding_members f
      WHERE f.member_id = m.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.yellow_pages_role_bindings b
      WHERE b.member_id = m.id
    )
    ORDER BY source ASC, label ASC
  `);
  // node-postgres returns a QueryResult — normalize to the bare rows array.
  const rows = (res as unknown as { rows?: FoundingRow[] }).rows ?? [];
  return NextResponse.json({ ok: true, rows });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
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

  let body: { memberId?: string; on?: boolean; label?: string; note?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }
  const memberId = (body.memberId ?? "").trim();
  const on = body.on;
  if (!memberId || typeof on !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "memberId and on (boolean) are required" },
      { status: 400 },
    );
  }
  if (!UUID_RE.test(memberId)) {
    return NextResponse.json(
      { ok: false, error: "memberId must be a uuid" },
      { status: 400 },
    );
  }
  const label =
    typeof body.label === "string" && body.label.trim() ? body.label.trim() : null;
  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const result = await db.transaction(async (tx) => {
    // Previous state for the audit `before` jsonb.
    const prevRes = await tx.execute(sql`
      SELECT revoked_at FROM public.yellow_pages_founding_members
      WHERE member_id = ${memberId}
    `);
    const prevRows =
      (prevRes as unknown as { rows?: { revoked_at: unknown }[] }).rows ?? [];
    const prevActive = prevRows.length > 0 && prevRows[0].revoked_at === null;

    if (on) {
      const insRes = await tx.execute(sql`
        INSERT INTO public.yellow_pages_founding_members (member_id, label, note, created_by)
        VALUES (${memberId}, ${label ?? "founding member"}, ${note}, ${gate.username})
        ON CONFLICT (member_id) DO UPDATE SET
          revoked_at = NULL,
          label = COALESCE(${label}, public.yellow_pages_founding_members.label),
          note = COALESCE(${note}, public.yellow_pages_founding_members.note)
        RETURNING label
      `);
      const newLabel =
        ((insRes as unknown as { rows?: { label: string }[] }).rows ?? [])[0]
          ?.label ??
        label ??
        "founding member";
      await tx.execute(sql`
        UPDATE public.yellow_pages_listings
        SET billing = 'founding', updated_at = now()
        WHERE member_id = ${memberId} AND billing = 'token'
      `);
      await tx.insert(schema.adminAuditLog).values({
        actorUserId,
        action: "yellow_pages.set_founding_member",
        targetType: "yp_member",
        targetId: memberId,
        before: { active: prevActive },
        after: { active: true, label: newLabel },
        note: `Founding toggle ON by Office admin ${gate.username}`,
      });
      return { ok: true as const, active: true };
    }

    const updRes = await tx.execute(sql`
      UPDATE public.yellow_pages_founding_members
      SET revoked_at = now()
      WHERE member_id = ${memberId} AND revoked_at IS NULL
      RETURNING label
    `);
    const updRows =
      (updRes as unknown as { rows?: { label: string }[] }).rows ?? [];
    if (updRows.length === 0) {
      return { ok: false as const, reason: "not_founding" as const };
    }
    await tx.execute(sql`
      UPDATE public.yellow_pages_listings
      SET billing = 'token', updated_at = now()
      WHERE member_id = ${memberId} AND billing = 'founding'
    `);
    // Every member keeps ONE free listing: if the demote left them with none
    // (founding since before their first create → all rows were 'founding'),
    // promote the oldest. yp_listings_one_free_per_member backstops the race.
    await tx.execute(sql`
      UPDATE public.yellow_pages_listings
      SET billing = 'free', updated_at = now()
      WHERE id = (
        SELECT id FROM public.yellow_pages_listings
        WHERE member_id = ${memberId} AND billing = 'token'
        ORDER BY created_at ASC LIMIT 1)
      AND NOT EXISTS (
        SELECT 1 FROM public.yellow_pages_listings
        WHERE member_id = ${memberId} AND billing = 'free')
    `);
    await tx.insert(schema.adminAuditLog).values({
      actorUserId,
      action: "yellow_pages.set_founding_member",
      targetType: "yp_member",
      targetId: memberId,
      before: { active: prevActive },
      after: { active: false, label: updRows[0].label },
      note: `Founding toggle OFF by Office admin ${gate.username}`,
    });
    return { ok: true as const, active: false };
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
