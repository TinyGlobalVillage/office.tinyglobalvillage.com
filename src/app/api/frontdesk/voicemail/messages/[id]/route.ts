/**
 * DELETE /api/frontdesk/voicemail/messages/[id] — remove a voicemail's
 * audio from disk (both the plaintext .wav and the encrypted .wav.gpg
 * sibling). The id is the basename without extension, jailed to the
 * voicemails dir; the operator greeting is not deletable through here
 * (that's /api/frontdesk/voicemail/greeting).
 */
import { type NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { requireAuth } from "@/lib/api-auth";

export const runtime = "nodejs";

const VM_DIR =
  "/srv/refusion-core/clients/office.tinyglobalvillage.com/telephony/data/voicemails";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!/^[\w.-]+$/.test(id) || id.includes("..") || id === "greeting") {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const base = path.join(VM_DIR, id);
  let removed = 0;
  for (const f of [`${base}.wav`, `${base}.wav.gpg`]) {
    try { await unlink(f); removed++; } catch { /* already gone */ }
  }
  if (removed === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
