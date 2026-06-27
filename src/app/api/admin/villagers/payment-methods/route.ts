// /api/admin/villagers/payment-methods — operator view of a member's saved cards.
//
// GET ?memberUserId=<uuid>
//   → { ok, cards: [{ id, brand, last4, expMonth, expYear, cardholderName, isDefault }], hasCards }
//
// Resolves the platform member → legacy card store entirely inside tgv_db:
//   public.member_users.email  →  public.users (email bridge)  →  public.payment_methods
// (the same email bridge the HQ members modal uses; payment_methods is keyed on the
// legacy users.id, not member_users.id).
//
// DISPLAY ONLY: brand + last4 are all that exist (full PAN is never stored). No money
// moves here — charging a saved card is a separate, explicitly-gated operator action.
// Read-only; raw SQL via db.execute() (cross-bundle is(Column) — memory
// feedback_drizzle_turbopack_select_fields). requireAdmin guards it.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CardRow = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  cardholder_name: string | null;
  is_default: boolean;
};

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const memberUserId = (
    new URL(req.url).searchParams.get("memberUserId") ?? ""
  ).trim();
  if (!UUID_RE.test(memberUserId)) {
    return NextResponse.json(
      { ok: false, error: "memberUserId must be a uuid" },
      { status: 400 },
    );
  }

  const res = await db.execute(sql`
    SELECT pm.id::text        AS id,
           pm.brand           AS brand,
           pm.last4           AS last4,
           pm.exp_month       AS exp_month,
           pm.exp_year        AS exp_year,
           pm.cardholder_name AS cardholder_name,
           pm.is_default      AS is_default
    FROM public.member_users mu
    JOIN public.users u            ON lower(u.email) = lower(mu.email)
    JOIN public.payment_methods pm ON pm.user_id = u.id
    WHERE mu.id = ${memberUserId}
    ORDER BY pm.is_default DESC, pm.created_at ASC
  `);
  const rows = (res as unknown as { rows?: CardRow[] }).rows ?? [];
  const cards = rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    last4: r.last4,
    expMonth: r.exp_month,
    expYear: r.exp_year,
    cardholderName: r.cardholder_name,
    isDefault: r.is_default,
  }));

  return NextResponse.json({ ok: true, cards, hasCards: cards.length > 0 });
}
