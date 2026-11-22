// Migration snapshots — the Office side of mono utils/scripts/build-pipeline/migration-snapshots.sh.
//
// rcs-migrate.sh (every promote) pg_dumps what a destructive migration touches before applying it
// (policy "snapshot"). Office lists those snapshots, inspects them, restores them into restore_*
// scratch databases or in place, copies rows back, and edits the policy. Every postgres/root
// action runs through the CLI (execFile, no shell) — it sudo's to postgres itself and re-validates
// every path (under the snapshot dir), database name (mapped / restore_*) and table name.
// Office never opens a privileged connection of its own.
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import {
  coercePolicy, destructiveStatements, DB_RE, POLICY_DEFAULTS,
  type ScratchDb, type Snapshot, type SnapshotPolicy, type TableCount,
} from "./config";

export * from "./config";

const ROOT = process.env.REFUSION_ROOT || "/srv/refusion-core";
const SCRIPT = path.join(ROOT, "utils/scripts/build-pipeline/migration-snapshots.sh");
const POLICY_FILE = path.join(ROOT, "data/workshop/migrations-policy.json");
const MAP_FILE = path.join(ROOT, "data/workshop/deploy-map.json");

/** The cluster to act on: explicit env, else the port Office's own DATABASE_URL uses (5440 in a lane), else prod's. */
function pgPort(): string {
  if (process.env.MIGRATION_SNAPSHOTS_PGPORT) return process.env.MIGRATION_SNAPSHOTS_PGPORT;
  try {
    const u = new URL(process.env.DATABASE_URL || "");
    if (u.port) return u.port;
  } catch { /* no url */ }
  return "5432";
}

export class CliError extends Error {}

/** Run the CLI; resolves stdout, rejects with its stderr. */
export function cli(args: string[], timeoutMs = 120_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("bash", [SCRIPT, ...args], {
      cwd: ROOT,
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, REFUSION_ROOT: ROOT, MIGRATION_SNAPSHOTS_PGPORT: pgPort() },
    }, (err, stdout, stderr) => {
      if (err) reject(new CliError((stderr || err.message).trim().split("\n").slice(-6).join("\n")));
      else resolve(stdout);
    });
  });
}
const json = async <T>(args: string[], timeoutMs?: number): Promise<T> => JSON.parse((await cli(args, timeoutMs)).trim() || "null") as T;

export const installed = () => fs.existsSync(SCRIPT);
export const listSnapshots = () => json<Snapshot[]>(["list", "--json"]);
export const listScratch = () => json<ScratchDb[]>(["scratch"]);
export const inspect = (dump: string) => json<{ tables: string[]; whole: boolean }>(["inspect", dump]);
export const counts = (scratch: string) => json<TableCount[]>(["counts", scratch], 300_000);
export const rows = (scratch: string, table: string, limit: number, offset: number) =>
  json<Record<string, unknown>[]>(["rows", scratch, table, "--limit", String(limit), "--offset", String(offset)]);

/** The snapshot's index entry, looked up by path — the only way a dump path enters the CLI from Office. */
export async function findSnapshot(p: unknown): Promise<Snapshot> {
  if (typeof p !== "string") throw new CliError("snapshot path missing");
  const s = (await listSnapshots()).find((x) => x.path === p);
  if (!s) throw new CliError("not a known snapshot");
  if (s.purged) throw new CliError("that snapshot has been purged");
  return s;
}

/** Clients with mapped databases (deploy-map.json `databases`). */
export function mappedDatabases(): Record<string, string[]> {
  try {
    const j = JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) as { clients?: Record<string, { databases?: unknown }> };
    const out: Record<string, string[]> = {};
    for (const [c, v] of Object.entries(j.clients ?? {})) {
      const dbs = Array.isArray(v.databases) ? v.databases.filter((d): d is string => typeof d === "string" && DB_RE.test(d)) : [];
      if (dbs.length) out[c] = dbs;
    }
    return out;
  } catch {
    return {};
  }
}

function migrationsDir(client: string): string {
  try {
    const j = JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) as { clients?: Record<string, { migrations?: string }> };
    return j.clients?.[client]?.migrations || "src/db/migrations";
  } catch {
    return "src/db/migrations";
  }
}

/** The destructive statements of the migration a snapshot was taken for (read from the live checkout). */
export function migrationStatements(s: Snapshot): { found: boolean; statements: string[] } {
  if (!s.file || s.file.startsWith("(")) return { found: false, statements: [] };
  const base = path.resolve(ROOT, "clients", s.client, migrationsDir(s.client));
  const f = path.resolve(base, s.file);
  if (!f.startsWith(base + path.sep)) return { found: false, statements: [] };
  try {
    return { found: true, statements: destructiveStatements(fs.readFileSync(f, "utf8")) };
  } catch {
    return { found: false, statements: [] };
  }
}

export function readPolicy(): SnapshotPolicy {
  try {
    return coercePolicy(JSON.parse(fs.readFileSync(POLICY_FILE, "utf8")));
  } catch {
    return { ...POLICY_DEFAULTS };
  }
}

/** Merge into the policy file, keeping keys Office doesn't own (dir). */
export function writePolicy(patch: Partial<SnapshotPolicy>): SnapshotPolicy {
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(fs.readFileSync(POLICY_FILE, "utf8")); } catch { /* new file */ }
  const cur = coercePolicy(raw);
  const next = coercePolicy({ ...cur, ...patch }, cur);
  const tmp = `${POLICY_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ ...raw, ...next }, null, 2) + "\n", { mode: 0o664 });
  fs.renameSync(tmp, POLICY_FILE);
  return next;
}

/** restore_<yyyymmdd>_<hhmmss>_<db> — always a fresh name. */
export function scratchName(db: string): string {
  const t = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `restore_${t.slice(0, 8)}_${t.slice(8)}_${db}`.slice(0, 63);
}
