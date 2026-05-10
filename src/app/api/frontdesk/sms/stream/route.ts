/**
 * SSE stream for inbound SMS events. The SmsTab opens this and refreshes
 * thread/message lists whenever an "inbound" event arrives — no polling.
 */
import { smsBus, type SmsBusInboundEvent } from "@/lib/frontdesk/sms-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (name: string, data: unknown) => {
        try {
          const lines = [`event: ${name}`, `data: ${JSON.stringify(data)}`, "", ""];
          controller.enqueue(encoder.encode(lines.join("\n")));
        } catch {
          // Stream already closed — listener cleanup happens on the close handler.
        }
      };

      // Initial hello so the browser knows the connection is live.
      sendEvent("hello", { now: new Date().toISOString() });

      const onInbound = (ev: SmsBusInboundEvent) => sendEvent("inbound", ev);
      smsBus.on("inbound", onInbound);

      // Heartbeat every 25s — keeps Cloudflare's idle-connection killer
      // happy (default 100s).
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
        } catch {
          /* closed */
        }
      }, 25_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        smsBus.off("inbound", onInbound);
        try { controller.close(); } catch { /* already closed */ }
      };

      // Best-effort close detection. Next.js doesn't expose req.signal here
      // cleanly, so rely on controller.error/close paths. We add a 4-hour
      // hard cap to avoid leaks if a client drops without our side noticing.
      setTimeout(cleanup, 4 * 60 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // disable nginx buffering for SSE
    },
  });
}
