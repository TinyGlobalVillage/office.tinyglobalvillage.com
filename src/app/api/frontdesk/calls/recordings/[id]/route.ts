import { type NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/api-auth";
import { getCall, patchCall } from "@/lib/frontdesk/calls";

const RECORDINGS_DIR = path.resolve(
  process.cwd(),
  "..",
  "..",
  "clients",
  "office.tinyglobalvillage.com",
  "telephony",
  "data",
  "recordings",
);

// Resolve a recordingPath (which the dialplan writes as an absolute or
// relative path) to a sandboxed absolute path under RECORDINGS_DIR. Returns
// null if the path tries to escape the directory.
function resolveRecording(recordingPath: string): string | null {
  const base = path.basename(recordingPath);
  if (!base || base !== recordingPath.replace(/^.*[\\/]/, "")) return null;
  const abs = path.join(RECORDINGS_DIR, base);
  if (!abs.startsWith(RECORDINGS_DIR + path.sep)) return null;
  return abs;
}

// PATCH — admin edits the free-form notes field on a recorded call.
// Empty body == no-op; only `notes` is editable today.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const notes = typeof body.notes === "string" ? body.notes : undefined;

  const updated = patchCall(id, notes !== undefined ? { notes } : {});
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ call: updated });
}

// DELETE — remove the recording file from disk AND null out the CDR row's
// recordingPath. The CDR itself is preserved so the call still appears in
// history without a playable recording. Idempotent (404 if id unknown,
// silent if file already gone).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const call = getCall(id);
  if (!call) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (call.recordingPath) {
    const abs = resolveRecording(call.recordingPath);
    if (abs) {
      try { await unlink(abs); } catch { /* already gone */ }
      // GPG-encrypted sibling — see telephony-security Item 3 (Phase 2 wires
      // the .gpg variant; Phase 1 leaves plain WAV). Try both for safety.
      try { await unlink(abs + ".gpg"); } catch { /* not encrypted yet */ }
    }
  }
  patchCall(id, { recordingPath: null });
  return NextResponse.json({ ok: true });
}
