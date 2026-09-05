// GET /api/admin/commerce-readiness — Office side of the fleet readiness view
// (checklist #8). Pure read-through: requireAdmin gates the operator, then the
// internal-secret seam asks tgv.com's /api/internal/store-readiness, where the
// ONE readiness computer (computeStoreReadiness) audits every tenant. Office
// adds nothing to the data on purpose — the shape is HQ's, per the handoff.
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

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return NextResponse.json({ error: "internal_secret_unconfigured" }, { status: 503 });

  let res: Response;
  try {
    res = await fetch(`${tgvBase()}/api/internal/store-readiness`, {
      headers: { "x-internal-secret": secret },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "tgv_unreachable" }, { status: 502 });
  }

  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
