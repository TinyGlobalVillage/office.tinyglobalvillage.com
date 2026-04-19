import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

export type UserRole = "admin" | "employee";

type UserRecord = {
  displayName: string;
  email: string;
  role?: UserRole;
  avatarUrl?: string;
  title?: string;
  bio?: string;
  accentColor?: string;
  darkAccent?: string;
  lightAccent?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  webauthnCredentials?: unknown[];
};

type UsersDB = Record<string, UserRecord>;

function readUsers(): UsersDB {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function writeUsers(db: UsersDB) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 4));
}

// GET /api/users/profile — all public profiles
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = readUsers();
  const profiles = Object.entries(db).map(([username, u]) => ({
    username,
    displayName: u.displayName,
    email: u.email,
    role: (u.role ?? "employee") as UserRole,
    avatarUrl: u.avatarUrl ?? "",
    title: u.title ?? "",
    bio: u.bio ?? "",
    accentColor: u.accentColor ?? (username === "admin" ? "#ff4ecb" : "#00bfff"),
    darkAccent: u.darkAccent,
    lightAccent: u.lightAccent,
  }));
  return NextResponse.json({ profiles });
}

// PATCH /api/users/profile — update own profile fields
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const username = token.username ?? (token.sub === "admin" ? "admin" : token.sub);
  if (!username) return NextResponse.json({ error: "No username" }, { status: 400 });

  const db = readUsers();
  if (!db[username]) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const allowed = ["displayName", "email", "title", "bio", "accentColor", "darkAccent", "lightAccent", "avatarUrl"] as const;
  for (const field of allowed) {
    if (body[field] !== undefined) {
      (db[username] as Record<string, unknown>)[field] = body[field];
    }
  }

  writeUsers(db);
  return NextResponse.json({ ok: true });
}
