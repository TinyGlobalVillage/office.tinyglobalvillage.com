// Platform-canon funnel templates — the list, and the making of a new one.
//
// GET returns everything the Product Funnels desk needs in ONE round trip: the
// canon rows (archived included — a desk that hid what it archived would leave no
// way back), the fleet the audience gear ticks, and the built-in starter shapes
// the "New funnel" menu offers.
//
// POST creates a canon row. It is born offered to NOBODY unless the caller says
// otherwise: gates are Gio's to flip, and a shape must never reach eleven stores'
// pickers merely because somebody clicked Save.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import {
  listCanonFunnelTemplates,
  createCanonFunnelTemplate,
  canonFunnelTemplates,
} from "@tgv/module-storefront/server/funnels";
import { funnelDb, readFleet, adminOnly, fail } from "@/lib/storefront/canon-funnels";

export async function GET(req: NextRequest) {
  const gate = await adminOnly(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const [templates, tenants] = await Promise.all([
      listCanonFunnelTemplates(funnelDb),
      readFleet(),
    ]);
    return NextResponse.json({ templates, tenants, starters: canonFunnelTemplates() });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const gate = await adminOnly(req);
  if (gate instanceof NextResponse) return gate;
  const body = await req.json().catch(() => ({}));
  try {
    const template = await createCanonFunnelTemplate(funnelDb, {
      name: String(body.name ?? "").trim() || "Untitled funnel",
      description: typeof body.description === "string" ? body.description : null,
      stages: Array.isArray(body.stages) ? body.stages : null,
      status: body.status === "archived" ? "archived" : "active",
      // Absent means fleet-wide in the module's update verb, so the desk sends
      // [] explicitly for a new row. Honour whatever it sent.
      audience: Array.isArray(body.audience) ? body.audience.map(String) : null,
    });
    return NextResponse.json({ template });
  } catch (e) {
    return fail(e);
  }
}
