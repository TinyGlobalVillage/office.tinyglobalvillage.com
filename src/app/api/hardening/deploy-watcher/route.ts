// /api/hardening/deploy-watcher — System Hardening control for the deploy watcher.
//   GET → { ok, config, health, releases }
//   PUT → { enabled?, pollSec?, debounceSec?, maxBuildsPerHour?, smokeTimeoutSec?, targets?, follow? }
// The Mac's deploy-watch.sh (launchd) reads data/workshop/deploy-watch.json over ssh every
// poll, so a change here takes effect on the next tick. Values are sanitized server-side
// (they reach a shell on the Mac).
import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { logHardeningAction } from "@/lib/audit-log";
import {
  readWatcherConfig, writeWatcherConfig, sanitizeWatcherConfig, readWatcherHealth, readReleases,
  type WatcherConfig,
} from "@/lib/workshop-deploy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ ok: true, config: readWatcherConfig(), health: readWatcherHealth(), releases: readReleases() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  const body = (await req.json().catch(() => ({}))) as Partial<WatcherConfig>;
  const before = readWatcherConfig();
  const next = sanitizeWatcherConfig({ ...before, ...body, updatedBy: auth.username, updatedAt: new Date().toISOString() });
  if (next.targets.length === 0) return NextResponse.json({ error: "at least one target" }, { status: 400 });
  writeWatcherConfig(next);
  const changed: Record<string, unknown> = {};
  for (const k of ["enabled", "pollSec", "debounceSec", "maxBuildsPerHour", "smokeTimeoutSec", "targets", "follow"] as const) {
    if (JSON.stringify(before[k]) !== JSON.stringify(next[k])) changed[k] = { from: before[k], to: next[k] };
  }
  logHardeningAction({ action: "deploy-watcher.config.update", target: "deploy-watch.json", user: auth.username, success: true, details: changed });
  return NextResponse.json({ ok: true, config: next });
}
