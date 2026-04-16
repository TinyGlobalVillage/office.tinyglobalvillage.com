import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const UPLOADS_DIR = path.join(process.cwd(), "data", "chat-uploads");
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

export type ChatMessage = {
  id: string;
  from: string;         // username
  content: string;      // text content (empty string for file-only)
  fileUrl?: string;     // relative URL if a file was attached
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
  editedAt?: string;
};

type ChatDB = {
  messages: ChatMessage[];
  storageBytes: number;
};

function readDB(): ChatDB {
  try {
    if (!fs.existsSync(CHAT_FILE)) return { messages: [], storageBytes: 0 };
    return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
  } catch {
    return { messages: [], storageBytes: 0 };
  }
}

function writeDB(db: ChatDB) {
  fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true });
  fs.writeFileSync(CHAT_FILE, JSON.stringify(db, null, 2));
}

function calcStorageBytes(): number {
  let total = 0;
  try {
    const stat = fs.statSync(CHAT_FILE);
    total += stat.size;
  } catch { /* ignore */ }
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const f of fs.readdirSync(UPLOADS_DIR)) {
        try {
          total += fs.statSync(path.join(UPLOADS_DIR, f)).size;
        } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return total;
}

// GET /api/chat — list messages, optionally with ?before=<id>&limit=<n>
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const before = url.searchParams.get("before");

  const db = readDB();
  let msgs = db.messages;

  if (before) {
    const idx = msgs.findIndex((m) => m.id === before);
    if (idx > 0) msgs = msgs.slice(0, idx);
  }

  const page = msgs.slice(-limit);
  const storageBytes = calcStorageBytes();

  return NextResponse.json({
    messages: page,
    total: db.messages.length,
    storageBytes,
    storagePercent: Math.round((storageBytes / MAX_BYTES) * 100),
    canClear: storageBytes > MAX_BYTES * 0.9,
  });
}

// POST /api/chat — send a text message
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  if (!body?.content?.trim())
    return NextResponse.json({ error: "Missing content" }, { status: 400 });

  const storageBytes = calcStorageBytes();
  if (storageBytes >= MAX_BYTES) {
    return NextResponse.json(
      { error: "Storage full. Clear chat to continue." },
      { status: 507 }
    );
  }

  const db = readDB();
  const msg: ChatMessage = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: username,
    content: body.content.trim(),
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  writeDB(db);

  return NextResponse.json({ ok: true, message: msg });
}

// PATCH /api/chat — edit own message
export async function PATCH(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const body = await req.json().catch(() => null);
  if (!body?.id || !body?.content?.trim())
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const db = readDB();
  const msg = db.messages.find((m) => m.id === body.id && m.from === username);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  msg.content = body.content.trim();
  msg.editedAt = new Date().toISOString();
  writeDB(db);
  return NextResponse.json({ ok: true, message: msg });
}

// DELETE /api/chat?id=<id> — delete own message
export async function DELETE(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = readDB();
  const msg = db.messages.find((m) => m.id === id);
  if (!msg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Executive team (admin/marmar) can delete any message; others only their own
  const isExec = username === "admin" || username === "marmar";
  if (msg.from !== username && !isExec) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // If message had a file, remove it
  if (msg.fileUrl) {
    const filePath = path.join(process.cwd(), "public", msg.fileUrl);
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
  }

  db.messages = db.messages.filter((m) => m.id !== id);
  writeDB(db);
  return NextResponse.json({ ok: true });
}
