import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { videoJobs } from "@/lib/video-jobs";
import fs from "fs";

export async function GET(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

    const job = videoJobs.get(jobId);
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    if (!job.done) return NextResponse.json({ error: "Job not done yet" }, { status: 202 });
    if (job.error) return NextResponse.json({ error: job.error }, { status: 500 });
    if (!job.outPath || !fs.existsSync(job.outPath)) {
        return NextResponse.json({ error: "Output file missing" }, { status: 404 });
    }

    const buf = fs.readFileSync(job.outPath);
    // Clean up output file after serving
    try { fs.unlinkSync(job.outPath); } catch { /* ignore */ }
    videoJobs.delete(jobId);

    return new NextResponse(buf, {
        headers: {
            "Content-Type": job.outMime,
            "Content-Disposition": `attachment; filename="${job.baseName}-converted${job.outExt}"`,
        },
    });
}
