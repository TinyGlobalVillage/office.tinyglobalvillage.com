// /api/admin/villagers/staff-owner-revoke — end the TGV editing service
// (customization retainer, checklist #14) for ONE staff member on ONE site.
//
// POST { memberId, siteId } → true DELETE of the staffer's owner-equivalent
// `villager` row (Gio 2026-08-31 ruling: a revoked retainer leaves NO
// membership behind — demoteToCustomer moves the row to villager_clients and
// is wrong here). Guards:
//   · the member must be TGV staff (email in the Office roster) — this route
//     never deletes a real customer's ownership
//   · never the site's LAST owner (that would orphan the site)
// Re-granting after a revoke is NOT this surface's job: it must walk the 2-way
// dashboard_link consent protocol (staffer requests, owner approves + OTP) —
// the adminAuditLog row written here is the durable marker of the revoke.
// layer-grant idiom: requireAdmin + resolveAdminActorId + audit; raw SQL via
// db.execute() (memory feedback_drizzle_turbopack_select_fields).
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { readRoster } from "@/lib/member-auth/bridge";
import { db, schema } from "@/lib/db-drizzle";
import { logHardeningAction } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as
    | { memberId?: string; siteId?: string }
    | null;
  const memberId = (body?.memberId ?? "").trim();
  const siteId = (body?.siteId ?? "").trim();
  if (!UUID_RE.test(memberId) || !UUID_RE.test(siteId)) {
    return NextResponse.json(
      { ok: false, error: "memberId + siteId (uuids) required" },
      { status: 400 },
    );
  }

  const actorId = await resolveAdminActorId(gate.username);
  if (!actorId) {
    return NextResponse.json({ ok: false, error: "no_actor_for_audit" }, { status: 500 });
  }

  // Guard 1: only TGV staff lose rows here. The roster is the authority on who
  // is staff; a customer's owner row is untouchable by this route.
  const memberRes = await db.execute(sql`
    SELECT email FROM public.members WHERE id = ${memberId} LIMIT 1`);
  const memberEmail =
    ((memberRes as unknown as { rows?: { email: string | null }[] }).rows ?? [])[0]?.email ?? null;
  if (!memberEmail) {
    return NextResponse.json({ ok: false, error: "member_not_found" }, { status: 404 });
  }
  const rosterEmails = new Set(
    Object.values(readRoster()).map((r) => r.email.toLowerCase()),
  );
  if (!rosterEmails.has(memberEmail.toLowerCase())) {
    return NextResponse.json(
      { ok: false, error: "not_tgv_staff — this revoke only removes TGV staff access" },
      { status: 403 },
    );
  }

  // Guard 2: never delete the site's last owner. The client's own row must
  // survive; if the staffer IS the only owner, something upstream is wrong.
  const ownersRes = await db.execute(sql`
    SELECT count(*)::int AS n FROM public.villager WHERE site_id = ${siteId}`);
  const owners = Number(
    ((ownersRes as unknown as { rows?: { n: number }[] }).rows ?? [])[0]?.n ?? 0,
  );
  if (owners <= 1) {
    return NextResponse.json(
      { ok: false, error: "last_owner — removing this row would orphan the site" },
      { status: 409 },
    );
  }

  let deleted = 0;
  let error: string | null = null;
  try {
    const del = await db.execute(sql`
      DELETE FROM public.villager
       WHERE member_id = ${memberId} AND site_id = ${siteId}`);
    deleted = Number((del as unknown as { rowCount?: number }).rowCount ?? 0);
    // Switcher pref row goes with it, so the staffer's dashboard drops the site
    // instead of showing a ghost. Best-effort.
    await db.execute(sql`
      DELETE FROM public.member_site_prefs
       WHERE member_id = ${memberId} AND site_id = ${siteId}`).catch(() => {});
  } catch {
    error = "db_write_failed";
  }

  // Durable revoke marker (adminAuditLog) — the record a future grant path
  // checks before allowing anything but the consent-gated re-grant.
  if (!error && deleted > 0) {
    try {
      await db.insert(schema.adminAuditLog).values({
        actorUserId: actorId,
        action: "staff_owner.revoked_from_office",
        targetType: "member_user",
        targetId: memberId,
        before: { siteId, role: "owner", staffEmail: memberEmail },
        after: {},
        note: `TGV editing service revoked (site ${siteId}) by ${gate.username}`,
      });
    } catch (e) {
      console.error("[staff-owner-revoke] audit insert failed (non-fatal)", e);
    }
  }

  logHardeningAction({
    action: "staff_owner.revoke",
    target: `${memberId}:${siteId}`,
    user: gate.username,
    success: !error && deleted > 0,
    details: { staffEmail: memberEmail, deleted, ...(error ? { error } : {}) },
  });

  if (error) {
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
  if (deleted === 0) {
    return NextResponse.json(
      { ok: false, error: "no_owner_row — the member has no owner access on this site" },
      { status: 404 },
    );
  }
  return NextResponse.json({ ok: true, deleted });
}
