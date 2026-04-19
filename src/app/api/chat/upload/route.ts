import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const CDN_ROOT = "/srv/refusion-core/cdn";
const CDN_BASE_URL = "https://office.tinyglobalvillage.com/media";
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB per file

const MONTH_ABBR = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function datePart(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mmm = MONTH_ABBR[d.getMonth()];
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}_${mmm}_${dd}`;
}

function mimeToType(mime: string): string {
  if (mime.startsWith("image/")) return "images";
  if (mime.startsWith("video/")) return "videos";
  if (mime.startsWith("audio/")) return "audio";
  return "files";
}

type ChatMessage = {
  id: string;
  from: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
  readBy?: string[];
  replyTo?: { id: string; from: string; excerpt: string };
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
  const cdnChatDir = path.join(CDN_ROOT, "chat");
  try {
    if (fs.existsSync(cdnChatDir)) {
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(p);
          else { try { total += fs.statSync(p).size; } catch { /* ignore */ } }
        }
      };
      walk(cdnChatDir);
    }
  } catch { /* ignore */ }
  try { total += fs.statSync(CHAT_FILE).size; } catch { /* ignore */ }
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
  const chatId = (formData.get("chatId") as string | null) ?? "group";
  const replyToRaw = formData.get("replyTo") as string | null;
  let replyTo: { id: string; from: string; excerpt: string } | null = null;
  if (replyToRaw) {
    try {
      const parsed = JSON.parse(replyToRaw);
      if (parsed && typeof parsed === "object" && typeof parsed.id === "string") {
        replyTo = parsed;
      }
    } catch { /* ignore */ }
  }

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  const mime = file.type || "application/octet-stream";
  const type = mimeToType(mime);
  const ext = path.extname(file.name).slice(0, 10);
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fileName = `${datePart()}_${sanitizedName}`;

  const destDir = path.join(CDN_ROOT, "chat", chatId, username, type);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  const fileUrl = `${CDN_BASE_URL}/chat/${chatId}/${username}/${type}/${fileName}`;

  const db = readDB();
  const msg: ChatMessage = {
    id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    from: username,
    content: caption.trim(),
    fileUrl,
    fileName: file.name,
    fileSize: file.size,
    fileMime: mime,
    createdAt: new Date().toISOString(),
    readBy: [],
    ...(replyTo ? { replyTo } : {}),
  };
  db.messages.push(msg);
  writeDB(db);

  return NextResponse.json({ ok: true, message: msg });
}
