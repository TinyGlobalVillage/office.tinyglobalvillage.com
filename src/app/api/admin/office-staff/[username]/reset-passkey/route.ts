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
import { memberUserIdForUsername } from "@/lib/member-auth/bridge";
import { pgPool } from "@/lib/pg-pool";

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

  // Resolve the member identity. A staffer with no members row can't be
  // fully reset here (their member credentials — the standing login — would be
  // left untouched), so fail LOUDLY rather than silently clearing only the
  // legacy store and reporting success.
  const memberUserId = await memberUserIdForUsername(username);
  if (!memberUserId) {
    logHardeningAction({ action: "auth.passkey.reset", target: username, user: gate.username, success: false, details: { error: "no_member_row" } });
    return NextResponse.json({ error: "no_member_row" }, { status: 400 });
  }

  // Clear the CANONICAL member store first (the standing login post-cutover),
  // ATOMICALLY in one transaction — a half-cleared member account (e.g. passkeys
  // gone but recovery codes still live) could otherwise be used to regain access
  // before a retry. Drop passkeys, wipe recovery codes + TOTP, revoke sessions.
  let memberPasskeysCleared = 0;
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    const del = await client.query("DELETE FROM member_passkeys WHERE member_user_id = $1", [memberUserId]);
    memberPasskeysCleared = del.rowCount ?? 0;
    await client.query(
      "UPDATE members SET recovery_codes_hash = '{}', totp_secret = NULL, totp_enrolled_at = NULL WHERE id = $1",
      [memberUserId],
    );
    await client.query("DELETE FROM member_sessions WHERE user_id = $1", [memberUserId]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    logHardeningAction({ action: "auth.passkey.reset", target: username, user: gate.username, success: false, details: { stage: "member", error: String(e) } });
    return NextResponse.json({ error: "reset_incomplete" }, { status: 500 });
  } finally {
    client.release();
  }

  // Then clear the legacy users.json store (idempotent on retry). If THIS fails,
  // the member store is already cleared (standing login blocked); flag a partial
  // reset so the operator retries — the legacy passkey path could otherwise
  // still authenticate the victim until users.json is cleared.
  try {
    updateUser(username, { webauthnCredentials: [], recoveryCodesHash: [], totpSecret: null, totpEnabled: false });
  } catch (e) {
    logHardeningAction({ action: "auth.passkey.reset", target: username, user: gate.username, success: false, details: { stage: "legacy", memberPasskeysCleared, error: String(e) } });
    return NextResponse.json({ error: "reset_partial_legacy", memberPasskeysCleared }, { status: 500 });
  }

  // Actor = the admin (gate.username); target = the staff member being reset.
  logHardeningAction({
    action: "auth.passkey.reset",
    target: username,
    user: gate.username,
    success: true,
    details: { passkeysCleared, memberPasskeysCleared },
  });

  return NextResponse.json({ ok: true, username, passkeysCleared, memberPasskeysCleared });
}
