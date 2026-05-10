/**
 * Voicemail greeting — record/upload + playback.
 *   GET    — stream the current greeting WAV (or 404 if none recorded)
 *   POST   — accept a WAV blob in the request body, save to greeting.wav
 *   DELETE — remove the custom greeting (next call falls back to default)
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

const GREETING_PATH = path.join(
  "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/voicemails",
  "greeting.wav"
);

export async function GET() {
  if (!existsSync(GREETING_PATH)) {
    return NextResponse.json({ error: "No greeting recorded" }, { status: 404 });
  }
  const buf = await fs.readFile(GREETING_PATH);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(buf.length),
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  // Accept either raw WAV body OR multipart/form-data with field "audio".
  const ct = req.headers.get("content-type") ?? "";
  let buf: Buffer;
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ error: "Missing 'audio' field" }, { status: 400 });
      }
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      buf = Buffer.from(await req.arrayBuffer());
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 }
    );
  }

  if (buf.length < 100) {
    return NextResponse.json({ error: "Empty or invalid audio" }, { status: 400 });
  }

  // Quick sanity-check: must start with "RIFF....WAVE"
  const isWav = buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WAVE";
  if (!isWav) {
    return NextResponse.json(
      { error: "Body must be a WAV file (RIFF/WAVE)" },
      { status: 400 }
    );
  }

  await fs.mkdir(path.dirname(GREETING_PATH), { recursive: true });
  await fs.writeFile(GREETING_PATH, buf);
  // Ensure FS user can read it (FS runs as freeswitch:telephony).
  try {
    await fs.chmod(GREETING_PATH, 0o644);
  } catch {
    // best-effort; if chmod fails the file may still be readable depending on umask
  }

  const stat = statSync(GREETING_PATH);
  return NextResponse.json({
    ok: true,
    path: GREETING_PATH,
    bytes: stat.size,
    mtime: stat.mtime.toISOString(),
  });
}

export async function DELETE() {
  if (existsSync(GREETING_PATH)) {
    await fs.unlink(GREETING_PATH);
  }
  return NextResponse.json({ ok: true });
}
