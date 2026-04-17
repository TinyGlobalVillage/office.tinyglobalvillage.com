import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/api-auth";
import { loadSandboxContext } from "@/lib/claude-context";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

function isAdmin(username: string | undefined): boolean {
  if (!username) return false;
  try {
    const db = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    return db[username]?.role === "admin";
  } catch { return false; }
}

type Message = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(token.username)) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const messages: Message[] = Array.isArray(body.messages) ? body.messages : [];
  const componentKey: string = body.componentKey || "unknown";
  const currentCode: string = body.currentCode || "";

  if (messages.length === 0)
    return NextResponse.json({ error: "messages required" }, { status: 400 });

  const systemPrompt = loadSandboxContext(currentCode, componentKey);
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const replyText = textBlocks.map((b) => b.text).join("\n\n");

    return NextResponse.json({
      reply: replyText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 502 });
  }
}
