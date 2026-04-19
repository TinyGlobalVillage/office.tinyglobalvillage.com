import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

// In-memory typing state: key = `${username}:${context}`, value = last seen ms
const typingState = new Map<string, number>();
const STALE_MS = 4000; // entries older than this are considered done

function normalizeContext(context: string, me: string): string {
  // Normalize DM contexts so both peers converge on the same key.
  // Client sends `dm:<theOtherPerson>`. Canonicalize to `dm:<a_b>` (sorted pair).
  if (context.startsWith("dm:")) {
    const peer = context.slice(3);
    const pair = [me, peer].sort().join("_");
    return `dm:${pair}`;
  }
  if (context.startsWith("group:")) return context;
  return context;
}

function getActiveTypers(context: string, exclude?: string): string[] {
  const now = Date.now();
  const result: string[] = [];
  for (const [key, ts] of typingState.entries()) {
    if (now - ts > STALE_MS) { typingState.delete(key); continue; }
    const sep = key.indexOf("|");
    if (sep < 0) continue;
    const username = key.slice(0, sep);
    const ctx = key.slice(sep + 1);
    if (ctx === context && username !== exclude) result.push(username);
  }
  return result;
}

// GET /api/chat/typing?context=chat  or  ?context=dm:peerusername  or  ?context=group:<id>
export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawContext = req.nextUrl.searchParams.get("context") ?? "chat";
  const context = normalizeContext(rawContext, token.username);
  const typers = getActiveTypers(context, token.username);
  return NextResponse.json({ typers });
}

// POST /api/chat/typing  body: { context: "chat" | "dm:peerusername" | "group:<id>" }
export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawContext = (body.context as string) ?? "chat";
  const context = normalizeContext(rawContext, token.username);
  typingState.set(`${token.username}|${context}`, Date.now());
  return NextResponse.json({ ok: true });
}
