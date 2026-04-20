export const runtime = "nodejs";
export const maxDuration = 600;

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { spawn, execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { videoJobs, videoProcs, pruneJobs, type VideoJob } from "@/lib/video-jobs";

const execFileAsync = promisify(execFile);

type VideoFormat = "h264" | "h265" | "vp9" | "gif";
const MIME: Record<VideoFormat, string> = {
    h264: "video/mp4", h265: "video/mp4", vp9: "video/webm", gif: "image/gif",
};
const EXT: Record<VideoFormat, string> = {
    h264: ".mp4", h265: ".mp4", vp9: ".webm", gif: ".gif",
};

async function getDuration(inPath: string): Promise<number> {
    try {
        const { stdout } = await execFileAsync("ffprobe", [
            "-v", "quiet", "-print_format", "json", "-show_streams", inPath
        ]);
        const data = JSON.parse(stdout);
        const stream = (data.streams ?? []).find((s: { duration?: string }) => s.duration);
        return stream ? parseFloat(stream.duration) : 0;
    } catch { return 0; }
}

export async function POST(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let fd: FormData;
    try {
        fd = await req.formData();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[convert/video/start] formData parse failed:", msg);
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
    const baseName = path.basename(file.name, path.extname(file.name));

    const jobId = `vjob-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inExt = path.extname(file.name) || ".mp4";
    const outExt = EXT[format];
    const inPath = path.join(os.tmpdir(), `${jobId}${inExt}`);
    const outPath = path.join(os.tmpdir(), `${jobId}-out${outExt}`);

    try {
        fs.writeFileSync(inPath, Buffer.from(await file.arrayBuffer()));
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[convert/video/start] write failed:", msg);
        return NextResponse.json({ error: `Write failed: ${msg}` }, { status: 500 });
    }

    pruneJobs();

    const job: VideoJob = {
        percent: 0,
        done: false,
        error: null,
        outPath: null,
        outMime: MIME[format],
        outExt,
        baseName,
        cleanupPaths: [inPath, outPath],
        createdAt: Date.now(),
    };
    videoJobs.set(jobId, job);

    const scaleFilter = maxW ? `scale=${maxW}:-2:flags=lanczos` : null;
    const args: string[] = ["-y", "-i", inPath, "-progress", "pipe:1", "-nostats"];

    if (scaleFilter) args.push("-vf", `${scaleFilter},setsar=1`);

    if (format === "h264") {
        args.push("-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-c:a", "aac", "-movflags", "+faststart");
    } else if (format === "h265") {
        args.push("-c:v", "libx265", "-crf", String(crf), "-preset", "medium", "-c:a", "aac", "-tag:v", "hvc1");
    } else if (format === "vp9") {
        args.push("-c:v", "libvpx-vp9", "-crf", String(crf), "-b:v", "0", "-c:a", "libopus");
    } else if (format === "gif") {
        const gifFps = fps ?? 15;
        const vf = `fps=${gifFps},${scaleFilter ?? "scale=iw:-2:flags=lanczos"},split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
        const gifArgs = ["-y", "-i", inPath, "-progress", "pipe:1", "-nostats", "-vf", vf, "-loop", "0", outPath];
        spawnConversion(jobId, gifArgs, inPath, outPath, MIME[format]);
        return NextResponse.json({ jobId });
    }

    args.push(outPath);
    spawnConversion(jobId, args, inPath, outPath, MIME[format]);

    return NextResponse.json({ jobId });
}

function spawnConversion(jobId: string, args: string[], inPath: string, outPath: string, mime: string) {
    const job = videoJobs.get(jobId)!;

    getDuration(inPath).then(totalSecs => {
        const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] });
        videoProcs.set(jobId, proc);
        let buf = "";

        proc.stdout.on("data", (chunk: Buffer) => {
            buf += chunk.toString();
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
                if (line.startsWith("out_time_us=")) {
                    const us = parseInt(line.slice("out_time_us=".length));
                    if (!isNaN(us) && totalSecs > 0) {
                        job.percent = Math.min(99, Math.round((us / 1e6 / totalSecs) * 100));
                    } else if (!isNaN(us)) {
                        job.percent = Math.min(99, job.percent + 1);
                    }
                }
            }
        });

        proc.on("close", (code) => {
            videoProcs.delete(jobId);
            if (job.cancelled) {
                job.error = "Cancelled";
                job.done = true;
            } else if (code === 0 && fs.existsSync(outPath)) {
                job.percent = 100;
                job.done = true;
                job.outPath = outPath;
                job.outMime = mime;
            } else {
                job.error = `ffmpeg exited with code ${code}`;
                job.done = true;
            }
            try { fs.unlinkSync(inPath); } catch { /* ignore */ }
            if (job.cancelled) {
                try { fs.unlinkSync(outPath); } catch { /* ignore */ }
            }
        });

        proc.on("error", (err) => {
            videoProcs.delete(jobId);
            job.error = err.message;
            job.done = true;
            try { fs.unlinkSync(inPath); } catch { /* ignore */ }
        });
    });
}
