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

  const user = readUsers()[username];
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const creds = user.webauthnCredentials ?? [];
  if (!creds.some((c) => c.id === credentialId)) {
    return NextResponse.json({ error: "Passkey not found" }, { status: 404 });
  }

  updateUser(username, {
    webauthnCredentials: creds.map((c) =>
      c.id === credentialId ? { ...c, deviceName } : c,
    ),
  });
  logAuthEvent({ event: "passkey.rename", username, success: true, details: { deviceName } });
  return NextResponse.json({ ok: true });
}
