import { type NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `You are an embedded AI assistant inside TGV Office — a private server dashboard for the TinyGlobalVillage ecosystem running on a Ubuntu Linux server.

You have expert knowledge of:
- The server's project stack: Next.js 15/16, Drizzle ORM, PostgreSQL, NextAuth v5, Stripe, LiveKit, Tailwind CSS v4, TypeScript
- Linux server management, PM2, Nginx, UFW, systemd
- The projects deployed: office.tinyglobalvillage.com, refusionist.com, resonantweaver.com, tinyglobalvillage.com, giocoelho.com, fliringscene.tinyglobalvillage.com
- The codebase lives at /srv/refusion-core/client/<project-name>/

Be concise. When writing code or commands, use code blocks. You can help debug, review code, suggest shell commands, explain errors, or just answer questions.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured in office .env.local" },
      { status: 503 }
    );
  }

  const body = await req.json() as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 4096,
          system: SYSTEM,
          messages: body.messages,
        });

        for await (const chunk of response) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            const data = JSON.stringify({ text: chunk.delta.text });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
