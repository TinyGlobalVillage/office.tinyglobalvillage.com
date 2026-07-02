// GET /api/admin/villagers/support-ticket/[id]
//   → { ok, ticket, messages } — the full sealed conversation, WITH the real staff author per message
//     (Office is the quality/training surface). Read-only. requireAdmin. Reads tgv_db directly.
import { type NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const rows = (r: unknown) => ((r as { rows?: Record<string, unknown>[] }).rows ?? []) as Record<string, unknown>[];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "id must be a uuid" }, { status: 400 });
  }

  const tr = await db.execute(sql`
    SELECT t.id::text AS id, t.status, t.subject, t.requester_name, t.requester_email,
           t.opened_at, t.closed_at, asg.name AS assigned_name
      FROM public.support_tickets t
      LEFT JOIN public.members asg ON asg.id = t.assigned_staff_member_user_id
     WHERE t.id = ${id} LIMIT 1`);
  const t = rows(tr)[0];
  if (!t) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const mr = await db.execute(sql`
    SELECT m.id::text AS id, m.author_kind, m.body, m.created_at, au.name AS author_name
      FROM public.support_messages m
      LEFT JOIN public.members au ON au.id = m.author_member_user_id
     WHERE m.ticket_id = ${id} ORDER BY m.created_at ASC`);

  const ticket = {
    id: t.id as string,
    status: t.status as string,
    subject: (t.subject as string | null) ?? null,
    requesterName: (t.requester_name as string | null) ?? null,
    requesterEmail: t.requester_email as string,
    openedAt: t.opened_at ? new Date(t.opened_at as string).toISOString() : null,
    closedAt: t.closed_at ? new Date(t.closed_at as string).toISOString() : null,
    assignedName: (t.assigned_name as string | null) ?? null,
  };
  const messages = rows(mr).map((m) => ({
    id: m.id as string,
    authorKind: m.author_kind as string,
    authorName: (m.author_name as string | null) ?? null,
    body: m.body as string,
    createdAt: new Date(m.created_at as string).toISOString(),
  }));

  return NextResponse.json({ ok: true, ticket, messages });
}
