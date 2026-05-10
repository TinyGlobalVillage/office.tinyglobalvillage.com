/**
 * Personal Alerts API — single-alert endpoints (PATCH update/dismiss, DELETE).
 *
 * PATCH semantics:
 *   - body empty → flip status to "dismissed", set dismissed_at
 *   - body with fields → partial update of those fields (validated via Zod)
 */
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { user_alerts } from "@tgv/module-calendar/alerts/db";
import { PersonalAlertUpdateInput } from "@tgv/module-calendar/alerts";
import { alertsDb } from "@/lib/alerts-db";
import { requireAuth } from "@/lib/api-auth";

function userIdFrom(token: { name?: string; username?: string; sub?: string }): string {
  return token.username ?? token.name ?? token.sub ?? "";
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userIdFrom(token);
  if (!userId) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) ?? {};

  // Empty body → user clicked "Dismiss"
  const isDismiss = Object.keys(body).length === 0;

  if (isDismiss) {
    const result = await alertsDb
      .update(user_alerts)
      .set({ status: "dismissed", dismissed_at: new Date().toISOString() })
      .where(and(eq(user_alerts.id, id), eq(user_alerts.user_id, userId)))
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

  const result = await alertsDb
    .update(user_alerts)
    .set(updates)
    .where(and(eq(user_alerts.id, id), eq(user_alerts.user_id, userId)))
    .returning();

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userIdFrom(token);
  if (!userId) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await alertsDb
    .delete(user_alerts)
    .where(and(eq(user_alerts.id, id), eq(user_alerts.user_id, userId)))
    .returning();

  if (result.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
