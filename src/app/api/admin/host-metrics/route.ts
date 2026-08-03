// GET /api/admin/host-metrics?host=<name>&window=24h|7d|30d
//
// The whole snapshot BoxUsageControlModal renders, in one request: the live
// reading, the rolling averages, a bucketed series for the chart, the host
// list, the sampler's own health, and the current tunables.
//
// Degrades instead of failing. Before sql/host-metric-samples.sql is applied
// there is no table, so `ready` comes back false with `live` still populated
// from /proc — the modal can say "collection hasn't started" and still show the
// box's numbers right now, which is more useful than a 500.
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { listHosts, readLatest, readSeries, tableExists } from "@/lib/db-host-metrics";
import {
  WINDOWS,
  type WindowKey,
  bucketSeries,
  computeCapacity,
  evaluateThreshold,
  rollingAverages,
} from "@/lib/host-metrics/compute";
import { alertState } from "@/lib/host-metrics/alerts";
import { readConfig, hostName } from "@/lib/host-metrics/config";
import { readSampleIsolated } from "@/lib/host-metrics/read";
import { samplerStatus } from "@/lib/host-metrics/sampler";

export const dynamic = "force-dynamic";

/** Chart resolution. 96 points is a 15-minute bucket over 24h — plenty. */
const BUCKETS = 96;

function windowFromParam(raw: string | null): WindowKey {
  return raw === "7d" || raw === "30d" ? raw : "24h";
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const url = new URL(req.url);
  const host = url.searchParams.get("host") || hostName();
  const windowKey = windowFromParam(url.searchParams.get("window"));
  const cfg = readConfig();

  // A real /proc read, not the last stored row — opening the modal should show
  // the box as it is, not as it was up to five minutes ago. Isolated on
  // purpose: sharing the sampler's baseline would let UI polling rewrite what
  // window the next stored row actually covers.
  const liveSample = await readSampleIsolated(cfg.nicCapMbps).catch(() => null);
  const live = liveSample
    ? { ...liveSample, ...computeCapacity(liveSample) }
    : null;

  if (!(await tableExists())) {
    return NextResponse.json({
      ready: false,
      reason: "table-missing",
      host,
      hosts: [host],
      window: windowKey,
      live,
      latest: null,
      averages: { "24h": null, "7d": null, "30d": null },
      status: live ? evaluateThreshold(live.worstPct, cfg.warnPct, cfg.criticalPct) : null,
      series: [],
      sampler: samplerStatus(),
      alert: alertState(host),
      config: cfg,
    });
  }

  // 30d of history answers all three windows, so one query serves them all.
  const [series30d, latest, hosts] = await Promise.all([
    readSeries(host, WINDOWS["30d"]),
    readLatest(host),
    listHosts(),
  ]);

  const averages = rollingAverages(series30d);
  // Headline status follows the 24h average when there is one — a single spiky
  // sample shouldn't paint the tile red — and falls back to the live reading on
  // a box that has only just started reporting.
  const headline = averages["24h"] ?? live?.worstPct ?? null;

  return NextResponse.json({
    ready: true,
    host,
    hosts: hosts.length ? hosts : [host],
    window: windowKey,
    live,
    latest,
    averages,
    headlinePct: headline,
    status: headline === null ? null : evaluateThreshold(headline, cfg.warnPct, cfg.criticalPct),
    series: bucketSeries(series30d, WINDOWS[windowKey], BUCKETS),
    sampleCount: series30d.length,
    sampler: samplerStatus(),
    alert: alertState(host),
    config: cfg,
  });
}
