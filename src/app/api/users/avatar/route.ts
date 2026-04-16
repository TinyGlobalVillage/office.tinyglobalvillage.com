import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");
// Stored outside the Next.js build tree — served by nginx at /media/office/avatars/
const AVATARS_DIR = "/srv/refusion-core/cdn/office/avatars";
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

type UsersDB = Record<string, Record<string, unknown>>;

function readUsers(): UsersDB {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function writeUsers(db: UsersDB) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 4));
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? (token.sub === "admin" ? "admin" : token.sub) ?? "";

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("avatar") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Max 5 MB" }, { status: 413 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "Images only" }, { status: 400 });

  // Derive extension from mime type
  const extMap: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
  };
  const ext = extMap[file.type] ?? ".jpg";

  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  // Remove old avatar files for this user
  try {
    for (const f of fs.readdirSync(AVATARS_DIR)) {
      if (f.startsWith(`${username}.`)) fs.unlinkSync(path.join(AVATARS_DIR, f));
    }
  } catch { /* ignore */ }

  const fileName = `${username}${ext}`;
  const filePath = path.join(AVATARS_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(await file.arrayBuffer()));

  const avatarUrl = `/media/office/avatars/${fileName}?t=${Date.now()}`;

  const db = readUsers();
  if (db[username]) db[username].avatarUrl = avatarUrl;
  writeUsers(db);

  return NextResponse.json({ ok: true, avatarUrl });
}
