/**
 * Office shim for the send endpoint. Temporarily wrapped so we can see
 * exactly what's happening when it 502s — once the send flow is stable this
 * goes back to a one-line re-export.
 */
import "@/lib/inbox-setup";
import { type NextRequest, NextResponse } from "next/server";
import { POST as moduleSend } from "@tgv/module-inbox/api/email/send/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const start = Date.now();
  console.log("[send] start", { path: url.pathname, ts: start });
  try {
    const res = await moduleSend(req);
    // Cloudflare replaces any origin 5xx with its own HTML error page, so the
    // client never sees the actual JSON error body. Downgrade 5xx to 400 and
    // log the real error server-side so we can read it.
    if (res.status >= 500) {
      const clone = res.clone();
      const body = await clone.text();
      console.error("[send] 5xx from module", { status: res.status, body });
      return NextResponse.json(
        { error: body.slice(0, 500) },
        { status: 400 }
      );
    }
    console.log("[send] done", { ms: Date.now() - start, status: res.status });
    return res;
  } catch (e) {
    console.error("[send] UNCAUGHT", {
      ms: Date.now() - start,
      message: (e as Error)?.message,
      stack: (e as Error)?.stack,
    });
    return NextResponse.json(
      { error: `Uncaught: ${(e as Error)?.message ?? String(e)}` },
      { status: 500 }
    );
  }
}
