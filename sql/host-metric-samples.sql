-- Box Usage Monitor — host_metric_samples
--
-- Office runs NO migrations (tgv.com owns drizzle-kit; see src/lib/db-drizzle.ts),
-- so this DDL is applied deliberately rather than by a migration runner:
--
--   psql "$DATABASE_URL" -f sql/host-metric-samples.sql
--
-- Safe to re-run. The runtime definition lives in src/lib/db-host-metrics.ts —
-- keep the two in sync when a column changes.

CREATE TABLE IF NOT EXISTS public.host_metric_samples (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts         timestamptz      NOT NULL DEFAULT now(),
  -- Which box. Every query is scoped by it, so a second server is just more
  -- rows in this table — no schema change to go multi-box.
  host       text             NOT NULL,
  cpu_pct    double precision NOT NULL,
  ram_pct    double precision NOT NULL,
  disk_pct   double precision NOT NULL,
  bw_pct     double precision NOT NULL,
  -- Denormalised max of the four + which one it was: the headline is read far
  -- more often than it is written, so it is computed once on insert.
  worst_pct  double precision NOT NULL,
  worst      text             NOT NULL
);

-- Every read is "this host, this time window".
CREATE INDEX IF NOT EXISTS host_metric_samples_host_ts_idx
  ON public.host_metric_samples (host, ts);
