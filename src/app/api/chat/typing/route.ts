import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import {
  markTyping,
  getActiveTypers,
  normalizeContext,
} from "@/lib/typing-store";

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
  markTyping(token.username, context);
  return NextResponse.json({ ok: true });
}
