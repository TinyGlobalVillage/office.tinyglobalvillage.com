export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { videoJobs, videoProcs } from "@/lib/video-jobs";

export async function POST(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "Missing jobId" }, { status: 400 });

  const job = videoJobs.get(jobId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  job.cancelled = true;
  const proc = videoProcs.get(jobId);
  if (proc && !proc.killed) {
    try { proc.kill("SIGKILL"); } catch { /* ignore */ }
  }
  videoProcs.delete(jobId);

  return NextResponse.json({ ok: true });
}
