import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let displayName = token.username;
  let email = "";
  let role = "";
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    const record = db[token.username];
    if (record) {
      displayName = record.displayName ?? token.username;
      email = record.email ?? "";
      role = record.role ?? "";
    }
  } catch { /* ignore */ }

  return NextResponse.json({ username: token.username, displayName, email, role });
}
