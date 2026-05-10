/**
 * Voicemail mode settings — read/write the FreeSWITCH mod_db key
 * `office/voicemail_mode` which the dialplan checks at the start of every
 * inbound Front Desk call.
 *
 * Modes:
 *   "fallback" — try ringing the softphone first; only go to voicemail on
 *                no-answer / busy. (default)
 *   "always"   — skip the bridge attempt entirely; every inbound call goes
 *                straight to voicemail.
 */
import { NextRequest, NextResponse } from "next/server";
import { eslCommand, isEslConfigured } from "@/lib/frontdesk/esl";

export const runtime = "nodejs";

type Mode = "fallback" | "always";
const VALID_MODES: Mode[] = ["fallback", "always"];

export async function GET() {
  if (!isEslConfigured()) {
    return NextResponse.json({ error: "ESL not configured" }, { status: 503 });
  }
  try {
    const raw = (await eslCommand("api db select/office/voicemail_mode")).trim();
    const mode: Mode = raw === "always" ? "always" : "fallback";
    return NextResponse.json({ mode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  if (!isEslConfigured()) {
    return NextResponse.json({ error: "ESL not configured" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  if (!body.mode || !VALID_MODES.includes(body.mode as Mode)) {
    return NextResponse.json(
      { error: `mode must be one of: ${VALID_MODES.join(", ")}` },
      { status: 400 }
    );
  }
  try {
    await eslCommand(`api db insert/office/voicemail_mode/${body.mode}`);
    return NextResponse.json({ mode: body.mode });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
