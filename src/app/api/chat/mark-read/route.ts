import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const DM_FILE = path.join(process.cwd(), "data", "direct-messages.json");
const GROUP_FILE = path.join(process.cwd(), "data", "group-chats.json");

function threadKey(a: string, b: string) { return [a, b].sort().join("_"); }

/**
 * POST /api/chat/mark-read
 * body: { scope: "dm"; peer: string; upTo?: string }
 *     | { scope: "group"; groupId: string; upTo?: string }
 *     | { scope: "tgv"; upTo?: string }   // reserved for future
 */
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const me = token.username;
  const body = await req.json().catch(() => null) as { scope?: string; peer?: string; groupId?: string; upTo?: string } | null;
  if (!body?.scope) return NextResponse.json({ error: "Missing scope" }, { status: 400 });

  const markIfNeeded = (msg: { from?: string; readBy?: string[] }) => {
    if (!msg || msg.from === me) return;
    if (!msg.readBy) msg.readBy = [];
    if (!msg.readBy.includes(me)) msg.readBy.push(me);
  };

  if (body.scope === "dm" && body.peer) {
    if (!fs.existsSync(DM_FILE)) return NextResponse.json({ ok: true });
    const db = JSON.parse(fs.readFileSync(DM_FILE, "utf8")) as { threads: Record<string, { id: string; from: string; readBy?: string[] }[]> };
    const key = threadKey(me, body.peer);
    const thread = db.threads[key] ?? [];
    for (const m of thread) {
      markIfNeeded(m);
      if (body.upTo && m.id === body.upTo) break;
    }
    fs.writeFileSync(DM_FILE, JSON.stringify(db, null, 2));
    return NextResponse.json({ ok: true });
  }

  if (body.scope === "group" && body.groupId) {
    if (!fs.existsSync(GROUP_FILE)) return NextResponse.json({ ok: true });
    const db = JSON.parse(fs.readFileSync(GROUP_FILE, "utf8")) as { messages: Record<string, { id: string; from: string; readBy?: string[] }[]> };
    const msgs = db.messages[body.groupId] ?? [];
    for (const m of msgs) {
      markIfNeeded(m);
      if (body.upTo && m.id === body.upTo) break;
    }
    fs.writeFileSync(GROUP_FILE, JSON.stringify(db, null, 2));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
