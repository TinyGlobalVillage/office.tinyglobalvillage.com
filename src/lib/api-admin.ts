// Admin gate helper — replays requireAuth() then verifies the user's role
// in data/users.json is "admin". Used by every hardening / system-tools
// endpoint. Returns NextResponse on rejection so callers can early-return.

import fs from "fs";
import path from "path";
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

type UsersDb = Record<string, { role?: string }>;

function isAdminUsername(username: string): boolean {
  try {
    const p = path.join(process.cwd(), "data", "users.json");
    const db = JSON.parse(fs.readFileSync(p, "utf8")) as UsersDb;
    return db[username]?.role === "admin";
  } catch {
    return false;
  }
}

export async function requireAdmin(
  req: NextRequest,
): Promise<{ ok: true; username: string } | NextResponse> {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  if (!username || !isAdminUsername(username)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  return { ok: true, username };
}
