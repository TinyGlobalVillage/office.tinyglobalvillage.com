import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const GROUP_FILE = path.join(process.cwd(), "data", "group-chats.json");

export type GroupChat = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  memberIds: string[];
  admins: string[];
  visibility?: "open" | "restricted" | "invisible";
};

export type GroupMessage = {
  id: string;
  groupId: string;
  from: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
};

type GroupDb = {
  groups: Record<string, GroupChat>;
  messages: Record<string, GroupMessage[]>;
};

export function readGroupDb(): GroupDb {
  try {
    if (!fs.existsSync(GROUP_FILE)) return { groups: {}, messages: {} };
    const parsed = JSON.parse(fs.readFileSync(GROUP_FILE, "utf8"));
    return { groups: parsed.groups ?? {}, messages: parsed.messages ?? {} };
  } catch { return { groups: {}, messages: {} }; }
}

export function writeGroupDb(db: GroupDb) {
  fs.mkdirSync(path.dirname(GROUP_FILE), { recursive: true });
  fs.writeFileSync(GROUP_FILE, JSON.stringify(db, null, 2));
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const db = readGroupDb();
  const groups = Object.values(db.groups)
    .filter((g) => g.memberIds.includes(username) || g.visibility !== "invisible")
    .map((g) => ({
      ...g,
      isMember: g.memberIds.includes(username),
      isAdmin: g.admins.includes(username),
    }));
  return NextResponse.json({ groups });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const memberIds: string[] = Array.isArray(body?.memberIds) ? body.memberIds.filter((m: unknown) => typeof m === "string") : [];
  const visRaw = typeof body?.visibility === "string" ? body.visibility : "open";
  const visibility: GroupChat["visibility"] =
    visRaw === "restricted" || visRaw === "invisible" ? visRaw : "open";
  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  const db = readGroupDb();
  const id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const allMembers = Array.from(new Set([username, ...memberIds]));
  const group: GroupChat = {
    id,
    name,
    createdBy: username,
    createdAt: new Date().toISOString(),
    memberIds: allMembers,
    admins: [username],
    visibility,
  };
  db.groups[id] = group;
  db.messages[id] = [];
  writeGroupDb(db);
  return NextResponse.json({ ok: true, group });
}
