import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });

  const body = await req.json().catch(() => null);
  const messages: IncomingMessage[] = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });

  const last = messages[messages.length - 1];
  if (last.role !== "user" || !last.content?.trim()) {
    return NextResponse.json({ error: "last message must be a non-empty user message" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system:
        "You are Claude, helping the user inside their TGV Office admin app. " +
        "Be concise, direct, and practical. The user is the admin/owner of refusionist.com and the TGV platform. " +
        "When relevant, refer to the user's vocabulary (Lightswitch, QMBM, DDM, ACR, GPG, TPG, TSG, SRT, ECL, Reset Button, Eye Icon Toggle).",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const textBlocks = response.content.filter((b): b is Anthropic.TextBlock => b.type === "text");
    const replyText = textBlocks.map((b) => b.text).join("\n\n");

    return NextResponse.json({
      reply: replyText,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      stop_reason: response.stop_reason,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Claude API error: ${message}` }, { status: 502 });
  }
}
