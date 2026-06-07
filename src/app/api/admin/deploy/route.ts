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

  const [row] = await db
    .insert(schema.members)
    .values({
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
