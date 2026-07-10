// /api/admin/villagers/onboard-plans — plans + addons for the Onboard Villager
// modal's intent section (Office reads platform_products/platform_addons from
// the shared tgv_db directly, villagers pattern). INTENT ONLY: the operator
// records the choice; the member completes checkout from their own dashboard.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const rowsOf = (r: unknown): Record<string, unknown>[] =>
  ((r as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const plans = await db.execute(sql`
    SELECT id, name, description, unit_amount, unit_amount_yearly, currency
      FROM public.platform_products
     WHERE active = true AND env = 'live'
     ORDER BY sort ASC, name ASC`);
  const addons = await db.execute(sql`
    SELECT id, key, name, description, monthly_amount_cents, lifetime_amount_cents, max_quantity
      FROM public.platform_addons
     WHERE active = true AND env = 'live'
     ORDER BY sort ASC, name ASC`);

  return NextResponse.json({
    plans: rowsOf(plans),
    addons: rowsOf(addons),
  });
}
