import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ClientSpecSchema,
  validateModuleCompatibility,
  getPrice,
} from "@/lib/registry";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

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
  const deployId = `dep_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // TODO Phase 2 Step 3: persist members row via Drizzle
  // TODO Phase 2 Step 4: dispatch to @tgv/deploy-engine
  console.log("[admin/deploy] accepted spec", {
    deployId,
    by: session.user.name,
    clientName: spec.clientName,
    vertical: spec.vertical,
    tier: spec.tier,
    modules: spec.modules,
    storageGB: spec.storageGB,
    customFlag: spec.customFlag,
    monthlyUsd: price.monthlyUsd,
    oneTimeUsd: price.oneTimeUsd,
  });

  return NextResponse.json({
    ok: true,
    deployId,
    status: "pending",
    price,
    stub: true,
    note: "Deploy engine not yet wired up — this spec was accepted and logged. See Phase 2 Step 4.",
  });
}
