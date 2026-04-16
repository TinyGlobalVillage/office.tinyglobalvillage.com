import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const CHAT_FILE = path.join(process.cwd(), "data", "chat-messages.json");
const PUBLIC_UPLOADS = path.join(process.cwd(), "public", "chat-uploads");

// Only executive team members can clear the chat
const EXEC_TEAM = ["admin", "marmar"];

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const username = token.username ?? token.sub ?? "";

  if (!EXEC_TEAM.includes(username)) {
    return NextResponse.json({ error: "Only executive team can clear chat" }, { status: 403 });
  }

  // Remove all uploaded files
  try {
    if (fs.existsSync(PUBLIC_UPLOADS)) {
      for (const f of fs.readdirSync(PUBLIC_UPLOADS)) {
        try { fs.unlinkSync(path.join(PUBLIC_UPLOADS, f)); } catch { /* ignore */ }
      }
    }
  } catch { /* ignore */ }

  // Reset chat DB
  fs.writeFileSync(CHAT_FILE, JSON.stringify({ messages: [], storageBytes: 0 }, null, 2));

  return NextResponse.json({ ok: true });
}
