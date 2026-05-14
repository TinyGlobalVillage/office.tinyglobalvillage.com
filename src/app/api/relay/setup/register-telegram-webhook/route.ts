/**
 * One-shot setup: register the Telegram bot webhook with Telegram so they
 * start delivering updates to /api/relay/webhook/telegram.
 *
 * Body: { url?: string, secretToken?: string }
 * Defaults to https://office.tinyglobalvillage.com/api/relay/webhook/telegram
 * and TELEGRAM_WEBHOOK_SECRET (or TELEGRAM_BOT_TOKEN as fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@tgv/module-relay/apps/telegram/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    secretToken?: string;
  };
  const url = body.url ?? "https://office.tinyglobalvillage.com/api/relay/webhook/telegram";
  const secretToken = body.secretToken ?? process.env.TELEGRAM_WEBHOOK_SECRET ?? process.env.TELEGRAM_BOT_TOKEN;
  if (!secretToken) {
    return NextResponse.json({ error: "No secret token configured" }, { status: 500 });
  }
  try {
    await setWebhook({ url, secretToken, allowedUpdates: ["message"] });
    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
