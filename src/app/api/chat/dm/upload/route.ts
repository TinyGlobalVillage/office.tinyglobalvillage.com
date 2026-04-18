import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");
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

type DmMessage = {
  id: string;
  from: string;
  to: string;
  content: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMime?: string;
  createdAt: string;
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

function calcStorageBytes(chatId: string): number {
  let total = 0;
  const cdnChatDir = path.join(CDN_ROOT, "chat", chatId);
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
  return total;
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  const caption = (formData.get("content") as string | null) ?? "";
  const to = (formData.get("to") as string | null) ?? "";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (!to) return NextResponse.json({ error: "Missing 'to' field" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 50 MB)" }, { status: 413 });
  }

  const chatId = `dm_${threadKey(username, to)}`;

  const storageBytes = calcStorageBytes(chatId);
  if (storageBytes >= MAX_BYTES) {
    return NextResponse.json({ error: "Storage full." }, { status: 507 });
  }

  const mime = file.type || "application/octet-stream";
  const type = mimeToType(mime);
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const fileName = `${datePart()}_${sanitizedName}`;

  const destDir = path.join(CDN_ROOT, "chat", chatId, username, type);
  fs.mkdirSync(destDir, { recursive: true });

  const destPath = path.join(destDir, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buffer);

  const fileUrl = `${CDN_BASE_URL}/chat/${chatId}/${username}/${type}/${fileName}`;

  const db = readDb();
  const key = threadKey(username, to);
  if (!db.threads[key]) db.threads[key] = [];
  const msg: DmMessage = {
    id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    from: username,
    to,
    content: caption.trim(),
    fileUrl,
    fileName: file.name,
    fileSize: file.size,
    fileMime: mime,
    createdAt: new Date().toISOString(),
  };
  db.threads[key].push(msg);
  db.threads[key] = db.threads[key].slice(-500);
  writeDb(db);

  return NextResponse.json({ ok: true, message: msg });
}
