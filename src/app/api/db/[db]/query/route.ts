import { NextRequest } from "next/server";
import { isAllowedDb } from "@/lib/db";
import { spawn } from "child_process";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ db: string }> }
) {
  const { db } = await params;
  if (!isAllowedDb(db)) return new Response("Not found", { status: 404 });

  const { query } = await req.json().catch(() => ({ query: "" }));
  if (!query?.trim()) return new Response("No query", { status: 400 });

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (type: string, data: string) => {
        try {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type, data })}\n\n`));
        } catch { /* closed */ }
      };

      const child = spawn(
        "sudo",
        ["-u", "postgres", "psql", "-d", db, "-c", query, "--csv"],
        { stdio: ["ignore", "pipe", "pipe"] }
      );

      let outBuf = "";
      child.stdout.on("data", (chunk: Buffer) => { outBuf += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => send("err", chunk.toString().trim()));
      child.on("close", (code: number | null) => {
        if (outBuf) send("csv", outBuf);
        send("exit", String(code ?? 0));
        try { controller.close(); } catch { /* closed */ }
      });
      child.on("error", (err: Error) => {
        send("err", err.message);
        try { controller.close(); } catch { /* closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
