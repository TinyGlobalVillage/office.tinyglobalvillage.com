/**
 * Telegram webhook receiver.
 *
 * Telegram POSTs every update here. We:
 *   1. Verify the secret-token header.
 *   2. Parse the update into zero-or-more InboundReply objects.
 *   3. Hand each off to handleInboundReply, which resolves the task/decision,
 *      persists the reply, marks the decision answered, and resumes Claude.
 *   4. Always return 200 quickly so Telegram doesn't retry storms (we ack
 *      before we finish processing).
 */
import { NextRequest, NextResponse } from "next/server";
import { telegramTransport, handleInboundReply } from "@tgv/module-relay";
import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  // Quick-ack pattern: parse + verify, then 200 immediately, then process async.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    telegramTransport.verifyWebhook(payload, headers, rawBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "verification failed" },
      { status: 401 }
    );
  }

  const replies = telegramTransport.parseInbound(payload, headers);
  if (replies.length === 0) {
    return NextResponse.json({ status: "no-op" });
  }

  // Fire-and-forget the resume work; Telegram only cares about the 200.
  (async () => {
    try {
      await ensureConnectBootstrapped();
      for (const reply of replies) {
        try {
          const outcome = await handleInboundReply(connectDb, reply);
          console.log(
            `[relay/telegram] msg=${reply.providerMessageId} chat=${reply.fromTelegramChatId} thread=${reply.telegramMessageThreadId ?? "none"} from=${reply.fromTelegramUsername ?? reply.fromTelegramUserId ?? "?"}: ${outcome.status}`
          );
        } catch (err) {
          console.error(`[relay/telegram] failed to handle reply ${reply.providerMessageId}:`, err);
        }
      }
    } catch (err) {
      console.error("[relay/telegram] bootstrap/handle error:", err);
    }
  })();

  return NextResponse.json({ status: "received", count: replies.length });
}
