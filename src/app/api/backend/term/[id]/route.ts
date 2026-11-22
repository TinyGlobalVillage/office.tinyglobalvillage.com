// GET    /api/backend/term/<id>  — SSE: `data: <base64 pty bytes>` (backlog first), `event: exit` at the end.
// POST   /api/backend/term/<id>  {d?: base64 input, r?: [cols, rows]}
// DELETE /api/backend/term/<id>  — close it.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { getBackendCaller } from "@/lib/backend/server";
import { closeTerm, getTerm, subscribe, writeTerm } from "@/lib/backend/terminals";

type Ctx = { params: Promise<{ id: string }> };
const noStore = { "Cache-Control": "no-store" };

async function find(ctx: Ctx) {
  const caller = await getBackendCaller();
  if (!caller || caller === "forbidden" || !caller.grant.terminal) return null;
  const { id } = await ctx.params;
  return getTerm(id, caller.memberId);
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const t = await find(ctx);
  if (!t) return new Response("Not found", { status: 404 });
  const enc = new TextEncoder();
  let unsub: (() => void) | null = null;
  let beat: NodeJS.Timeout | null = null;
  const stream = new ReadableStream({
    start(controller) {
      const send = (s: string) => {
        try {
          controller.enqueue(enc.encode(s));
        } catch {
          unsub?.();
        }
      };
      if (t.backlog.length) send(`data: ${Buffer.concat(t.backlog).toString("base64")}\n\n`);
      if (t.exited) {
        send("event: exit\ndata: 1\n\n");
        controller.close();
        return;
      }
      unsub = subscribe(t, (ev) => {
        if (ev.type === "data") send(`data: ${ev.b64}\n\n`);
        else {
          send("event: exit\ndata: 1\n\n");
          try {
            controller.close();
          } catch {}
        }
      });
      beat = setInterval(() => send(": beat\n\n"), 20_000);
      req.signal.addEventListener("abort", () => {
        unsub?.();
        if (beat) clearInterval(beat);
      });
    },
    cancel() {
      unsub?.();
      if (beat) clearInterval(beat);
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const t = await find(ctx);
  if (!t) return NextResponse.json({ ok: false, error: "not found" }, { status: 404, headers: noStore });
  const body = (await req.json().catch(() => ({}))) as { d?: string; r?: [number, number] };
  writeTerm(t, body);
  return NextResponse.json({ ok: true }, { headers: noStore });
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const t = await find(ctx);
  if (t) closeTerm(t.id);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
