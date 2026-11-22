// Migration snapshots — shared shapes + CLAMPS (no node imports, so client components can use it).
// Server side: ./state.ts. The root/postgres work is mono utils/scripts/build-pipeline/migration-snapshots.sh.

export type SnapshotPolicy = {
  /** "snapshot": a destructive migration applies after a pg_dump of what it touches. "approve": it waits for Office. */
  destructive: "snapshot" | "approve";
  /** Snapshots older than this are purged (on the next destructive migration, or Purge now). */
  keepDays: number;
};
export const POLICY_DEFAULTS: SnapshotPolicy = { destructive: "snapshot", keepDays: 14 };
export const KEEP_DAYS_CLAMP: [number, number] = [1, 90];

export function coercePolicy(raw: unknown, base: SnapshotPolicy = POLICY_DEFAULTS): SnapshotPolicy {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const kd = typeof o.keepDays === "number" && Number.isFinite(o.keepDays)
    ? Math.trunc(Math.min(KEEP_DAYS_CLAMP[1], Math.max(KEEP_DAYS_CLAMP[0], o.keepDays)))
    : base.keepDays;
  return {
    destructive: o.destructive === "approve" || o.destructive === "snapshot" ? o.destructive : base.destructive,
    keepDays: kd,
  };
}

/** One line of index.jsonl, plus whether the dump file is still there. */
export type Snapshot = {
  at: string;
  client: string;
  db: string;
  file: string;
  sha256: string | null;
  tables: string;
  path: string;
  bytes: number;
  by: string;
  purged: boolean;
};
export type ScratchDb = { name: string; from: string | null; bytes: number };
export type TableCount = { table: string; rows: number };

/** Mirrors rcs-migrate.sh destructive_lines(): the statements that lose data or shape. */
export const DESTRUCTIVE_RE =
  /\b(DROP\s+(TABLE|COLUMN|SCHEMA|TYPE)\b|ALTER\s+TABLE\b[^;]*\bDROP\b|ALTER\s+(TABLE|COLUMN)\b[^;]*\bTYPE\b|TRUNCATE\b)/i;

export function destructiveStatements(sql: string): string[] {
  return sql
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && DESTRUCTIVE_RE.test(s))
    .map((s) => `${s};`);
}

/** Line diff (LCS) for the "shape then vs now" view. */
export type DiffLine = { kind: "same" | "then" | "now"; text: string };
export function lineDiff(a: string, b: string): DiffLine[] {
  const x = a.split("\n"), y = b.split("\n");
  const n = x.length, m = y.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { out.push({ kind: "same", text: x[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "then", text: x[i++] });
    else out.push({ kind: "now", text: y[j++] });
  }
  while (i < n) out.push({ kind: "then", text: x[i++] });
  while (j < m) out.push({ kind: "now", text: y[j++] });
  return out;
}

export const TABLE_RE = /^[a-z_][a-z0-9_]{0,62}\.[a-z_][a-z0-9_]{0,62}$/;
export const SCRATCH_RE = /^restore_[a-z0-9_]{1,54}$/;
export const DB_RE = /^[a-z_][a-z0-9_]{0,62}$/;
