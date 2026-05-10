/**
 * Personal Alerts — per-user settings (GET, PUT). One row per user_id.
 *
 * Returned by GET on first visit of a user who hasn't saved settings yet:
 *   null  (caller surfaces the onboarding/setup wizard with sane defaults)
 */
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { user_alert_settings } from "@tgv/module-calendar/alerts/db";
import { AlertSettingsUpdateInput } from "@tgv/module-calendar/alerts";
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
    .from(user_alert_settings)
    .where(eq(user_alert_settings.user_id, userId))
    .limit(1);

  return NextResponse.json(rows[0] ?? null);
}

export async function PUT(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = userIdFrom(token);
  if (!userId) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = AlertSettingsUpdateInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // Upsert: insert with reasonable defaults for any unspecified field.
  const data = parsed.data;
  const result = await alertsDb
    .insert(user_alert_settings)
    .values({
      user_id: userId,
      default_channels: data.default_channels ?? ["dashboard"],
      default_recurrence: data.default_recurrence ?? "none",
      default_visibility: data.default_visibility ?? "personal",
      default_email_from_mode: data.default_email_from_mode ?? "own_fastmail",
      timezone: data.timezone ?? "UTC",
      enabled: data.enabled ?? true,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: user_alert_settings.user_id,
      set: {
        ...(data.default_channels !== undefined && { default_channels: data.default_channels }),
        ...(data.default_recurrence !== undefined && { default_recurrence: data.default_recurrence }),
        ...(data.default_visibility !== undefined && { default_visibility: data.default_visibility }),
        ...(data.default_email_from_mode !== undefined && { default_email_from_mode: data.default_email_from_mode }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        updated_at: new Date().toISOString(),
      },
    })
    .returning();

  return NextResponse.json(result[0]);
}
