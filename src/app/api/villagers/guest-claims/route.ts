// /api/villagers/guest-claims — operator surface for the guest→member claim
// path (F20).
//
//   GET  → guest customers (customer_member_id IS NULL) + last-claim status,
//          read straight off the shared tables (invitations-tile precedent).
//   POST → issue + email a claim link via tgv.com's internal endpoint
//          (tgv.com owns the claim engine + branded mail transport).
//
// Gated by requireAdmin; issuance is audit-logged.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";
import { logHardeningAction } from "@/lib/audit-log";
import { resolveAdminActorId } from "@/lib/admin-actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TGV_ORIGIN = "https://tinyglobalvillage.com";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const rows = await db.execute(sql`
    SELECT c.id, c.status, c.first_purchase_at, c.created_at,
           vs.domain AS seller_domain,
           gc.created_at AS last_claim_sent_at,
           gc.claimed_at
      FROM customers c
      LEFT JOIN villager_sites vs ON vs.id = c.seller_site_id
      LEFT JOIN LATERAL (
        SELECT created_at, claimed_at FROM guest_claims
         WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1
      ) gc ON true
     WHERE c.customer_member_id IS NULL
     ORDER BY c.created_at DESC
     LIMIT 200`);
  return NextResponse.json({ guests: rows.rows });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as
    | { customerId?: string; email?: string }
    | null;
  const customerId = body?.customerId?.trim();
  const email = body?.email?.trim().toLowerCase();
  if (!customerId || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "customerId + valid email required" }, { status: 400 });
  }

  const createdBy = await resolveAdminActorId(gate.username);
  let ok = false;
  let error: string | null = null;
  try {
    const res = await fetch(`${TGV_ORIGIN}/api/internal/send-guest-claim/`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-secret": process.env.INTERNAL_API_SECRET ?? "",
      },
      body: JSON.stringify({ customerId, email, createdBy }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    ok = res.ok && data.ok === true;
    if (!ok) error = data.error ?? `http_${res.status}`;
  } catch {
    error = "tgv_unreachable";
  }

  logHardeningAction({
    action: "guest-claim.issue",
    target: customerId,
    user: gate.username,
    success: ok,
    details: { email, ...(error ? { error } : {}) },
  });

  if (!ok) return NextResponse.json({ error: error ?? "issue_failed" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
