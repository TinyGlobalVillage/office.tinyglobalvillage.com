/**
 * GET /api/terminal/stream
 * SSE endpoint — pushes all PM2 log lines to the client in real time.
 * Every open terminal tab subscribes here.
 */
import { broadcast, BroadcastEntry } from "@/lib/server-broadcast";

export const dynamic = "force-dynamic";

export async function GET() {
  // Ensure the broadcast process is running
  broadcast.start();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const onLine = (entry: BroadcastEntry) => {
        try {
          controller.enqueue(
            enc.encode(
              `data: ${JSON.stringify({ ts: entry.ts, text: entry.text })}\n\n`
            )
          );
        } catch {
          // Client disconnected — remove listener
          broadcast.off("line", onLine);
        }
      };

      broadcast.on("line", onLine);

      // Send a heartbeat every 25s to keep the connection alive
      const hb = setInterval(() => {
        try {
          controller.enqueue(enc.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(hb);
          broadcast.off("line", onLine);
        }
      }, 25_000);

      // Cleanup when the stream is cancelled (client disconnects)
      return () => {
        clearInterval(hb);
        broadcast.off("line", onLine);
      };
    },
    cancel() {
      // handled in start() return
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
