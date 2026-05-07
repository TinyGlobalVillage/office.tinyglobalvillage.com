// GET /api/backups/status
// Returns the read-only state of the backup system: provider config, last-run
// info per tier, repo size, snapshot count, cron-active status, encryption
// key presence. NO secrets ever.
//
// Read sources:
//   - data/backups/config.json (provider, schedule, retention, encryption refs)
//   - data/backups/manifest.json (one JSON line per backup run)
//   - /etc/cron.d/rcs-backups{,.disabled} existence (cron-active)
//   - file existence checks for restic password + GPG pubkey (no values)
//   - `restic snapshots --json` for live repo state (best-effort, may time out)

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const pexec = promisify(exec);

const CONFIG_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/config.json";
const MANIFEST_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/manifest.json";
const RESTORE_TEST_PATH = "/srv/refusion-core/clients/office.tinyglobalvillage.com/data/backups/restore-test-history.json";

async function fileExists(p: string): Promise<boolean> {
  try { await fs.access(p); return true; } catch { return false; }
}

async function readJsonl(p: string): Promise<unknown[]> {
  try {
    const text = await fs.readFile(p, "utf8");
    return text.split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter((x) => x !== null);
  } catch { return []; }
}

/* ── Caching for the slow restic-over-SFTP calls ──────────────────────
 * snapshots + stats each take ~2-5s round-trip to Zurich. Cache server-side
 * and invalidate when the manifest.json mtime changes (i.e., a backup just
 * ran). Falls back to time-based 5min TTL if mtime unavailable.
 */
type ResticCache = {
  snapshots: { ok: boolean; count: number; latestId: string | null; latestTime: string | null; error?: string };
  stats: { ok: boolean; totalSizeBytes: number; error?: string };
  cachedAt: number;
  manifestMtimeMs: number;
};
let resticCache: ResticCache | null = null;
const TIME_TTL_MS = 5 * 60 * 1000;

async function manifestMtime(): Promise<number> {
  try { const s = await fs.stat(MANIFEST_PATH); return s.mtimeMs; } catch { return 0; }
}

async function resticSnapshots(): Promise<{ ok: boolean; count: number; latestId: string | null; latestTime: string | null; error?: string }> {
  try {
    const { stdout } = await pexec(
      'bash -lc "source /home/admin/.restic/env && restic snapshots --json --no-lock"',
      { timeout: 30000 }
    );
    const arr = JSON.parse(stdout);
    if (!Array.isArray(arr)) return { ok: false, count: 0, latestId: null, latestTime: null, error: "non-array response" };
    const latest = arr[arr.length - 1];
    return {
      ok: true,
      count: arr.length,
      latestId: latest?.id?.slice(0, 8) ?? null,
      latestTime: latest?.time ?? null,
    };
  } catch (e) {
    return { ok: false, count: 0, latestId: null, latestTime: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function resticStats(): Promise<{ ok: boolean; totalSizeBytes: number; error?: string }> {
  try {
    const { stdout } = await pexec(
      'bash -lc "source /home/admin/.restic/env && restic stats --json --no-lock"',
      { timeout: 30000 }
    );
    const obj = JSON.parse(stdout);
    return { ok: true, totalSizeBytes: obj.total_size ?? 0 };
  } catch (e) {
    return { ok: false, totalSizeBytes: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

async function getCachedResticState() {
  const mtime = await manifestMtime();
  const now = Date.now();
  if (
    resticCache &&
    resticCache.manifestMtimeMs === mtime &&
    now - resticCache.cachedAt < TIME_TTL_MS
  ) {
    return { snapshots: resticCache.snapshots, stats: resticCache.stats, cached: true };
  }
  const [snapshots, stats] = await Promise.all([resticSnapshots(), resticStats()]);
  resticCache = { snapshots, stats, cachedAt: now, manifestMtimeMs: mtime };
  return { snapshots, stats, cached: false };
}

export async function GET() {
  const config = JSON.parse(await fs.readFile(CONFIG_PATH, "utf8"));
  const manifest = await readJsonl(MANIFEST_PATH);
  const restoreTest = await readJsonl(RESTORE_TEST_PATH);

  // Cron active = file exists at non-disabled path
  const cronActive = await fileExists(config.cron.filePath);
  const cronDisabledExists = await fileExists(config.cron.disabledPath);

  // Secret presence checks (never read values)
  const resticPasswordExists = await fileExists(config.encryption.resticPasswordPath);
  const gpgPubkeyExists = await fileExists(config.encryption.gpgEscrowPubkeyPath);

  // Latest run per tier (from manifest)
  const lastRunByTier: Record<string, { timestamp: string; status: string; snapshotId?: string; sizeBytes?: number } | null> = {
    tier1: null, tier2: null, tier4: null,
  };
  for (const entry of manifest as Array<{ tier?: string; timestamp: string; status: string; snapshot_id?: string; total_size_bytes?: number }>) {
    if (!entry.tier) continue;
    const prev = lastRunByTier[entry.tier];
    if (!prev || entry.timestamp > prev.timestamp) {
      lastRunByTier[entry.tier] = {
        timestamp: entry.timestamp,
        status: entry.status,
        snapshotId: entry.snapshot_id?.slice(0, 8),
        sizeBytes: entry.total_size_bytes,
      };
    }
  }

  // Live repo state — cached server-side, invalidated on manifest mtime change
  // (i.e., whenever a backup just ran). Falls back to 5min TTL.
  const { snapshots, stats, cached } = await getCachedResticState();

  return NextResponse.json({
    _cached: cached,
    config,
    cron: {
      active: cronActive,
      disabledFileExists: cronDisabledExists,
      configuredCorrectly: cronActive || cronDisabledExists,
    },
    secrets: {
      resticPasswordConfigured: resticPasswordExists,
      gpgEscrowPubkeyImported: gpgPubkeyExists,
    },
    lastRunByTier,
    repo: {
      reachable: snapshots.ok,
      snapshotCount: snapshots.count,
      latestSnapshotId: snapshots.latestId,
      latestSnapshotTime: snapshots.latestTime,
      totalSizeBytes: stats.totalSizeBytes,
      error: snapshots.error || stats.error || null,
    },
    restoreTest: {
      runs: restoreTest.length,
      latest: restoreTest[restoreTest.length - 1] ?? null,
    },
  });
}
