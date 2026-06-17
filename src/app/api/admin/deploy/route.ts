import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import {
  ClientSpecSchema,
  validateModuleCompatibility,
  getPrice,
} from "@tgv/module-registry";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";

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
      .insert(schema.members)
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
        deployStatus: "pending",
      })
      .returning({ id: schema.members.id });
  } catch (e: unknown) {
    // Map DB-level failures to a clear message — otherwise the wizard just shows a
    // bare "HTTP 500" and the operator can't tell what went wrong. The two unique
    // indexes are members_domain_key (domain) and members_subdomain_env_key (env, subdomain).
    const pg = e as { code?: string; constraint?: string; detail?: string };
    if (pg?.code === "23505") {
      if (pg.constraint === "members_domain_key") {
        return NextResponse.json(
          { ok: false, error: `The domain "${spec.domain}" is already registered to another client. Use a different domain.` },
          { status: 409 },
        );
      }
      if (pg.constraint === "members_subdomain_env_key") {
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

  // TODO Phase 2 Step 4: dispatch to @tgv/deploy-engine with row.id
  console.log("[admin/deploy] persisted member", {
    id: row.id,
    by: gate.username,
    clientName: spec.clientName,
    vertical: spec.vertical,
    tier: spec.tier,
    monthlyUsd: price.monthlyUsd,
    oneTimeUsd: price.oneTimeUsd,
  });

  return NextResponse.json({
    ok: true,
    deployId: row.id,
    status: "pending",
    price,
    note: "Members row persisted. Deploy engine dispatch pending — see Phase 2 Step 4.",
  });
}
