import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const NOTES_FILE = path.join(process.cwd(), "data", "user-notes.json");

type Memo = {
  id: string;
  from: string;
  to: string;
  content: string;
  createdAt: string;
  editedAt?: string;
  archivedBy?: string[]; // usernames who have archived this memo
};

type NotesDB = { memos: Memo[]; pings: unknown[] };

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

// GET — memos visible to the current user (sent or received, not archived by them)
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";
  const db = read();
  const memos = db.memos.filter(
    (m) => (m.from === username || m.to === username) && !(m.archivedBy ?? []).includes(username)
  );
  return NextResponse.json({ memos });
}

// POST — create a memo
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  if (!body?.to || !body?.content?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = read();
  const memo: Memo = {
    id: `m_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: username,
    to: body.to,
    content: body.content.trim(),
    createdAt: new Date().toISOString(),
  };
  db.memos.unshift(memo);
  db.memos = db.memos.slice(0, 200);
  write(db);
  return NextResponse.json({ ok: true, memo });
}

// PATCH — edit content (sender only) OR archive (sender or recipient)
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = read();
  const memo = db.memos.find((m) => m.id === body.id);
  if (!memo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Archive: any party can archive for themselves
  if (body.archive) {
    if (memo.from !== username && memo.to !== username)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    memo.archivedBy = [...new Set([...(memo.archivedBy ?? []), username])];
    write(db);
    return NextResponse.json({ ok: true });
  }

  // Edit: sender only
  if (!body.content?.trim())
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  if (memo.from !== username)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  memo.content = body.content.trim();
  memo.editedAt = new Date().toISOString();
  write(db);
  return NextResponse.json({ ok: true });
}

// DELETE — sender or recipient can delete
export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = read();
  const before = db.memos.length;
  db.memos = db.memos.filter(
    (m) => !(m.id === id && (m.from === username || m.to === username))
  );
  if (db.memos.length === before) return NextResponse.json({ error: "Not found" }, { status: 404 });
  write(db);
  return NextResponse.json({ ok: true });
}
