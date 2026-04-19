import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const WHISPER_DIR = "/srv/refusion-core/utils/whisper.cpp";
const WHISPER_BIN = `${WHISPER_DIR}/build/bin/whisper-cli`;
const MODELS_DIR = `${WHISPER_DIR}/models`;
const FFMPEG_BIN = "/usr/bin/ffmpeg";

const ALLOWED_MODELS = new Set([
  "tiny.en", "tiny",
  "base.en", "base",
  "small.en", "small",
  "medium.en", "medium",
  "large-v3", "large-v3-turbo",
]);

function resolveModelPath(model: string): string | null {
  if (!ALLOWED_MODELS.has(model)) return null;
  const file = path.join(MODELS_DIR, `ggml-${model}.bin`);
  return fs.existsSync(file) ? file : null;
}

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (e) {
    return NextResponse.json({ error: `Upload parse failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 400 });
  }

  const audio = formData.get("audio") as File | null;
  const modelRaw = (formData.get("model") as string | null) ?? "base.en";

  if (!audio) return NextResponse.json({ error: "No audio provided" }, { status: 400 });

  const modelPath = resolveModelPath(modelRaw);
  if (!modelPath) {
    return NextResponse.json(
      { error: `Model '${modelRaw}' not available. Run 'bash models/download-ggml-model.sh ${modelRaw}' in whisper.cpp.` },
      { status: 400 }
    );
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tgv-stt-"));
  const inPath = path.join(tmpRoot, "input.webm");
  const wavPath = path.join(tmpRoot, "input.wav");
  const outBase = path.join(tmpRoot, "output");

  try {
    const buffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(inPath, buffer);

    // Whisper requires 16kHz 16-bit mono WAV.
    await execFileAsync(FFMPEG_BIN, [
      "-y",
      "-i", inPath,
      "-ar", "16000",
      "-ac", "1",
      "-c:a", "pcm_s16le",
      wavPath,
    ]);

    await execFileAsync(WHISPER_BIN, [
      "-m", modelPath,
      "-f", wavPath,
      "-otxt",
      "-of", outBase,
      "-nt", // no timestamps
      "-t", "4",
    ]);

    const txtPath = `${outBase}.txt`;
    const text = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, "utf8").trim() : "";

    return NextResponse.json({ text, model: modelRaw });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: string }).stderr ?? "";
    return NextResponse.json(
      { error: `Transcription failed: ${msg}${stderr ? ` | ${stderr.slice(0, 400)}` : ""}` },
      { status: 500 }
    );
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}
