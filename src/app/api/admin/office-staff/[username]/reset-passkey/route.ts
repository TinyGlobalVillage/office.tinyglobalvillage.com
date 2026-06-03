// POST /api/admin/office-staff/[username]/reset-passkey
//
// Identity-verified hard reset of an Office STAFF member's auth state in the
// flat-file store data/users.json. Clears all registered passkeys, recovery
// codes, and TOTP — forcing the staff member back through enrollment on next
// login. Destructive + audit-logged.
//
// The reset is gated behind an identity check: the caller must echo the target
// staff member's email exactly (case-insensitive, trimmed). This mirrors the
// member-auth recovery flow but for file-store accounts.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { readUsers, updateUser } from "@/lib/users";
import { logHardeningAction } from "@/lib/audit-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ username: string }> },
) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const { username } = await ctx.params;

  const user = readUsers()[username];
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let body: { confirmEmail?: unknown };
  try {
    body = (await req.json()) as { confirmEmail?: unknown };
  } catch {
    body = {};
  }
  const confirmEmail =
    typeof body.confirmEmail === "string" ? body.confirmEmail.trim().toLowerCase() : "";

  if (confirmEmail !== user.email.trim().toLowerCase()) {
    return NextResponse.json({ error: "confirm_email_mismatch" }, { status: 400 });
  }

  const passkeysCleared = user.webauthnCredentials?.length ?? 0;

  // updateUser spread-merges, so the `role` field (and other extra columns not
  // in UserRecord) are preserved — only the auth-state fields are reset.
  updateUser(username, {
    webauthnCredentials: [],
    recoveryCodesHash: [],
    totpSecret: null,
    totpEnabled: false,
  });

  // Actor = the admin (gate.username); target = the staff member being reset,
  // so the audit timeline's "by" column shows the admin, not the victim.
  logHardeningAction({
    action: "auth.passkey.reset",
    target: username,
    user: gate.username,
    success: true,
    details: { passkeysCleared },
  });

  return NextResponse.json({ ok: true, username, passkeysCleared });
}
