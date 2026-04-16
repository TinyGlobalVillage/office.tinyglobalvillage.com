import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

// In-memory typing state: key = `${username}:${context}`, value = last seen ms
const typingState = new Map<string, number>();
const STALE_MS = 4000; // entries older than this are considered done

function getActiveTypers(context: string, exclude?: string): string[] {
  const now = Date.now();
  const result: string[] = [];
  for (const [key, ts] of typingState.entries()) {
    if (now - ts > STALE_MS) { typingState.delete(key); continue; }
    const [username, ctx] = key.split(":");
    if (ctx === context && username !== exclude) result.push(username);
  }
  return result;
}

// GET /api/chat/typing?context=chat  or  ?context=dm:peerusername
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const context = req.nextUrl.searchParams.get("context") ?? "chat";
  const typers = getActiveTypers(context, token.username);
  return NextResponse.json({ typers });
}

// POST /api/chat/typing  body: { context: "chat" | "dm:peerusername" }
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const context = (body.context as string) ?? "chat";
  typingState.set(`${token.username}:${context}`, Date.now());
  return NextResponse.json({ ok: true });
}
