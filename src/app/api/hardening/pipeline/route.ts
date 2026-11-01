// /api/hardening/pipeline — Utils → System Hardening → Pipeline.
//   GET  → { ok, pipeline, alerts: { episodes, sends }, samplerError }
//   POST → { action: "close-direct" }   ask RCS to close the go-direct route (the reaper does it within a minute)
//        | { action: "test" }           send a [TEST] pipeline alert on both channels
// Settings (alerts + directRoute) are saved through PUT /api/hardening/deploy-watcher:
// they live in the same deploy-watch.json the Mac and the RCS reaper read.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { hostMetricsState } from "@/lib/host-metrics/state";
import { pipelineAlertStatus, sendPipelineTest } from "@/lib/pipeline-alerts";
import { readPipeline, requestDirectClose } from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({
    ok: true,
    pipeline: readPipeline(),
    alerts: pipelineAlertStatus(),
    samplerError: hostMetricsState().lastPipelineError ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { action?: string };

  if (body.action === "test") {
    const rec = await sendPipelineTest(auth.username);
    return NextResponse.json({ ok: rec.frontDesk === "sent" || rec.email === "sent", send: rec });
  }

  if (body.action === "close-direct") {
    try {
      const dr = requestDirectClose(auth.username);
      logHardeningAction({ action: "pipeline.direct_close_request", target: dr.ip ?? "direct-route", user: auth.username, success: true, details: { openedAt: dr.openedAt, by: dr.by } });
      return NextResponse.json({ ok: true, directRoute: dr });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logHardeningAction({ action: "pipeline.direct_close_request", target: "direct-route", user: auth.username, success: false, details: msg });
      return NextResponse.json({ ok: false, error: msg }, { status: 409 });
    }
  }

  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}
