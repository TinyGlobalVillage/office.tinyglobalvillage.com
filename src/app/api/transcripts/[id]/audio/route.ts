/**
 * /api/transcripts/[id]/audio
 *
 * Streams the source audio file so the modal's <audio> element can replay
 * what was transcribed. Owner-gated: personal records are only readable by
 * the creator; org records are readable by any authed Office user.
 */
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth } from "@/lib/api-auth";
import { audioAbsPath, getTranscript } from "@/lib/transcripts-store";

export const runtime = "nodejs";

const EXT_TO_MIME: Record<string, string> = {
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".mp4": "audio/mp4",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".flac": "audio/flac",
  ".webm": "audio/webm",
};

function mimeFor(filename: string): string {
  const dot = filename.lastIndexOf(".");
  const ext = dot === -1 ? "" : filename.slice(dot).toLowerCase();
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = await requireAuth(req);
  if (!token?.username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const record = getTranscript(id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Owner gate
  if (
    !record.createdBy.startsWith("org:") &&
    record.createdBy !== token.username
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const abs = audioAbsPath(record);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(abs);
  } catch {
    return NextResponse.json({ error: "Audio file missing on disk" }, { status: 410 });
  }

  // For v1 we serve the whole body; ranges can come later if streaming-seek
  // becomes important for very long files.
  const stream = fs.createReadStream(abs);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk as Uint8Array));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(body, {
    headers: {
      "content-type": mimeFor(record.sourceFilename),
      "content-length": String(stat.size),
      "cache-control": "private, max-age=3600",
    },
  });
}
