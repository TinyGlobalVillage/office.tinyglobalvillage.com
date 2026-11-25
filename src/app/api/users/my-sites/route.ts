// GET /api/users/my-sites — the sites the signed-in staff member is connected to
// (owner or staff), each with the link that opens its dashboard. Feeds the site
// switcher at the top of the balloon menu. Office itself is never listed. POST stars the default.
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { pgPool } from "@/lib/pg-pool";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db } from "@/lib/db-drizzle";
import { officeMemberAuth } from "@/lib/member-auth/config";
import { computeEntitlements } from "@tgv/module-auth/auth/member-auth/appAccess";

/** The TGV app modes this member may switch into (same check as tgv.com /api/app/sites). */
async function appModes(): Promise<string[]> {
  try {
    const s = await officeMemberAuth.getActiveSession();
    if (!s) return [];
    const e = await computeEntitlements(db, { id: s.userId, role: s.user.role });
    return e.modes.filter((m) => m !== "music");
  } catch {
    return [];
  }
}

export const dynamic = "force-dynamic";

const HQ_ORIGIN = process.env.TGV_PUBLIC_ORIGIN ?? "https://tinyglobalvillage.com";
const HQ_HOST = new URL(HQ_ORIGIN).host.toLowerCase();

type Row = { site_id: string; subdomain: string | null; name: string; domain: string | null; is_platform_home: boolean };

async function listSites(memberId: string, own: string) {
  const { rows } = await pgPool.query<Row>(
    `SELECT DISTINCT m.id AS site_id, m.subdomain,
            COALESCE(NULLIF(m.client_name,''), NULLIF(m.subdomain,''), 'Site') AS name,
            m.domain, COALESCE(m.is_platform_home, false) AS is_platform_home
       FROM (SELECT member_id, site_id, status FROM villager
             UNION ALL
             SELECT member_id, site_id, status FROM villager_clients WHERE is_staff) mut
       JOIN villager_sites m ON m.id = mut.site_id
      WHERE mut.member_id = $1 AND mut.status IN ('registered','active')`,
    [memberId],
  );
  const sites = rows
    .filter((r) => (r.domain ?? "").trim().toLowerCase() !== own)
    .map((r) => {
      const dom = (r.domain ?? "").trim().toLowerCase();
      const hq = r.is_platform_home || dom === HQ_HOST;
      const href = hq
        ? `${HQ_ORIGIN}/api/sites/go?site=hq`
        : dom
          ? `https://${dom}/en/dashboard`
          : `${HQ_ORIGIN}/api/sites/go?site=${encodeURIComponent(r.site_id)}`;
      return { id: r.site_id, label: hq ? "TGV Dashboard" : dom || r.name, href, hq };
    });
  if (!sites.some((s) => s.hq)) sites.push({ id: "hq", label: "TGV Dashboard", href: `${HQ_ORIGIN}/api/sites/go?site=hq`, hq: true });
  sites.sort((a, b) => (a.hq === b.hq ? a.label.localeCompare(b.label) : a.hq ? -1 : 1));
  return sites;
}

export async function GET(req: NextRequest) {
  const t = await requireAuth(req);
  if (!t?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberId = await resolveAdminActorId(t.username);
  if (!memberId) return NextResponse.json({ sites: [], defaultSiteId: null });
  try {
    const [sites, pref, modes] = await Promise.all([
      listSites(memberId, req.nextUrl.host.toLowerCase()),
      pgPool.query<{ default_site_id: string | null }>(`SELECT default_site_id FROM member_app_prefs WHERE member_id = $1`, [memberId]).catch(() => ({ rows: [] })),
      appModes(),
    ]);
    return NextResponse.json({ sites, defaultSiteId: pref.rows[0]?.default_site_id ?? null, appModes: modes });
  } catch {
    return NextResponse.json({ sites: [], defaultSiteId: null });
  }
}

// POST {defaultSiteId: string|null} — star (or clear) the site that opens at sign-in. Same pref the
// TGV app's Home screen writes (member_app_prefs); only one of this member's own sites is accepted.
export async function POST(req: NextRequest) {
  const t = await requireAuth(req);
  if (!t?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberId = await resolveAdminActorId(t.username);
  if (!memberId) return NextResponse.json({ error: "no member" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { defaultSiteId?: unknown };
  const siteId = typeof body.defaultSiteId === "string" && body.defaultSiteId ? body.defaultSiteId : null;
  try {
    if (siteId) {
      const mine = await listSites(memberId, req.nextUrl.host.toLowerCase());
      if (!mine.some((x) => x.id === siteId && x.id !== "hq")) return NextResponse.json({ error: "not one of your sites" }, { status: 400 });
    }
    await pgPool.query(
      `INSERT INTO member_app_prefs (member_id, default_site_id, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (member_id) DO UPDATE SET default_site_id = EXCLUDED.default_site_id, updated_at = now()`,
      [memberId, siteId],
    );
    return NextResponse.json({ ok: true, defaultSiteId: siteId });
  } catch {
    return NextResponse.json({ error: "save failed" }, { status: 500 });
  }
}
