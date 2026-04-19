import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";
import { readGroupDb, writeGroupDb } from "../group/route";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");

type WithReactions = { reactions?: Record<string, string[]> };

function toggleReaction(msg: WithReactions, emoji: string, username: string): WithReactions {
  const reactions = msg.reactions ?? {};
  const users = reactions[emoji] ?? [];
  const idx = users.indexOf(username);
  if (idx >= 0) {
    users.splice(idx, 1);
    if (users.length === 0) delete reactions[emoji];
    else reactions[emoji] = users;
  } else {
    reactions[emoji] = [...users, username];
  }
  msg.reactions = reactions;
  if (Object.keys(reactions).length === 0) delete msg.reactions;
  return msg;
}

function threadKey(a: string, b: string) { return [a, b].sort().join("_"); }

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch { return fallback; }
}

function writeJSON(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  const scope = body?.scope as "tgv" | "dm" | "group" | undefined;
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  const emoji = typeof body?.emoji === "string" ? body.emoji.trim() : "";
  if (!scope || !messageId || !emoji) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (emoji.length > 16) {
    return NextResponse.json({ error: "Invalid emoji" }, { status: 400 });
  }

  if (scope === "tgv") {
    const db = readJSON<{ messages: (WithReactions & { id: string })[]; storageBytes: number }>(
      CHAT_FILE,
      { messages: [], storageBytes: 0 },
    );
    const msg = db.messages.find((m) => m.id === messageId);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    toggleReaction(msg, emoji, username);
    writeJSON(CHAT_FILE, db);
    return NextResponse.json({ ok: true, reactions: msg.reactions ?? {} });
  }

  if (scope === "dm") {
    const withUser = typeof body?.with === "string" ? body.with : "";
    if (!withUser) return NextResponse.json({ error: "Missing with" }, { status: 400 });
    const db = readJSON<{ threads: Record<string, (WithReactions & { id: string })[]> }>(
      DM_FILE,
      { threads: {} },
    );
    const list = db.threads[threadKey(username, withUser)] ?? [];
    const msg = list.find((m) => m.id === messageId);
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    toggleReaction(msg, emoji, username);
    writeJSON(DM_FILE, db);
    return NextResponse.json({ ok: true, reactions: msg.reactions ?? {} });
  }

  if (scope === "group") {
    const groupId = typeof body?.groupId === "string" ? body.groupId : "";
    if (!groupId) return NextResponse.json({ error: "Missing groupId" }, { status: 400 });
    const db = readGroupDb();
    const group = db.groups[groupId];
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (!group.memberIds.includes(username)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const list = db.messages[groupId] ?? [];
    const msg = list.find((m) => m.id === messageId) as (WithReactions & { id: string }) | undefined;
    if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
    toggleReaction(msg, emoji, username);
    writeGroupDb(db);
    return NextResponse.json({ ok: true, reactions: msg.reactions ?? {} });
  }

  return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
}
