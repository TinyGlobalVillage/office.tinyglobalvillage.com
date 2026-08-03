/**
 * Box Usage Monitor — the `host_metric_samples` table and its queries.
 *
 * SCHEMA OWNERSHIP: Office runs no migrations (see db-drizzle.ts — tgv.com owns
 * drizzle-kit). This file is the runtime definition; the DDL that creates the
 * table is checked in beside it at `sql/host-metric-samples.sql` and has to be
 * applied deliberately. Nothing here runs DDL — a monitor that silently
 * CREATEs against the shared prod DB is a worse problem than the one it solves.
 *
 * MULTI-BOX: every row carries `host`, so a second server is just more rows in
 * the same table and the same view — no schema change, no second query path.
 */
import "server-only";
import { pgTable, uuid, text, timestamp, doublePrecision, index } from "drizzle-orm/pg-core";
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./db-drizzle";
import {
  type HostSample,
  type Resource,
  computeCapacity,
  DEFAULTS,
} from "./host-metrics/compute";

export const hostMetricSamples = pgTable(
  "host_metric_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
    /** Which box. Scopes every query; the multi-box story lives on this column. */
    host: text("host").notNull(),
    cpuPct: doublePrecision("cpu_pct").notNull(),
    ramPct: doublePrecision("ram_pct").notNull(),
    diskPct: doublePrecision("disk_pct").notNull(),
    bwPct: doublePrecision("bw_pct").notNull(),
    /** Denormalised max of the four — the headline, stored so reads don't recompute. */
    worstPct: doublePrecision("worst_pct").notNull(),
    /** Which resource that max came from. */
    worst: text("worst").notNull(),
  },
  (t) => ({
    hostTsIdx: index("host_metric_samples_host_ts_idx").on(t.host, t.ts),
  }),
);

export type HostMetricRow = {
  ts: Date;
  host: string;
  cpuPct: number;
  ramPct: number;
  diskPct: number;
  bwPct: number;
  worstPct: number;
  worst: Resource;
};

/** Insert one sample; worstPct/worst are derived here so callers can't disagree. */
export async function insertSample(host: string, sample: HostSample): Promise<void> {
  const { worstPct, worst } = computeCapacity(sample);
  await db.insert(hostMetricSamples).values({
    host,
    cpuPct: sample.cpuPct,
    ramPct: sample.ramPct,
    diskPct: sample.diskPct,
    bwPct: sample.bwPct,
    worstPct,
    worst,
  });
}

/** Samples for a host, oldest first, within `sinceMs` of now. */
export async function readSeries(host: string, sinceMs: number): Promise<HostMetricRow[]> {
  const cutoff = new Date(Date.now() - sinceMs);
  const rows = await db
    .select()
    .from(hostMetricSamples)
    .where(and(eq(hostMetricSamples.host, host), gte(hostMetricSamples.ts, cutoff)))
    .orderBy(asc(hostMetricSamples.ts));
  return rows.map(toRow);
}

/** The most recent sample for a host, or null when nothing has been recorded. */
export async function readLatest(host: string): Promise<HostMetricRow | null> {
  const rows = await db
    .select()
    .from(hostMetricSamples)
    .where(eq(hostMetricSamples.host, host))
    .orderBy(desc(hostMetricSamples.ts))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

/** Every host that has ever reported — the multi-box picker reads this. */
export async function listHosts(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ host: hostMetricSamples.host })
    .from(hostMetricSamples)
    .orderBy(asc(hostMetricSamples.host));
  return rows.map((r) => r.host);
}

/** Retention prune. Returns how many rows went. */
export async function pruneOlderThan(
  days: number = DEFAULTS.retentionDays,
): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60_000);
  const res = await db
    .delete(hostMetricSamples)
    .where(lt(hostMetricSamples.ts, cutoff))
    .returning({ id: hostMetricSamples.id });
  return res.length;
}

/** Does the table exist? Lets callers degrade instead of throwing pre-DDL. */
export async function tableExists(): Promise<boolean> {
  try {
    const res = await db.execute(
      sql`SELECT to_regclass('public.host_metric_samples') AS reg`,
    );
    const rows = res.rows as Array<{ reg: string | null }>;
    return Boolean(rows[0]?.reg);
  } catch {
    return false;
  }
}

type RawRow = typeof hostMetricSamples.$inferSelect;

function toRow(r: RawRow): HostMetricRow {
  return {
    ts: r.ts,
    host: r.host,
    cpuPct: r.cpuPct,
    ramPct: r.ramPct,
    diskPct: r.diskPct,
    bwPct: r.bwPct,
    worstPct: r.worstPct,
    worst: r.worst as Resource,
  };
}
