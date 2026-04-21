/**
 * Telnyx Toll-Free Verification status webhook. Telnyx POSTs here whenever our
 * TFV request changes state (submitted → in_review → approved/rejected).
 * We verify the Ed25519 signature and append to data/frontdesk/tfv-status.log.
 */
import { type NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/frontdesk/telnyx";
import { appendFileSync, mkdirSync } from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const ok = await verifyWebhookSignature({
    rawBody,
    signatureHeader: req.headers.get("telnyx-signature-ed25519"),
    timestampHeader: req.headers.get("telnyx-timestamp"),
  });
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  const dir = path.join(process.cwd(), "data", "frontdesk");
  mkdirSync(dir, { recursive: true });
  appendFileSync(
    path.join(dir, "tfv-status.log"),
    `${new Date().toISOString()}\t${rawBody}\n`,
  );
  return NextResponse.json({ ok: true });
}
