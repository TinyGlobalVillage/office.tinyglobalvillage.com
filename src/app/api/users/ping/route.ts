import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const NOTES_FILE = path.join(process.cwd(), "data", "user-notes.json");

type Ping = {
  id: string;
  from: string;
  to: string;
  message: string;
  read: boolean;
  createdAt: string;
};

type NotesDB = { memos: unknown[]; pings: Ping[] };

function read(): NotesDB {
  try {
    if (!fs.existsSync(NOTES_FILE)) return { memos: [], pings: [] };
    return JSON.parse(fs.readFileSync(NOTES_FILE, "utf8"));
  } catch { return { memos: [], pings: [] }; }
}

function write(db: NotesDB) {
  fs.mkdirSync(path.dirname(NOTES_FILE), { recursive: true });
  fs.writeFileSync(NOTES_FILE, JSON.stringify(db, null, 2));
}

// GET — pings for the current user (unread ones, or all with ?all=1)
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const all = req.nextUrl.searchParams.get("all") === "1";

  const db = read();
  const pings = db.pings.filter((p) => p.to === username && (all || !p.read));
  return NextResponse.json({ pings, unread: db.pings.filter((p) => p.to === username && !p.read).length });
}

// POST — send a ping
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.message?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = read();
  const ping: Ping = {
    id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: username,
    to: body.to,
    message: body.message.trim(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  db.pings.unshift(ping);
  db.pings = db.pings.slice(0, 100);
  write(db);
  return NextResponse.json({ ok: true, ping });
}

// PATCH — mark ping(s) as read
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  // id = specific ping, or markAll = true for all
  const db = read();

  if (body?.markAll) {
    db.pings.forEach((p) => { if (p.to === username) p.read = true; });
  } else if (body?.id) {
    const ping = db.pings.find((p) => p.id === body.id && p.to === username);
    if (ping) ping.read = true;
  }
  write(db);
  return NextResponse.json({ ok: true });
}

// DELETE — remove a ping
export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = read();
  db.pings = db.pings.filter((p) => !(p.id === id && (p.to === username || p.from === username)));
  write(db);
  return NextResponse.json({ ok: true });
}
