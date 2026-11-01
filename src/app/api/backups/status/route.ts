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
//   - pg_stat_archiver + `pgbackrest info --output=json` for the PITR tier

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { requireAdmin } from "@/lib/api-admin";

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

/* ── Point-in-time recovery (pgBackRest) ──────────────────────────────
 * Tier "pitr": continuous WAL archiving + full/diff base backups to two
 * repos (1 = local /var/lib/pgbackrest, 2 = rsync.net sftp, encrypted).
 * Archiving stays OFF until `pg-pitr-enable.sh --yes` restarts Postgres,
 * so "configured but not archiving" is a normal, reported state.
 */
type PitrRepo = { key: number; status: string; cipher: string; backups: number;
  latestLabel: string | null; latestType: string | null; latestTime: string | null; repoSizeBytes: number };
type PitrState = {
  installed: boolean; archiveMode: string | null; walLevel: string | null;
  archiver: { archivedCount: number; lastArchivedTime: string | null; failedCount: number; lastFailedTime: string | null } | null;
  repos: PitrRepo[]; walMin: string | null; walMax: string | null; error: string | null;
};
let pitrCache: { state: PitrState; at: number; mtime: number } | null = null;

async function pitrState(): Promise<PitrState> {
  const out: PitrState = { installed: false, archiveMode: null, walLevel: null, archiver: null,
    repos: [], walMin: null, walMax: null, error: null };
  try {
    const { stdout } = await pexec(
      `sudo -n -u postgres psql -qAtX -F '|' -c "select current_setting('archive_mode'), current_setting('wal_level'), archived_count, coalesce(last_archived_time::text,''), failed_count, coalesce(last_failed_time::text,'') from pg_stat_archiver"`,
      { timeout: 8000 },
    );
    const [am, wl, ac, lat, fc, lft] = stdout.trim().split("|");
    out.archiveMode = am || null;
    out.walLevel = wl || null;
    out.archiver = { archivedCount: Number(ac) || 0, lastArchivedTime: lat || null,
      failedCount: Number(fc) || 0, lastFailedTime: lft || null };
  } catch (e) { out.error = e instanceof Error ? e.message : String(e); }
  try {
    const { stdout } = await pexec("sudo -n -u postgres pgbackrest --stanza=main --output=json info", { timeout: 45000 });
    const stanza = JSON.parse(stdout)?.[0];
    out.installed = !!stanza;
    type B = { label: string; type: string; timestamp?: { stop?: number }; database?: { "repo-key"?: number };
      info?: { repository?: { delta?: number } } };
    const backups: B[] = stanza?.backup ?? [];
    for (const r of (stanza?.repo ?? []) as Array<{ key: number; cipher: string; status?: { message?: string } }>) {
      const mine = backups.filter((b) => b.database?.["repo-key"] === r.key);
      const last = mine[mine.length - 1];
      out.repos.push({
        key: r.key, status: r.status?.message ?? "unknown", cipher: r.cipher, backups: mine.length,
        latestLabel: last?.label ?? null, latestType: last?.type ?? null,
        latestTime: last?.timestamp?.stop ? new Date(last.timestamp.stop * 1000).toISOString() : null,
        repoSizeBytes: mine.reduce((n, b) => n + (b.info?.repository?.delta ?? 0), 0),
      });
    }
    const arch = (stanza?.archive ?? []) as Array<{ min: string | null; max: string | null }>;
    out.walMin = arch.map((a) => a.min).filter(Boolean).sort()[0] ?? null;
    out.walMax = arch.map((a) => a.max).filter(Boolean).sort().pop() ?? null;
  } catch (e) {
    out.error = out.error ?? (e instanceof Error ? e.message : String(e));
  }
  return out;
}

async function getCachedPitr(): Promise<PitrState> {
  const mtime = await manifestMtime();
  if (pitrCache && pitrCache.mtime === mtime && Date.now() - pitrCache.at < TIME_TTL_MS) return pitrCache.state;
  const state = await pitrState();
  pitrCache = { state, at: Date.now(), mtime };
  return state;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

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
    tier1: null, tier2: null, tier4: null, pitr: null,
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
  const [{ snapshots, stats, cached }, pitr] = await Promise.all([getCachedResticState(), getCachedPitr()]);

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
    pitr,
    restoreTest: {
      runs: restoreTest.length,
      latest: restoreTest[restoreTest.length - 1] ?? null,
    },
  });
}
