export const runtime = "nodejs";
export const maxDuration = 120;

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileAsync = promisify(execFile);

type ImgFormat = "jpeg" | "png" | "webp" | "gif";
const MIME: Record<ImgFormat, string> = {
    jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
};

export async function POST(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const fd = await req.formData().catch(() => null);
    if (!fd) return NextResponse.json({ error: "Bad request" }, { status: 400 });

    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const format = ((fd.get("format") as string) ?? "webp") as ImgFormat;
    const quality = Math.min(100, Math.max(1, parseInt((fd.get("quality") as string) ?? "85")));
    const maxW = fd.get("maxWidth") ? parseInt(fd.get("maxWidth") as string) : null;
    const maxH = fd.get("maxHeight") ? parseInt(fd.get("maxHeight") as string) : null;

    const id = `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const inExt = path.extname(file.name) || ".jpg";
    const outExt = format === "jpeg" ? ".jpg" : `.${format}`;
    const inPath = path.join(os.tmpdir(), `${id}${inExt}`);
    const outPath = path.join(os.tmpdir(), `${id}-out${outExt}`);

    try {
        fs.writeFileSync(inPath, Buffer.from(await file.arrayBuffer()));

        const args: string[] = ["-y", "-i", inPath];

        if (maxW || maxH) {
            const w = maxW ?? -2;
            const h = maxH ?? -2;
            args.push("-vf", `scale=${w}:${h}:force_original_aspect_ratio=decrease`);
        }

        if (format === "webp") {
            args.push("-c:v", "libwebp", "-quality", String(quality));
        } else if (format === "jpeg") {
            const q = Math.max(1, Math.round(32 - (quality / 100) * 31));
            args.push("-qscale:v", String(q));
        } else if (format === "png") {
            args.push("-c:v", "png");
        } else if (format === "gif") {
            args.push("-c:v", "gif");
        }

        args.push(outPath);
        await execFileAsync("ffmpeg", args);

        const outBuf = fs.readFileSync(outPath);
        const baseName = path.basename(file.name, path.extname(file.name));

        return new NextResponse(outBuf, {
            headers: {
                "Content-Type": MIME[format] ?? "application/octet-stream",
                "Content-Disposition": `attachment; filename="${baseName}-converted${outExt}"`,
                "X-Original-Size": String(file.size),
                "X-Converted-Size": String(outBuf.length),
            },
        });
    } finally {
        try { fs.unlinkSync(inPath); } catch { /* ignore */ }
        try { fs.unlinkSync(outPath); } catch { /* ignore */ }
    }
}
