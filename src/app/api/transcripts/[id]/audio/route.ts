/**
 * /api/transcripts/[id]/audio
 *
 * Streams the source media file so the editor's <audio>/<video> element can
 * replay what was transcribed. Despite the path name "audio", this route
 * also serves video sources — the Content-Type is derived from the source
 * filename's extension via the shared media-mime map. (Path name stays for
 * backwards-compat with existing transcript records that hardcode it.)
 *
 * Owner-gated: personal records are only readable by the creator; org
 * records are readable by any authed Office user.
 */
import { type NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { requireAuth } from "@/lib/api-auth";
import { audioAbsPath, getTranscript } from "@/lib/transcripts-store";
import { mimeForFilename } from "@tgv/module-transcriber/media";

export const runtime = "nodejs";

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
      "content-type": mimeForFilename(record.sourceFilename),
      "content-length": String(stat.size),
      "cache-control": "private, max-age=3600",
    },
  });
}
