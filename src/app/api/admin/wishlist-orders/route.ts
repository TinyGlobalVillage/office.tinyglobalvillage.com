// /api/admin/wishlist-orders — the fulfilment queue for wishlist "Add to cart" purchases (Gio 2026-11-23,
// @tgv/module-wishlist): a visitor paid TGV for an item on someone's wishlist; staff order it from the
// store and ship it to the list owner.
//
//   GET   every paid TGV order, newest first, with what to buy (item, store link, quantity, price paid).
//   POST  { id, status: new|ordered|shipped|done, tracking?, note? }   move an order along.
//
// Reads tgv_db DIRECTLY (wishlist_* tables granted to tgv_app by tgv.com 0278). The ship-to address is
// sealed with tgv.com's key, so it is opened on tgv.com: each row links to /api/admin/wishlist-order
// there (TGV admins). STAFF ONLY (requireStaff); every move writes an admin_audit_log row.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireStaff } from "@/lib/api-staff";
import { resolveAdminActorId } from "@/lib/admin-actor";
import { db, schema } from "@/lib/db-drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tgvBase = () => (process.env.TGV_BASE_URL ?? "https://tinyglobalvillage.com").replace(/\/$/, "");
const STATUSES = ["new", "ordered", "shipped", "done"] as const;
type Status = (typeof STATUSES)[number];

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req);
  if (gate instanceof NextResponse) return gate;
  try {
    const rows = (
      await db.execute(sql`
        select c.id, c.quantity, c.amount_cents, c.fee_cents, c.currency, c.env, c.fulfil_status, c.tracking_number, c.staff_note,
               c.purchased_at, c.buyer_name, c.buyer_email, c.note,
               i.name as item, i.source_url, i.store_name, i.image_url,
               w.title as list_title, w.slug as list_slug, m.name as owner_name, m.email as owner_email
          from public.wishlist_claims c
          join public.wishlist_items i on i.id = c.item_id
          join public.wishlists w on w.id = c.wishlist_id
          join public.members m on m.id = w.member_id
         where c.kind = 'tgv' and c.status = 'purchased'
         order by (c.fulfil_status = 'done'), c.purchased_at desc
         limit 300`)
    ).rows as Record<string, unknown>[];
    const base = tgvBase();
    const orders = rows.map((r) => ({
      id: String(r.id),
      status: (r.fulfil_status as Status) ?? "new",
      quantity: Number(r.quantity),
      amountCents: Number(r.amount_cents),
      feeCents: Number(r.fee_cents),
      currency: String(r.currency),
      test: r.env === "test",
      tracking: (r.tracking_number as string) ?? "",
      staffNote: String(r.staff_note ?? ""),
      purchasedAt: r.purchased_at ? new Date(r.purchased_at as string).toISOString() : null,
      buyer: { name: String(r.buyer_name ?? ""), email: String(r.buyer_email ?? ""), note: String(r.note ?? "") },
      item: { name: String(r.item), sourceUrl: (r.source_url as string) ?? null, store: String(r.store_name ?? ""), imageUrl: (r.image_url as string) ?? null },
      list: { title: String(r.list_title), url: `${base}/en/wishlist/${r.list_slug}` },
      owner: { name: String(r.owner_name ?? ""), email: String(r.owner_email ?? "") },
      addressUrl: `${base}/api/admin/wishlist-order?id=${r.id}`,
    }));
    const count = (s: Status) => orders.filter((o) => o.status === s).length;
    return NextResponse.json({ orders, totals: { new: count("new"), ordered: count("ordered"), shipped: count("shipped"), done: count("done") } });
  } catch (e) {
    return NextResponse.json({ error: "read_failed", detail: String((e as Error)?.message ?? e).slice(0, 300) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req);
  if (gate instanceof NextResponse) return gate;
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown; tracking?: unknown; note?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id) ? body.id : null;
  const status = STATUSES.find((s) => s === body?.status) ?? null;
  if (!id || !status) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const tracking = typeof body?.tracking === "string" ? body.tracking.trim().slice(0, 120) || null : null;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";

  const actorUserId = await resolveAdminActorId(gate.username);
  if (!actorUserId) return NextResponse.json({ error: "no_actor_for_audit" }, { status: 500 });
  const before = (await db.execute(sql`select fulfil_status, tracking_number, staff_note from public.wishlist_claims where id = ${id}::uuid and kind = 'tgv' and status = 'purchased'`)).rows[0];
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const after = (
    await db.execute(sql`update public.wishlist_claims set fulfil_status = ${status}, tracking_number = ${tracking}, staff_note = ${note}, updated_at = now()
                          where id = ${id}::uuid returning fulfil_status, tracking_number, staff_note`)
  ).rows[0];
  await db.insert(schema.adminAuditLog).values({
    actorUserId,
    action: "wishlist.order_status",
    targetType: "wishlist_claim",
    targetId: id,
    before: before as Record<string, unknown>,
    after: after as Record<string, unknown>,
    note: `Wishlist order → ${status} — by ${gate.username}`,
  });
  return NextResponse.json({ ok: true });
}
