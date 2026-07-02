// /api/admin/villagers/member-profile — operator view of ONE member (villager).
//
// GET ?memberUserId=<uuid> → { member, sites, billing }
//   member  = members core (incl. created_at = "Member since")
//   sites   = the member's tenants (member_user_tenants → members) + per-site
//             Yellow Pages founding status (founding is keyed on members.id)
//   billing = member_billing operator-intent row (null until set)
//
// Read-only; raw SQL via db.execute() (cross-bundle is(Column) — memory
// feedback_drizzle_turbopack_select_fields). Billing is WRITTEN by the sibling
// member-billing route; founding is toggled via /api/admin/members/founding.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MemberRow = {
  id: string;
  email: string;
  name: string | null;
  role: string | null;
  username: string | null;
  created_at: string | Date;
  last_login_at: string | Date | null;
};
type SiteRow = {
  id: string;
  client_name: string | null;
  domain: string | null;
  tier: string | null;
  deploy_status: string | null;
  junction_role: string | null;
  junction_status: string | null;
  founding_active: boolean;
};
type BillingRow = {
  plan_interval: string | null;
  charge_start_at: string | Date | null;
  custom_amount_cents: number | null;
  waiver_until: string | Date | null;
  notify_to_pay: boolean;
  updated_at: string | Date | null;
  updated_by: string | null;
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const memberUserId = (
    new URL(req.url).searchParams.get("memberUserId") ?? ""
  ).trim();
  if (!UUID_RE.test(memberUserId)) {
    return NextResponse.json(
      { ok: false, error: "memberUserId must be a uuid" },
      { status: 400 },
    );
  }

  const memberRes = await db.execute(sql`
    SELECT id::text AS id, email, name, role, username, created_at, last_login_at
    FROM public.members
    WHERE id = ${memberUserId}
  `);
  const member =
    ((memberRes as unknown as { rows?: MemberRow[] }).rows ?? [])[0] ?? null;
  if (!member) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const sitesRes = await db.execute(sql`
    SELECT m.id::text                                        AS id,
           m.client_name                                     AS client_name,
           m.domain                                          AS domain,
           m.tier                                            AS tier,
           m.deploy_status                                   AS deploy_status,
           j.role                                            AS junction_role,
           j.status                                          AS junction_status,
           (f.member_id IS NOT NULL AND f.revoked_at IS NULL) AS founding_active
    FROM public.member_user_tenants j
    JOIN public.villager_sites m ON m.id = j.site_id
    LEFT JOIN public.yellow_pages_founding_members f ON f.member_id = m.id
    WHERE j.member_user_id = ${memberUserId}
    ORDER BY m.created_at ASC
  `);
  const sites = (sitesRes as unknown as { rows?: SiteRow[] }).rows ?? [];

  const billingRes = await db.execute(sql`
    SELECT plan_interval, charge_start_at, custom_amount_cents,
           waiver_until, notify_to_pay, updated_at, updated_by
    FROM public.member_billing
    WHERE member_user_id = ${memberUserId}
  `);
  const billing =
    ((billingRes as unknown as { rows?: BillingRow[] }).rows ?? [])[0] ?? null;

  return NextResponse.json({ ok: true, member, sites, billing });
}
