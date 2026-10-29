// Deploy Benchmarks API — the deploy clock, joined (src/lib/deploy-bench.ts).
// GET ?client=X → runs (newest first), per-step trend, live run, expectation, link tests, config.
// POST { action: "speedtest" } → ask the Mac's watcher for a full link test.
// POST { action: "config", config } → thresholds (upload warn, contended RSS, trend window).
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import { SITE_RE, releaseTargets } from "@/lib/workshop-deploy";
import {
  readRuns, trend, expectation, liveRun, readLinkTests, speedTestPending, requestSpeedTest,
  readBenchConfig, writeBenchConfig, sanitizeBenchConfig, type BenchConfig,
} from "@/lib/deploy-bench";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const clients = [...releaseTargets().map((t) => t.client), "_dists"];
  const client = req.nextUrl.searchParams.get("client") || clients[0];
  if (!SITE_RE.test(client) && client !== "_dists") return NextResponse.json({ error: "bad client" }, { status: 400 });
  const config = readBenchConfig();
  const runs = readRuns(client, config);
  return NextResponse.json({
    ok: true, client, clients, config,
    runs: runs.slice(0, 40),
    trend: trend(runs, config),
    expect: expectation(runs),
    live: liveRun(runs),
    linkspeed: readLinkTests(),
    speedtestPending: speedTestPending(),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as { action?: string; config?: Partial<BenchConfig> };
  if (body.action === "speedtest") {
    requestSpeedTest(auth.username);
    logHardeningAction({ action: "deploy.speedtest", target: "link", user: auth.username, success: true });
    return NextResponse.json({ ok: true, pending: true });
  }
  if (body.action === "config") {
    const config = sanitizeBenchConfig({ ...readBenchConfig(), ...(body.config ?? {}) });
    writeBenchConfig(config);
    logHardeningAction({ action: "deploy.bench.config", target: "deploy-bench", user: auth.username, success: true, details: config });
    return NextResponse.json({ ok: true, config });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
