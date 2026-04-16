import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

type UserRole = "admin" | "employee";
type UsersDB = Record<string, Record<string, unknown>>;

function readUsers(): UsersDB {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function writeUsers(db: UsersDB) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 4));
}

// PATCH /api/users/role — admin-only, change role of any user
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUser = token.username ?? (token.sub === "admin" ? "admin" : token.sub) ?? "";

  const db = readUsers();
  const myRole = (db[currentUser]?.role as UserRole) ?? "employee";
  if (myRole !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.username || !body?.role)
    return NextResponse.json({ error: "Missing username or role" }, { status: 400 });

  const validRoles: UserRole[] = ["admin", "employee"];
  if (!validRoles.includes(body.role))
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  if (!db[body.username])
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  db[body.username].role = body.role;
  writeUsers(db);
  return NextResponse.json({ ok: true });
}
