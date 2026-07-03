/**
 * Voicemail message list — every WAV in the voicemails/ directory EXCEPT
 * the user's greeting. Each entry includes basic metadata plus a
 * best-effort caller match against the inbound CDR whose lifespan brackets
 * the recording timestamp (the dialplan filename only carries a channel
 * uuid, which the CDR store never sees).
 *
 * Dialplan stores files at: voicemails/<YYYY-MM-DD-HH-MM-SS>_<uuid>.wav
 * (the ${strftime(%Y-%m-%d-%H-%M-%S)}_${uuid} pattern). After hangup the
 * `encrypt-recording.sh` script encrypts to .wav.gpg and removes plaintext.
 */
import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/lib/api-auth";
import { listCalls } from "@/lib/frontdesk/calls";

export const runtime = "nodejs";

const VM_DIR =
  "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/voicemails";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let entries: string[];
  try {
    entries = await fs.readdir(VM_DIR);
  } catch {
    return NextResponse.json({ messages: [] });
  }
  const inbound = listCalls(2000).filter((c) => c.direction === "inbound");
  const messages = await Promise.all(
    entries
      .filter((f) => f !== "greeting.wav" && (f.endsWith(".wav") || f.endsWith(".wav.gpg")))
      .map(async (f) => {
        const full = path.join(VM_DIR, f);
        const stat = await fs.stat(full);
        const baseName = f.replace(/\.wav(\.gpg)?$/, "");
        const tsMatch = baseName.match(/^(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})_(.+)$/);
        const recordedAt = tsMatch ? toIso(tsMatch[1]) : stat.mtime.toISOString();
        return {
          id: baseName,
          filename: f,
          encrypted: f.endsWith(".gpg"),
          recordedAt,
          uuid: tsMatch ? tsMatch[2] : null,
          bytes: stat.size,
          callerE164: matchCaller(inbound, recordedAt),
        };
      })
  );
  messages.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  return NextResponse.json({ messages });
}

/**
 * The recording starts mid-call, so the owning CDR is the inbound call
 * whose [startedAt-30s, endedAt+60s] window contains recordedAt; closest
 * startedAt wins. Front Desk handles one call at a time in practice, so
 * collisions are rare — and a wrong guess only mislabels the display name.
 */
function matchCaller(
  inbound: Array<{ startedAt: string; endedAt: string | null; fromE164: string }>,
  recordedAt: string,
): string | null {
  const t = Date.parse(recordedAt);
  if (!Number.isFinite(t)) return null;
  let best: { from: string; dist: number } | null = null;
  for (const c of inbound) {
    const start = Date.parse(c.startedAt);
    if (!Number.isFinite(start)) continue;
    const end = c.endedAt ? Date.parse(c.endedAt) : start + 30 * 60_000;
    if (t < start - 30_000 || t > end + 60_000) continue;
    const dist = Math.abs(t - start);
    if (!best || dist < best.dist) best = { from: c.fromE164, dist };
  }
  return best?.from ?? null;
}

function toIso(stamp: string): string {
  // 2026-05-02-01-30-15 → 2026-05-02T01:30:15 (server local; not strictly UTC,
  // but consistent with how the dialplan writes it.)
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
  if (!m) return stamp;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}
