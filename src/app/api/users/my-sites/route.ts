// GET /api/users/my-sites — the sites the signed-in staff member is connected to
// (owner or staff), each with the link that opens its dashboard. Feeds the site
// switcher at the top of the balloon menu. Office itself is never listed.
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { pgPool } from "@/lib/pg-pool";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const dynamic = "force-dynamic";

const HQ_ORIGIN = process.env.TGV_PUBLIC_ORIGIN ?? "https://tinyglobalvillage.com";
const HQ_HOST = new URL(HQ_ORIGIN).host.toLowerCase();

type Row = { site_id: string; subdomain: string | null; name: string; domain: string | null; is_platform_home: boolean };

export async function GET(req: NextRequest) {
  const t = await requireAuth(req);
  if (!t?.username) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const memberId = await resolveAdminActorId(t.username);
  if (!memberId) return NextResponse.json({ sites: [] });
  const own = req.nextUrl.host.toLowerCase();
  try {
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
    return NextResponse.json({ sites });
  } catch {
    return NextResponse.json({ sites: [] });
  }
}
