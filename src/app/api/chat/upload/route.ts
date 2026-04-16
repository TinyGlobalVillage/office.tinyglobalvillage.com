import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const UPLOADS_DIR = path.join(process.cwd(), "data", "chat-uploads");
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "chat-uploads");
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file

type ChatMessage = {
  id: string;
  from: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
};

type ChatDB = { messages: ChatMessage[]; storageBytes: number };

function readDB(): ChatDB {
  try {
    if (!fs.existsSync(CHAT_FILE)) return { messages: [], storageBytes: 0 };
    return JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
  } catch { return { messages: [], storageBytes: 0 }; }
}

function writeDB(db: ChatDB) {
  fs.mkdirSync(path.dirname(CHAT_FILE), { recursive: true });
  fs.writeFileSync(CHAT_FILE, JSON.stringify(db, null, 2));
}

function calcStorageBytes(): number {
  let total = 0;
  try { total += fs.statSync(CHAT_FILE).size; } catch { /* ignore */ }
  try {
    if (fs.existsSync(UPLOADS_DIR)) {
      for (const f of fs.readdirSync(UPLOADS_DIR)) {
        try { total += fs.statSync(path.join(UPLOADS_DIR, f)).size; } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }
  return total;
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const storageBytes = calcStorageBytes();
  if (storageBytes >= MAX_BYTES) {
    return NextResponse.json({ error: "Storage full. Clear chat to free space." }, { status: 507 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  const caption = (formData.get("content") as string | null) ?? "";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  // Sanitize filename
  const ext = path.extname(file.name).slice(0, 10);
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}${ext}`;

  fs.mkdirSync(PUBLIC_UPLOADS, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const destPath = path.join(PUBLIC_UPLOADS, safeName);
  fs.writeFileSync(destPath, buffer);

  const fileUrl = `/chat-uploads/${safeName}`;

  const db = readDB();
  const msg: ChatMessage = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: username,
    content: caption.trim(),
    fileUrl,
    fileName: file.name,
    fileSize: file.size,
    fileMime: file.type || "application/octet-stream",
    createdAt: new Date().toISOString(),
  };
  db.messages.push(msg);
  writeDB(db);

  return NextResponse.json({ ok: true, message: msg });
}
