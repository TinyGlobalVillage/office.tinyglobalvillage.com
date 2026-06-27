// GET /api/admin/villagers/support-tickets?memberUserId=<uuid>
//   → { ok, tickets: [{ id, status, subject, openedAt, closedAt, lastMessageAt, messageCount, closedByName }] }
// The per-villager support archive (Office → Villagers → member → Support Tickets). Reads tgv_db
// directly (raw db.execute — support_* aren't in the drizzle schema). requireAdmin. Read-only.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const memberUserId = (new URL(req.url).searchParams.get("memberUserId") ?? "").trim();
  if (!UUID_RE.test(memberUserId)) {
    return NextResponse.json({ ok: false, error: "memberUserId must be a uuid" }, { status: 400 });
  }

  const res = await db.execute(sql`
    SELECT t.id::text AS id, t.status, t.subject, t.opened_at, t.closed_at, t.last_message_at,
           su.name AS closed_by_name,
           (SELECT count(*) FROM public.support_messages m WHERE m.ticket_id = t.id)::int AS message_count
      FROM public.support_tickets t
      LEFT JOIN public.member_users su ON su.id = t.closed_by_member_user_id
     WHERE t.member_user_id = ${memberUserId}
     ORDER BY t.opened_at DESC
  `);
  const rows = (res as unknown as { rows?: Record<string, unknown>[] }).rows ?? [];
  const tickets = rows.map((r) => ({
    id: r.id as string,
    status: r.status as string,
    subject: (r.subject as string | null) ?? null,
    openedAt: r.opened_at ? new Date(r.opened_at as string).toISOString() : null,
    closedAt: r.closed_at ? new Date(r.closed_at as string).toISOString() : null,
    lastMessageAt: r.last_message_at ? new Date(r.last_message_at as string).toISOString() : null,
    messageCount: Number(r.message_count ?? 0),
    closedByName: (r.closed_by_name as string | null) ?? null,
  }));

  return NextResponse.json({ ok: true, tickets, hasTickets: tickets.length > 0 });
}
