// Product Funnels wiring for the Office Modules tile — PLATFORM CANON, admin-gated.
//
// Gio 2026-09-01: the funnel guide "belongs on its own modal on module storefront
// on office as product funnels", and that modal "manages the platform-canon funnel
// templates". Those are the storefront_funnel_templates rows with seller_site_id
// NULL: the shapes every tenant store is offered as a starting point.
//
// Same shape as src/lib/email-campaigns/deps.ts — Office's integration pattern is a
// direct DB write behind requireAdmin, never a cross-origin POST to tgv.com (an
// Office session carries no tgv.com passkey cookie, so such a call would 401).
//
// The module's canon verbs check nothing about the caller by design. THIS file is
// the gate.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db-drizzle";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";

export { db as funnelDb };

/** The fleet, alphabetized — the one comparator every TGV switcher sorts by.
 *  Deliberately the SAME query the email audience runs (module-email-campaigns
 *  server/routes readFleet): two surfaces asking "which tenants?" must not
 *  answer with two different lists. */
export type FleetTenant = {
  id: string;
  name: string;
  domain: string | null;
  deployStatus: string | null;
};

export async function readFleet(): Promise<FleetTenant[]> {
  const { rows } = await pgPool.query(
    `SELECT id,
            COALESCE(NULLIF(client_name,''), NULLIF(domain,''), NULLIF(subdomain,''), 'Tenant') AS name,
            NULLIF(domain,'') AS domain,
            deploy_status
       FROM villager_sites
      ORDER BY COALESCE(NULLIF(client_name,''), NULLIF(domain,''), NULLIF(subdomain,''), 'Tenant') ASC
      LIMIT 2000`,
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    domain: (r.domain as string | null) ?? null,
    deployStatus: (r.deploy_status as string | null) ?? null,
  }));
}

/** Operator gate. Returns the username, or a NextResponse to return as-is. */
export async function adminOnly(req: NextRequest): Promise<string | NextResponse> {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return gate.username;
}

export const fail = (e: unknown, status = 400) =>
  NextResponse.json(
    { error: e instanceof Error ? e.message : "funnel_templates_failed" },
    { status },
  );
