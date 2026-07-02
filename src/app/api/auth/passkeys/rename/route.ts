// POST /api/auth/passkeys/rename
//
// Rename one of the CALLER'S OWN passkeys. The deviceName is a cosmetic label
// (data/users.json → webauthnCredentials[].deviceName), not part of the
// credential, so renaming is always safe. Enforces its own session check and
// can only touch the signed-in user's credentials.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readUsers, updateUser } from "@/lib/users";
import { logAuthEvent } from "@/lib/audit-log";
import { memberIdForUsername } from "@/lib/member-auth/bridge";
import { pgPool } from "@/lib/pg-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  const username = (token?.username ?? token?.sub) as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const credentialId = typeof body?.credentialId === "string" ? body.credentialId : "";
  const deviceName = typeof body?.deviceName === "string" ? body.deviceName.trim() : "";
  if (!credentialId || !deviceName) {
    return NextResponse.json({ error: "credentialId and deviceName required" }, { status: 400 });
  }
  if (deviceName.length > 60) {
    return NextResponse.json({ error: "Name too long (60 max)." }, { status: 400 });
  }

  // Canonical member store first: rename only the caller's own credential
  // (the member_id predicate enforces ownership).
  let renamed = false;
  const memberId = await memberIdForUsername(username);
  if (memberId) {
    const upd = await pgPool.query(
      "UPDATE member_passkeys SET nickname = $1 WHERE credential_id = $2 AND member_id = $3",
      [deviceName, credentialId, memberId],
    );
    if (upd.rowCount && upd.rowCount > 0) renamed = true;
  }

  // Fall back to the legacy users.json store for a not-yet-migrated credential.
  if (!renamed) {
    const user = readUsers()[username];
    const creds = user?.webauthnCredentials ?? [];
    if (creds.some((c) => c.id === credentialId)) {
      updateUser(username, {
        webauthnCredentials: creds.map((c) => (c.id === credentialId ? { ...c, deviceName } : c)),
      });
      renamed = true;
    }
  }

  if (!renamed) return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  logAuthEvent({ event: "passkey.rename", username, success: true, details: { deviceName } });
  return NextResponse.json({ ok: true });
}
