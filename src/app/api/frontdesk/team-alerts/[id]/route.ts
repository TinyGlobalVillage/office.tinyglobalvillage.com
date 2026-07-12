/**
 * Front Desk TEAM alerts — single-alert endpoints (PATCH update, DELETE).
 *
 * The Front Desk calendar is a shared TEAM board, so edit/delete are scoped by
 * `visibility='team'` (NOT by author) — any authenticated staff member can edit
 * or remove a team alert, including ones seeded by RCS automations. Visibility
 * is pinned to "team" on update so a row can't be moved off the board here.
 *
 * DECOUPLED from support tickets — touches only `user_alerts` (System C).
 *
 * PATCH semantics:
 *   - empty body → dismiss (status='dismissed', dismissed_at=now)
 *   - body with fields → partial update of those fields (Zod-validated)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { user_alerts } from "@tgv/module-calendar/alerts/db";
import { PersonalAlertUpdateInput } from "@tgv/module-calendar/alerts";
import { alertsDb } from "@/lib/alerts-db";
import { requireAuth } from "@/lib/api-auth";

const teamScope = (id: string) => and(eq(user_alerts.id, id), eq(user_alerts.visibility, "team"));

const WORK_STATUSES = ["open", "in_progress", "completed", "closed"] as const;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) ?? {};

  // Workflow update (assignment / task status) → merged into the payload jsonb,
  // separate from the alert's lifecycle `status` column. Assignee = staff
  // username (or null = "open for assignment").
  if ("assignee" in body || "workStatus" in body) {
    if ("workStatus" in body && !WORK_STATUSES.includes(body.workStatus)) {
      return NextResponse.json({ error: "Invalid workStatus" }, { status: 400 });
    }
    const rows = await alertsDb.select().from(user_alerts).where(teamScope(id));
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const cur = (rows[0].payload as Record<string, unknown> | null) ?? {};
    const nextPayload: Record<string, unknown> = { ...cur };
    if ("assignee" in body) nextPayload.assignee = body.assignee ?? null;
    if ("workStatus" in body) nextPayload.workStatus = body.workStatus;
    const result = await alertsDb
      .update(user_alerts)
      .set({ payload: nextPayload })
      .where(teamScope(id))
      .returning();
    return NextResponse.json(result[0]);
  }

  // Empty body → dismiss.
  if (Object.keys(body).length === 0) {
    const result = await alertsDb
      .update(user_alerts)
      .set({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .where(teamScope(id))
      .returning();
    if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(result[0]);
  }

  const parsed = PersonalAlertUpdateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  // Never let an edit move a row off the team board.
  updates.visibility = "team";

  const result = await alertsDb
    .update(user_alerts)
    .set(updates)
    .where(teamScope(id))
    .returning();

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await alertsDb
    .delete(user_alerts)
    .where(teamScope(id))
    .returning();

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
