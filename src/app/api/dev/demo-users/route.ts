/**
 * DEV MODE — returns the user list for the dev user-switcher drawer.
 * Admin-gated; 404 when the dev switcher is not enabled.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { getAuthToken } from "@/lib/auth-cookie";
import { readUsers } from "@/lib/users";
import { getRole, isDevSwitcherEnabled } from "@/lib/dev/getEffectiveUser";

type DemoUser = {
  username: string;
  displayName: string;
  email: string;
  role: string;
};

export async function GET(req: NextRequest) {
  if (!isDevSwitcherEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const token = await getAuthToken(req);
  const realUsername = (token as { username?: string } | null)?.username;
  if (!realUsername || getRole(realUsername) !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const store = readUsers() as Record<string, { displayName?: string; email?: string; role?: string }>;
  const users: DemoUser[] = Object.entries(store)
    .map(([username, rec]) => ({
      username,
      displayName: rec.displayName ?? username,
      email: rec.email ?? "",
      role: rec.role ?? "member",
    }))
    .sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  return NextResponse.json({ users });
}
