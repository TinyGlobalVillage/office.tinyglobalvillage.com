/**
 * DEV MODE — sets/clears the `__dev_impersonate` cookie used by
 * getEffectiveUser (src/lib/dev/getEffectiveUser.ts). Caller must be a
 * real admin (by JWT); target must exist in data/users.json.
 *
 * Returns 404 when the dev switcher is not enabled.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAuthToken } from "@/lib/auth-cookie";
import { readUsers } from "@/lib/users";
import { getRole, isDevSwitcherEnabled } from "@/lib/dev/getEffectiveUser";

async function gate(req: NextRequest): Promise<NextResponse | null> {
  if (!isDevSwitcherEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = await getAuthToken(req);
  const realUsername = (token as { username?: string } | null)?.username;
  if (!realUsername || getRole(realUsername) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = await gate(req);
  if (blocked) return blocked;

  const { username } = (await req.json()) as { username?: string };
  if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

  const store = readUsers() as Record<string, { displayName?: string }>;
  if (!store[username]) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  cookieStore.set("__dev_impersonate", username, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
  // Non-httpOnly mirror for client-side UI (drawer label, etc.)
  cookieStore.set("__dev_impersonate_username", username, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  return NextResponse.json({ username });
}

export async function DELETE(req: NextRequest) {
  const blocked = await gate(req);
  if (blocked) return blocked;

  const cookieStore = await cookies();
  cookieStore.delete("__dev_impersonate");
  cookieStore.delete("__dev_impersonate_username");
  return NextResponse.json({ ok: true });
}
