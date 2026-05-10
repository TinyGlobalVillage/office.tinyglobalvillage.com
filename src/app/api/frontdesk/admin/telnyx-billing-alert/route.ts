import { type NextRequest, NextResponse } from "next/server";
import { addAnnouncement } from "@/lib/announcements-store";
import { recordTollFraudAttempt } from "@/lib/frontdesk/toll-fraud";
import { verifyWebhookSignature } from "@/lib/frontdesk/telnyx";

// Telnyx billing-alert webhook receiver — telephony-security Item 5 / Tier 2.4
// (2026-05-02, Ed25519 verification corrected 2026-05-02).
//
// LAST-RESORT safety net: if every other defense layer fails, Telnyx's own
// account-side spend monitoring fires this webhook. The endpoint records an
// audit row, broadcasts a Front Desk announcement, and returns 200 so Telnyx
// doesn't retry-storm.
//
// Telnyx supports two billing-alert webhook types (Mission Control →
// Account → Billing → Alerts):
//   1. "Balance below threshold"  — fires when account balance < $X
//   2. "Daily spend over cap"     — fires when 24h rolling spend > $X
// Both share this single endpoint; we differentiate via the body's
// `event_type` field if Telnyx provides one.
//
// SIGNING: Telnyx signs ALL webhooks with the same account-wide Ed25519
// keypair. Headers: `telnyx-signature-ed25519` (base64 sig) + `telnyx-timestamp`
// (Unix seconds). Signed payload = `<timestamp>|<rawBody>`. Public key in
// env as TELNYX_PUBLIC_KEY (already configured for calls/sms webhooks).
// There is NO per-webhook secret; the same key verifies every Telnyx
// webhook in the account.

export async function POST(req: NextRequest) {
  // Capture raw body BEFORE parsing — Ed25519 signs raw bytes.
  const rawBody = await req.text();

  const ok = await verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("telnyx-signature-ed25519"),
    timestampHeader: req.headers.get("telnyx-timestamp"),
  });
  if (!ok) {
    return NextResponse.json(
      { error: "Webhook signature invalid or missing" },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(rawBody); } catch { /* malformed — accept and audit anyway */ }

  // Telnyx wraps event payloads as { data: { event_type, payload, occurred_at, ... } }.
  // Field shapes for billing alerts aren't fully documented as of doc snapshot
  // 2026-04-20; we extract defensively and forward the raw body in `data`.
  const data = (body.data ?? {}) as Record<string, unknown>;
  const eventType = (data.event_type as string | undefined) ?? "billing.alert";
  const payload = (data.payload ?? {}) as Record<string, unknown>;
  const balance = payload.balance as string | number | undefined;
  const dailySpend = payload.daily_spend as string | number | undefined;
  const threshold = payload.threshold as string | number | undefined;
  const currency = (payload.currency as string | undefined) ?? "USD";

  recordTollFraudAttempt({
    sourceIp: null,
    fromUri: null,
    targetNumber: null,
    outcome: "telnyx_billing_spike",
    detail: `Telnyx ${eventType}: balance=${balance ?? "?"} daily_spend=${dailySpend ?? "?"} threshold=${threshold ?? "?"} ${currency}`,
  });

  const title =
    eventType === "balance.alert"
      ? `🚨 Telnyx balance below threshold: ${balance ?? "?"} ${currency} (threshold ${threshold ?? "?"})`
      : eventType === "spend.alert"
      ? `🚨 Telnyx daily spend exceeded cap: ${dailySpend ?? "?"} ${currency} (cap ${threshold ?? "?"})`
      : `🚨 Telnyx billing alert (${eventType})`;

  addAnnouncement({
    title,
    type: "sip-attack",
    status: "pending",
    data: {
      totalHits: 0,
      uniqueIps: 0,
      topSources: [],
      windowMs: 0,
      note:
        `Telnyx-side billing alert fired. If you did not place these calls, ` +
        `engage the SIP killswitch immediately via Front Desk → System Tools → SIP Trunk. ` +
        `Event type: ${eventType}.`,
      telnyxRaw: body,
    },
  });

  return NextResponse.json({ ok: true });
}
