// GET /api/auth/passkeys
//
// Lists the CALLER'S OWN registered passkeys (label + created date). Public at
// the proxy layer (under /api/auth) but enforces its own session check, and
// only ever returns the credentials belonging to the signed-in user.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { readUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  const username = (token?.username ?? token?.sub) as string | undefined;
  if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = readUsers()[username];
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const passkeys = (user.webauthnCredentials ?? []).map((c) => ({
    id: c.id,
    deviceName: c.deviceName,
    createdAt: c.createdAt,
  }));
  return NextResponse.json({ passkeys });
}
