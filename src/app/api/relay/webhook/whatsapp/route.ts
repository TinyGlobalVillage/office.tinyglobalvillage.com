/**
 * WhatsApp webhook receiver.
 *
 * Two HTTP methods:
 *   GET  — Meta's verify handshake. We echo back hub.challenge if the
 *          hub.verify_token query param matches WHATSAPP_VERIFY_TOKEN.
 *   POST — Inbound message events. We verify the X-Hub-Signature-256
 *          HMAC against WHATSAPP_APP_SECRET, parse messages, and resume Claude.
 */
import { NextRequest, NextResponse } from "next/server";
import { whatsappTransport, handleInboundReply } from "@tgv/module-connect";
import { verifyWhatsappGetHandshake } from "@tgv/module-connect/apps/whatsapp/webhook";
import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const challenge = verifyWhatsappGetHandshake(req.nextUrl.searchParams);
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "handshake failed" },
      { status: 403 }
    );
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  try {
    whatsappTransport.verifyWebhook(payload, headers, rawBody);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "verification failed" },
      { status: 401 }
    );
  }

  const replies = whatsappTransport.parseInbound(payload, headers);
  if (replies.length === 0) {
    return NextResponse.json({ status: "no-op" });
  }

  (async () => {
    try {
      await ensureConnectBootstrapped();
      for (const reply of replies) {
        try {
          const outcome = await handleInboundReply(connectDb, reply);
          console.log(`[relay/whatsapp] ${reply.providerMessageId}: ${outcome.status}`);
        } catch (err) {
          console.error(`[relay/whatsapp] failed to handle reply ${reply.providerMessageId}:`, err);
        }
      }
    } catch (err) {
      console.error("[relay/whatsapp] bootstrap/handle error:", err);
    }
  })();

  return NextResponse.json({ status: "received", count: replies.length });
}
