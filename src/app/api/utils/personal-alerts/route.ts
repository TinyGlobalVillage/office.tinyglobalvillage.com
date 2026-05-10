/**
 * Personal Alerts API — collection endpoints (GET list, POST create).
 *
 * Auth: session via requireAuth() — every alert is scoped to the logged-in
 * user. Reading or writing another user's alerts is not exposed.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { user_alerts } from "@tgv/module-calendar/alerts/db";
import { PersonalAlertCreateInput } from "@tgv/module-calendar/alerts";
import { alertsDb } from "@/lib/alerts-db";
import { requireAuth } from "@/lib/api-auth";

function userIdFrom(token: { name?: string; username?: string; sub?: string }): string {
  return token.username ?? token.name ?? token.sub ?? "";
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = userIdFrom(token);
  if (!userId) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  const rows = await alertsDb
    .select()
    .from(user_alerts)
    .where(eq(user_alerts.user_id, userId));

  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = userIdFrom(token);
  if (!userId) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PersonalAlertCreateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const inserted = await alertsDb
    .insert(user_alerts)
    .values({
      user_id: userId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      trigger_at: parsed.data.trigger_at,
      channels: parsed.data.channels,
      recurrence: parsed.data.recurrence,
      visibility: parsed.data.visibility,
      email_from_mode: parsed.data.email_from_mode ?? null,
    })
    .returning();

  return NextResponse.json(inserted[0], { status: 201 });
}
