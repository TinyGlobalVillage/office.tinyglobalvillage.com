import { spawn } from "child_process";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  const lines = parseInt(req.nextUrl.searchParams.get("lines") ?? "100", 10);

  const args = name
    ? ["logs", name, "--lines", String(lines), "--raw", "--nostream"]
    : ["logs", "--lines", String(lines), "--raw", "--nostream"];

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (type: string, data: string) => {
        try {
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        } catch { /* closed */ }
      };

      const child = spawn("pm2", args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => send("out", chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => send("log", chunk.toString()));
      child.on("close", (code: number | null) => {
        send("exit", String(code ?? 0));
        try { controller.close(); } catch { /* already closed */ }
      });
      child.on("error", (err: Error) => {
        send("err", `Error: ${err.message}`);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
    cancel() {
      // Client disconnected — nothing to clean up for nostream mode
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
