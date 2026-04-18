import { type NextRequest } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { videoJobs } from "@/lib/video-jobs";

export async function GET(req: NextRequest) {
    const token = await requireAuth(req);
    if (!token) return new Response("Unauthorized", { status: 401 });

    const jobId = req.nextUrl.searchParams.get("jobId");
    if (!jobId) return new Response("Missing jobId", { status: 400 });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: object) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            const poll = async () => {
                const job = videoJobs.get(jobId);
                if (!job) {
                    send({ error: "Job not found" });
                    controller.close();
                    return;
                }
                send({ percent: job.percent, done: job.done, error: job.error });
                if (job.done) {
                    controller.close();
                    return;
                }
                setTimeout(poll, 500);
            };

            setTimeout(() => {
                try { controller.close(); } catch { /* ignore */ }
            }, 10 * 60 * 1000);

            await poll();
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
