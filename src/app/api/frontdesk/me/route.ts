/**
 * Current staff member — identity for self-defaulting UI.
 *
 * Returns `{username, displayName, email}` for the signed-in user. Used by the
 * alert-preferences panel to default the "send my alerts to" address to the
 * user's canonical staff email (data/users.json). Names/email only, so gated by
 * requireAuth (any staff), not requireAdmin.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getUserDisplayName, getUserEmail } from "@/lib/users-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const username = token.username ?? token.name ?? token.sub ?? "";
  if (!username) return NextResponse.json({ error: "No user identity" }, { status: 401 });

  return NextResponse.json({
    username,
    displayName: getUserDisplayName(username),
    email: getUserEmail(username),
  });
}
