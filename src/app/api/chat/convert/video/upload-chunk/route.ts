export const runtime = "nodejs";
export const maxDuration = 600;

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "fs";
import os from "os";
import path from "path";

// Chunked-upload companion to /start. Cloudflare caps request bodies at 100 MB
// on free plans, so large .mov files are split client-side and reassembled here.
// The client sends: { uploadId, chunkIndex, totalChunks, chunk, fileName (first only) }

function chunkDir(uploadId: string) {
    return path.join(os.tmpdir(), `vupload-${uploadId}`);
}

export async function POST(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let fd: FormData;
    try {
        fd = await req.formData();
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Upload parse failed: ${msg}` }, { status: 400 });
    }

    const uploadId = (fd.get("uploadId") as string) ?? "";
    const chunkIndex = parseInt((fd.get("chunkIndex") as string) ?? "-1", 10);
    const totalChunks = parseInt((fd.get("totalChunks") as string) ?? "-1", 10);
    const chunk = fd.get("chunk") as File | null;
    const fileName = (fd.get("fileName") as string) ?? "";

    if (!uploadId || !/^[a-zA-Z0-9_-]+$/.test(uploadId)) {
        return NextResponse.json({ error: "Invalid uploadId" }, { status: 400 });
    }
    if (!chunk || chunkIndex < 0 || totalChunks <= 0 || chunkIndex >= totalChunks) {
        return NextResponse.json({ error: "Invalid chunk params" }, { status: 400 });
    }

    const dir = chunkDir(uploadId);
    try {
        fs.mkdirSync(dir, { recursive: true });
        const target = path.join(dir, `chunk-${String(chunkIndex).padStart(6, "0")}`);
        fs.writeFileSync(target, Buffer.from(await chunk.arrayBuffer()));
        if (chunkIndex === 0 && fileName) {
            fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ fileName, totalChunks }));
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ error: `Write chunk failed: ${msg}` }, { status: 500 });
    }

    const received = fs.readdirSync(dir).filter((n) => n.startsWith("chunk-")).length;
    return NextResponse.json({ uploadId, received, total: totalChunks });
}
