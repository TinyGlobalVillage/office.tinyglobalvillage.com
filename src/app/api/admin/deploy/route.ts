/**
 * The operator's door onto a new village (plan 13b).
 *
 * This route used to write a `villager_sites` row and stop, with a TODO about
 * dispatching to the deploy engine — which read as half-built, and was. Under
 * the pooled model it isn't: one renderer serves every village by hostname, so
 * creating a site IS writing rows. The row registers the tenant; the home page
 * stamp gives the subdomain something to serve. Nothing is composed, nothing is
 * provisioned, nothing is deployed, and the site answers on the wildcard the
 * moment both rows exist.
 *
 * GET  → { templates }  the home templates an operator can start a site with
 * POST → { ok, deployId, price, home }
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  ClientSpecSchema,
  validateModuleCompatibility,
  getPrice,
} from "@tgv/module-registry";
import { listDefaultTemplates } from "@tgv/module-component-library/page-templates";
import { stampHomePage } from "@tgv/module-page-editor/kit/server/siteBirth";
import { db, schema } from "@/lib/db-drizzle";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  return NextResponse.json({
    templates: listDefaultTemplates()
      .filter((t) => t.category === "home")
      .map((t) => ({
        id: t.id,
        label: t.label,
        description: t.description,
        tags: t.tags ?? [],
        sectionCount: t.sections.length,
      })),
  });
}

export async function POST(req: NextRequest) {
  // Member-aware admin gate (the legacy NextAuth auth() was retired 2026-06-05
  // and returns null in prod). requireAdmin also enforces role==="admin".
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ClientSpecSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "validation",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const spec = parsed.data;
  // Not part of ClientSpec — the operator's starting design, carried alongside
  // it. ClientSpecSchema is a plain z.object, so the extra key is stripped from
  // `spec` rather than rejected; read it off the raw body.
  const templateId = (body as { templateId?: unknown })?.templateId;

  const compat = validateModuleCompatibility(spec);
  if (!compat.ok) {
    return NextResponse.json(
      { ok: false, error: compat.reason, offending: compat.offending },
      { status: 400 },
    );
  }

  const price = getPrice(spec);

  // Preview/test lane (the "Admin Wizard" convention): ?env=test marks this member as a test-lane
  // tenant (Stripe TEST + OpenSRS Horizon + *.test subdomains, filtered out of live dashboards,
  // torn down by the teardown button). Defaults to the live lane.
  const env = new URL(req.url).searchParams.get("env") === "test" ? "test" : "live";

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .insert(schema.villagerSites)
      .values({
        env,
        clientName: spec.clientName,
        domain: spec.domain,
        subdomain: spec.subdomain,
        vertical: spec.vertical,
        tier: spec.tier,
        modules: spec.modules,
        storageGb: spec.storageGB,
        customFlag: spec.customFlag,
        customDescription: spec.customDescription,
        contact: spec.contact,
        branding: spec.branding,
        stripeMode: "connect_v2",
        // LIVE, not pending. 'pending' means "waiting for Stripe" on the signup
        // path, and nothing advances it here — an operator-created village would
        // sit pending forever. A *.tinyglobalvillage.com subdomain is instantly
        // routable via wildcard DNS + the renderer's host match, so there is
        // nothing to wait for. Same reasoning as provisionSite() on HQ.
        deployStatus: "live",
        deployedAt: new Date(),
      })
      .returning({ id: schema.villagerSites.id });
  } catch (e: unknown) {
    // Map DB-level failures to a clear message — otherwise the wizard just shows a
    // bare "HTTP 500" and the operator can't tell what went wrong. The two unique
    // indexes are villager_sites_domain_key (domain) and villager_sites_subdomain_env_key (env, subdomain).
    const pg = e as { code?: string; constraint?: string; detail?: string };
    if (pg?.code === "23505") {
      if (pg.constraint === "villager_sites_domain_key") {
        return NextResponse.json(
          { ok: false, error: `The domain "${spec.domain}" is already registered to another client. Use a different domain.` },
          { status: 409 },
        );
      }
      if (pg.constraint === "villager_sites_subdomain_env_key") {
        return NextResponse.json(
          { ok: false, error: `The subdomain "${spec.subdomain}" is already taken in the ${env} lane. Choose a different subdomain.` },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { ok: false, error: "This client conflicts with an existing record (duplicate value)." },
        { status: 409 },
      );
    }
    console.error("[admin/deploy] insert failed", {
      code: pg?.code,
      constraint: pg?.constraint,
      detail: pg?.detail,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { ok: false, error: "Could not save the client — a database error occurred. Check the server logs." },
      { status: 500 },
    );
  }

  if (!row) {
    console.error("[admin/deploy] insert returned no row");
    return NextResponse.json(
      { ok: false, error: "Could not save the client — the database returned no record." },
      { status: 500 },
    );
  }

  // Give the subdomain something to serve. `overwrite: false` — if this name
  // already has a published home page it belongs to a live tenant, and an
  // operator re-submitting the create form must never repaint it. (The version
  // ledger would make that recoverable; it should still not happen silently.)
  //
  // Best-effort, deliberately: the tenant is registered either way, and an
  // operator who sees `home: "exists"` or a stamp error can pick a template from
  // the editor. Failing the whole creation because a starting design didn't
  // apply would be the worse trade.
  let home: "first" | "replaced" | "exists" | "skipped" | "failed" = "skipped";
  if (spec.subdomain) {
    try {
      const stamped = await stampHomePage(pgPool, {
        site: spec.subdomain,
        templateId: typeof templateId === "string" ? templateId : null,
        vertical: spec.vertical,
        actor: gate.username,
      });
      home = stamped.ok ? stamped.version : stamped.reason === "exists" ? "exists" : "failed";
    } catch (e) {
      home = "failed";
      console.error("[admin/deploy] home page stamp failed", {
        subdomain: spec.subdomain,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log("[admin/deploy] created villager site", {
    id: row.id,
    by: gate.username,
    clientName: spec.clientName,
    subdomain: spec.subdomain,
    vertical: spec.vertical,
    tier: spec.tier,
    home,
    monthlyUsd: price.monthlyUsd,
    oneTimeUsd: price.oneTimeUsd,
  });

  return NextResponse.json({
    ok: true,
    deployId: row.id,
    status: "pending",
    price,
    home,
    note:
      home === "first" || home === "replaced"
        ? "Village registered and its home page published — it serves on the wildcard subdomain now."
        : home === "exists"
          ? "Village registered. Its subdomain already had a published home page, which was left alone."
          : home === "skipped"
            ? "Village registered. No subdomain given, so no home page was stamped."
            : "Village registered, but the home page could not be stamped — pick a template from the editor.",
  });
}
