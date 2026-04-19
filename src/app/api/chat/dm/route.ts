import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { getClearCutoff, dmChannelKey, filterByCutoff } from "@/lib/chat-clears";
import fs from "fs";
import path from "path";

const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");

export type DmMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
};

type DmDb = { threads: Record<string, DmMessage[]> };

function threadKey(a: string, b: string) { return [a, b].sort().join("_"); }

function readDb(): DmDb {
  try {
    if (!fs.existsSync(DM_FILE)) return { threads: {} };
    return JSON.parse(fs.readFileSync(DM_FILE, "utf8"));
  } catch { return { threads: {} }; }
}

function writeDb(db: DmDb) {
  fs.mkdirSync(path.dirname(DM_FILE), { recursive: true });
  fs.writeFileSync(DM_FILE, JSON.stringify(db, null, 2));
}

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const isExec = username === "admin" || username === "marmar";
  const withUser = req.nextUrl.searchParams.get("with");
  if (!withUser) return NextResponse.json({ error: "Missing 'with'" }, { status: 400 });
  const db = readDb();
  let messages = db.threads[threadKey(username, withUser)] ?? [];
  if (!isExec) {
    const cutoff = getClearCutoff(username, dmChannelKey(username, withUser));
    messages = filterByCutoff(messages, cutoff);
  }
  return NextResponse.json({ messages });
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.content?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const db = readDb();
  const key = threadKey(username, body.to);
  if (!db.threads[key]) db.threads[key] = [];
  const msg: DmMessage = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: username,
    to: body.to,
    content: body.content.trim(),
    createdAt: new Date().toISOString(),
    readBy: [],
    ...(body.replyTo && typeof body.replyTo === "object" ? { replyTo: body.replyTo } : {}),
  };
  db.threads[key].push(msg);
  db.threads[key] = db.threads[key].slice(-500);
  writeDb(db);
  return NextResponse.json({ ok: true, message: msg });
}

export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.with || !body?.content?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const db = readDb();
  const key = threadKey(username, body.with);
  const msg = db.threads[key]?.find((m) => m.id === body.id && m.from === username);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  msg.content = body.content.trim();
  msg.editedAt = new Date().toISOString();
  writeDb(db);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const id = req.nextUrl.searchParams.get("id");
  const withUser = req.nextUrl.searchParams.get("with");
  if (!id || !withUser) return NextResponse.json({ error: "Missing params" }, { status: 400 });
  const db = readDb();
  const key = threadKey(username, withUser);
  if (!db.threads[key]) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const before = db.threads[key].length;
  db.threads[key] = db.threads[key].filter((m) => !(m.id === id && m.from === username));
  if (db.threads[key].length === before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  writeDb(db);
  return NextResponse.json({ ok: true });
}
