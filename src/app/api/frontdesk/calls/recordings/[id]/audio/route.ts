import { type NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { requireAuth } from "@/lib/api-auth";
import { getCall } from "@/lib/frontdesk/calls";

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

const GPG_KEYRING = "/srv/refusion-core/secrets/recordings";

function resolveRecording(recordingPath: string): string | null {
  const base = path.basename(recordingPath);
  if (!base) return null;
  const abs = path.join(RECORDINGS_DIR, base);
  if (!abs.startsWith(RECORDINGS_DIR + path.sep)) return null;
  return abs;
}

// GET /api/frontdesk/calls/recordings/[id]/audio — stream a recording WAV
// back to the browser for playback in the Saved Calls modal. Looks for
// `<file>.wav.gpg` first (Item 3 GPG-pipe variant) and decrypts on the
// fly via the recordings keyring; falls back to plain `<file>.wav` for
// pre-encryption recordings. Auth-gated.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const call = getCall(id);
  if (!call?.recordingPath) {
    return NextResponse.json({ error: "no recording" }, { status: 404 });
  }
  const abs = resolveRecording(call.recordingPath);
  if (!abs) return NextResponse.json({ error: "invalid path" }, { status: 400 });

  // Prefer encrypted variant if present.
  let encryptedExists = false;
  try { await stat(abs + ".gpg"); encryptedExists = true; } catch { /* none */ }

  if (encryptedExists) {
    const gpg = spawn(
      "gpg",
      [
        "--homedir", GPG_KEYRING,
        "--batch",
        "--yes",
        "--decrypt",
        abs + ".gpg",
      ],
      { stdio: ["ignore", "pipe", "ignore"] },
    );
    const webStream = Readable.toWeb(gpg.stdout) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "cache-control": "no-store",
      },
    });
  }

  // Plain WAV fallback.
  try {
    const stats = await stat(abs);
    const stream = createReadStream(abs);
    const webStream = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "content-type": "audio/wav",
        "content-length": String(stats.size),
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "file missing" }, { status: 404 });
  }
}
