// GET the "Applies to" target catalog (wizard subscription plans + add-ons, with their Stripe
// product ids) for the Discount Codes modal. HQ's /api/wizard/{plans,addons} are public reads, so
// this only needs the operator gate + a merge — no internal secret. Operator-only (requireAdmin).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tgvBase(): string {
  return (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const [pj, aj] = await Promise.all([
      fetch(`${tgvBase()}/api/wizard/plans`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ plans: [] })),
      fetch(`${tgvBase()}/api/wizard/addons`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ addons: [] })),
    ]);
    const targets: { productId: string; label: string; group: string }[] = [];
    for (const p of pj.plans ?? []) {
      if (p.stripeProductId)
        targets.push({ productId: p.stripeProductId, label: p.name, group: "Subscriptions" });
    }
    for (const a of aj.addons ?? []) {
      if (a.stripeProductId)
        targets.push({ productId: a.stripeProductId, label: a.name, group: "Add-ons" });
    }
    return NextResponse.json({ targets });
  } catch {
    return NextResponse.json({ targets: [] });
  }
}
