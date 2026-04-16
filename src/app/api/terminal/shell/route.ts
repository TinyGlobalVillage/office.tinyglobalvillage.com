import { spawn } from "child_process";
import { NextRequest } from "next/server";

// Max command length to prevent abuse
const MAX_CMD_LEN = 2048;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.cmd !== "string" || !body.cmd.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  const cmd = body.cmd.trim().slice(0, MAX_CMD_LEN);
  const cwd = typeof body.cwd === "string" ? body.cwd : "/srv/refusion-core";

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (type: string, data: string) => {
        try {
          controller.enqueue(
            enc.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        } catch {
          /* controller closed */
        }
      };

      send("info", `$ ${cmd}`);

      const child = spawn("bash", ["-c", cmd], {
        cwd,
        env: { ...process.env, TERM: "xterm-256color", FORCE_COLOR: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      child.stdout.on("data", (chunk: Buffer) => send("out", chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => send("err", chunk.toString()));
      child.on("close", (code: number | null) => {
        send("exit", String(code ?? 0));
        try { controller.close(); } catch { /* already closed */ }
      });
      child.on("error", (err: Error) => {
        send("err", `Process error: ${err.message}`);
        try { controller.close(); } catch { /* already closed */ }
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
