export const runtime = "nodejs";
export const maxDuration = 600;

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

type VideoFormat = "h264" | "h265" | "vp9" | "gif";
const MIME: Record<VideoFormat, string> = {
    h264: "video/mp4", h265: "video/mp4", vp9: "video/webm", gif: "image/gif",
};
const EXT: Record<VideoFormat, string> = {
    h264: ".mp4", h265: ".mp4", vp9: ".webm", gif: ".gif",
};

export async function POST(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let fd: FormData;
    try {
        fd = await req.formData();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[convert/video] formData parse failed:", msg);
        return NextResponse.json({ error: `Upload parse failed: ${msg}` }, { status: 400 });
    }

    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
    if (typeof file.size === "number" && file.size === 0) {
        return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    const format = ((fd.get("format") as string) ?? "h264") as VideoFormat;
    const crf = Math.min(51, Math.max(0, parseInt((fd.get("crf") as string) ?? "23")));
    const maxW = fd.get("maxWidth") ? parseInt(fd.get("maxWidth") as string) : null;
    const fps = fd.get("fps") ? parseInt(fd.get("fps") as string) : null;
    const previewMode = fd.get("preview") === "true";
    const previewSecs = parseInt((fd.get("previewSecs") as string) ?? "3");
    const ALLOWED_PRESETS = new Set(["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "slower", "veryslow"]);
    const rawPreset = (fd.get("preset") as string) ?? "medium";
    const preset = ALLOWED_PRESETS.has(rawPreset) ? rawPreset : "medium";
    const startSecs = fd.get("startSecs") ? Math.max(0, parseFloat(fd.get("startSecs") as string)) : null;
    const endSecs = fd.get("endSecs") ? Math.max(0, parseFloat(fd.get("endSecs") as string)) : null;

    const id = `vid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inExt = path.extname(file.name) || ".mp4";
    const outExt = previewMode ? ".gif" : EXT[format];
    const inPath = path.join(os.tmpdir(), `${id}${inExt}`);
    const outPath = path.join(os.tmpdir(), `${id}-out${outExt}`);
    const palPath = path.join(os.tmpdir(), `${id}-pal.png`);

    try {
        try {
            fs.writeFileSync(inPath, Buffer.from(await file.arrayBuffer()));
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error("[convert/video] write failed:", msg);
            return NextResponse.json({ error: `Write failed: ${msg}` }, { status: 500 });
        }

        const scaleW = (previewMode ? 320 : maxW) ?? null;
        const scaleFilter = scaleW ? `scale=${scaleW}:-2:flags=lanczos` : "scale=iw:-2";

        try {
            const trimArgs: string[] = [];
            if (startSecs !== null) trimArgs.push("-ss", String(startSecs));
            if (endSecs !== null) trimArgs.push("-to", String(endSecs));

            if (format === "gif" || previewMode) {
                const gifFps = fps ?? (previewMode ? 10 : 15);
                const vf = `fps=${gifFps},${scaleFilter},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
                const paletteArgs = ["-y", ...trimArgs];
                if (previewMode && endSecs === null) paletteArgs.push("-t", String(previewSecs));
                paletteArgs.push("-i", inPath, "-vf", vf, "-loop", "0", outPath);
                await execFileAsync("ffmpeg", paletteArgs, { timeout: 120000 });
            } else {
                const args = ["-y", ...trimArgs, "-i", inPath];

                if (maxW) args.push("-vf", `${scaleFilter},setsar=1`);

                if (format === "h264") {
                    args.push("-c:v", "libx264", "-crf", String(crf), "-preset", preset, "-c:a", "aac", "-movflags", "+faststart");
                } else if (format === "h265") {
                    args.push("-c:v", "libx265", "-crf", String(crf), "-preset", preset, "-c:a", "aac", "-tag:v", "hvc1");
                } else if (format === "vp9") {
                    args.push("-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-c:a", "libopus");
                }

                args.push(outPath);
                await execFileAsync("ffmpeg", args, { timeout: 300000 });
            }
        } catch (err) {
            const e = err as { message?: string; stderr?: string; code?: number };
            const msg = (e.stderr || e.message || String(err)).slice(0, 800);
            console.error("[convert/video] ffmpeg failed:", msg);
            return NextResponse.json({ error: `ffmpeg failed: ${msg}` }, { status: 500 });
        }

        const outBuf = fs.readFileSync(outPath);
        const baseName = path.basename(file.name, path.extname(file.name));
        const outMime = previewMode ? "image/gif" : MIME[format];

        return new NextResponse(outBuf, {
            headers: {
                "Content-Type": outMime,
                "Content-Disposition": `attachment; filename="${baseName}-converted${outExt}"`,
                "X-Original-Size": String(file.size),
                "X-Converted-Size": String(outBuf.length),
            },
        });
    } finally {
        try { fs.unlinkSync(inPath); } catch { /* ignore */ }
        try { fs.unlinkSync(outPath); } catch { /* ignore */ }
        try { fs.unlinkSync(palPath); } catch { /* ignore */ }
    }
}
