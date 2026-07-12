/**
 * Front Desk TEAM alerts API — the scheduled-alerts calendar surface.
 *
 * This is DELIBERATELY separate from `/api/utils/personal-alerts` (which is
 * user-scoped): the Front Desk calendar is a TEAM board. GET returns every
 * `visibility='team'` alert regardless of author (so RCS automations, teammates'
 * shared reminders, and migration alerts all show up); POST always writes a
 * team-visibility row owned by the caller.
 *
 * DECOUPLED from support tickets by construction — reads/writes only
 * `user_alerts` (System C), never `support_tickets` (System B). Do not import
 * the support proxy here.
 *
 * Auth: session via requireAuth(). Team alerts are readable/writable by any
 * authenticated staff member.
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { user_alerts } from "@tgv/module-calendar/alerts/db";
import { PersonalAlertCreateInput } from "@tgv/module-calendar/alerts";
import { alertsDb } from "@/lib/alerts-db";
import { requireAuth } from "@/lib/api-auth";

function userIdFrom(token: { name?: string; username?: string; sub?: string }): string {
  return token.username ?? token.name ?? token.sub ?? "";
}

// GET — every team-visibility alert, soonest first. Any author, any source.
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await alertsDb
    .select()
    .from(user_alerts)
    .where(eq(user_alerts.visibility, "team"));

  // Soonest first (sorted here rather than via .orderBy to sidestep a drizzle
  // builder type-identity quirk across workspace packages; table is tiny).
  rows.sort((a, b) => a.trigger_at.localeCompare(b.trigger_at));

  return NextResponse.json(rows);
}

// POST — create a TEAM alert owned by the caller. Visibility is forced to
// "team" server-side regardless of client input; source stays the DB default
// ("manual"). RCS automations insert source='rcs' rows directly, not via here.
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
      visibility: "team",
      email_from_mode: parsed.data.email_from_mode ?? null,
    })
    .returning();

  return NextResponse.json(inserted[0], { status: 201 });
}
