/**
 * Voicemail message list — every WAV in the voicemails/ directory EXCEPT
 * the user's greeting. Each entry includes basic metadata (size, mtime,
 * derived caller info from the filename pattern set in the dialplan).
 *
 * Dialplan stores files at: voicemails/<YYYY-MM-DD-HH-MM-SS>_<uuid>.wav
 * (the ${strftime(%Y-%m-%d-%H-%M-%S)}_${uuid} pattern). After hangup the
 * `encrypt-recording.sh` script encrypts to .wav.gpg and removes plaintext.
 */
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const VM_DIR =
  "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/voicemails";

export async function GET() {
  let entries: string[];
  try {
    entries = await fs.readdir(VM_DIR);
  } catch {
    return NextResponse.json({ messages: [] });
  }
  const messages = await Promise.all(
    entries
      .filter((f) => f !== "greeting.wav" && (f.endsWith(".wav") || f.endsWith(".wav.gpg")))
      .map(async (f) => {
        const full = path.join(VM_DIR, f);
        const stat = await fs.stat(full);
        const baseName = f.replace(/\.wav(\.gpg)?$/, "");
        const tsMatch = baseName.match(/^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})_(.+)$/);
        return {
          id: baseName,
          filename: f,
          encrypted: f.endsWith(".gpg"),
          recordedAt: tsMatch ? toIso(tsMatch[1]) : stat.mtime.toISOString(),
          uuid: tsMatch ? tsMatch[2] : null,
          bytes: stat.size,
        };
      })
  );
  messages.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return NextResponse.json({ messages });
}

function toIso(stamp: string): string {
  // 2026-05-02-01-30-15 → 2026-05-02T01:30:15Z (server local; not strictly UTC,
  // but consistent with how the dialplan writes it.)
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return stamp;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}
