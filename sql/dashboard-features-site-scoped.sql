-- dashboard-features-site-scoped.sql — a feature belongs to a DASHBOARD, not to a person.
--
-- Gio approved this, 2026-08-05, after the `profile` row would not settle.
--
-- WHAT WAS WRONG. `dashboard_features` was keyed `(user_id, feature_key)` — the PERSON'S
-- dashboard, as the birth seeder's own comment says. So a feature followed a member across every
-- site they own. Gio owns giocoelho AND refusionist; `profile` is proprietary to refusionist, and
-- a per-SITE cleanup predicate therefore inserted the row on one pass and deleted it on the other,
-- forever — `sql/dashboard-features-uniform.sql` reported INSERT 1 / DELETE 1 on every run instead
-- of settling. That file works around it by scoping to the PERSON ("keep profile for anyone who
-- owns at least one site it is proprietary to"), and says in its own comment that per-site grants
-- are not representable. This makes them representable.
--
-- It is the same shape `member_dashboard_layout` (0059) and `member_dashboard_prefs` (0060)
-- already have, and for the same reason: those two are keyed `(member_id, site_id)` because an
-- arrangement belongs to a dashboard. Which features are ON belongs to a dashboard too.
--
-- NULL site_id = the PLATFORM HOME (HQ, no active site), exactly as in its two siblings. A
-- nullable column cannot carry a primary key that dedupes — two NULLs are never equal in Postgres
-- — so the PK is replaced by a UNIQUE INDEX over COALESCE(site_id, zero-uuid), which is the same
-- expression both siblings' ON CONFLICT clauses already use.
--
-- THE BACKFILL FANS OUT AND KEEPS THE ORIGINAL. Every existing row is copied to each site the
-- member owns, and the original stays as the platform-home row. Nobody's dashboard changes: a
-- member with one site sees exactly what they saw, and a member with two now has two independent
-- sets instead of one shared one. Fanning out rather than MOVING is what makes this safe to run
-- while the old code is still deployed — the pre-change readers ignore site_id and still find the
-- original row.
--
-- ORDER, and the one window worth knowing about. Run this IMMEDIATELY BEFORE the deploy, not the
-- afternoon before. READS survive the gap in both directions — the old `WHERE user_id = $1` still
-- finds the platform-home row after the fan-out, and the new query works the moment the column
-- exists. WRITES do not: the deployed code says `ON CONFLICT (user_id, feature_key)`, and dropping
-- the primary key leaves nothing for that clause to infer from, so a feature TOGGLE between this
-- file and the deploy answers 500. Nothing is lost and nothing is corrupted — the row simply isn't
-- written — but the window should be a couple of minutes, not hours.
--
-- (Keeping the old key alongside the new one is not available: the fan-out deliberately creates
-- several rows per (user, feature), which is the entire point.)
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/dashboard-features-site-scoped.sql
--
-- Re-runnable. Running it twice changes nothing the second time.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:dashboard-features-site-scoped', true);

-- ── 1. the column ──────────────────────────────────────────────────────────
ALTER TABLE public.dashboard_features
  ADD COLUMN IF NOT EXISTS site_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dashboard_features'::regclass
       AND conname = 'dashboard_features_site_id_fkey'
  ) THEN
    -- ON DELETE CASCADE: a deleted site takes its dashboard's feature rows with it. The
    -- platform-home rows (site_id NULL) are untouched by any site deletion.
    ALTER TABLE public.dashboard_features
      ADD CONSTRAINT dashboard_features_site_id_fkey
      FOREIGN KEY (site_id) REFERENCES public.villager_sites(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN public.dashboard_features.site_id IS
  'Which DASHBOARD this feature toggle belongs to. NULL = the platform home (HQ, no active site) — same convention as member_dashboard_layout.site_id and member_dashboard_prefs.site_id. Before 2026-08-05 the table was keyed by person alone, so a feature followed an owner across every site they own.';

-- ── 2. re-key ──────────────────────────────────────────────────────────────
-- BEFORE the fan-out, and that ordering is load-bearing: with the old (user_id, feature_key)
-- primary key still in place, every copied row collides with the member's existing one and
-- `ON CONFLICT DO NOTHING` drops it. The first rehearsal of this file inserted 0 rows and failed
-- its own assertion with 288 missing — which is the whole reason the assertion is there.
--
-- The old PK cannot express the new identity, and a plain UNIQUE(user_id, site_id, feature_key)
-- would let a member accumulate unlimited duplicate platform-home rows (NULL <> NULL). The
-- COALESCE index is what both sibling tables already do, so the ON CONFLICT clauses match.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dashboard_features'::regclass
       AND conname = 'dashboard_features_pkey'
  ) THEN
    ALTER TABLE public.dashboard_features DROP CONSTRAINT dashboard_features_pkey;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_features_user_site_key_uq
  ON public.dashboard_features (
    user_id,
    (COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid)),
    feature_key
  );

-- Reads are "every feature for this dashboard", so index the pair the way they're queried.
CREATE INDEX IF NOT EXISTS dashboard_features_user_site_idx
  ON public.dashboard_features (user_id, site_id);

-- ── 3. the fan-out ─────────────────────────────────────────────────────────
-- One row per (person, owned site, feature), copied from the person's existing row. The original
-- stays put as the platform-home row. `DO NOTHING` makes the whole step idempotent AND means a
-- re-run can never clobber a toggle somebody has since changed on one of the fanned-out rows.
INSERT INTO public.dashboard_features (user_id, site_id, feature_key, visible, configured_at, config, created_at, updated_at)
SELECT df.user_id, v.site_id, df.feature_key, df.visible, df.configured_at, df.config, df.created_at, now()
  FROM public.dashboard_features df
  JOIN public.villager v ON v.member_id = df.user_id
  JOIN public.villager_sites s ON s.id = v.site_id
 WHERE df.site_id IS NULL
   AND s.subdomain IS DISTINCT FROM 'e2eproof9c93'
ON CONFLICT DO NOTHING;

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n int;
  dupes int;
BEGIN
  -- The identity actually holds.
  SELECT count(*) INTO dupes FROM (
    SELECT user_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid) AS s, feature_key
      FROM public.dashboard_features
     GROUP BY 1, 2, 3
    HAVING count(*) > 1
  ) d;
  IF dupes <> 0 THEN
    RAISE EXCEPTION 'assert: % duplicate (user, site, feature) triple(s)', dupes;
  END IF;

  -- Every owner/feature pair that existed before still exists for every site that owner has. This
  -- is the "nobody's dashboard changed" check, and it is the one worth failing on: the fan-out is
  -- the whole point of running this file.
  SELECT count(*) INTO n
    FROM public.dashboard_features df
    JOIN public.villager v ON v.member_id = df.user_id
    JOIN public.villager_sites s ON s.id = v.site_id
   WHERE df.site_id IS NULL
     AND s.subdomain IS DISTINCT FROM 'e2eproof9c93'
     AND NOT EXISTS (
       SELECT 1 FROM public.dashboard_features d2
        WHERE d2.user_id = df.user_id AND d2.site_id = v.site_id AND d2.feature_key = df.feature_key
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % owner/site/feature row(s) missing after the fan-out', n;
  END IF;

  -- The FK holds — a site_id that names nothing would be a row no dashboard can ever read.
  SELECT count(*) INTO n
    FROM public.dashboard_features df
   WHERE df.site_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.villager_sites s WHERE s.id = df.site_id);
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) point at a site that does not exist', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT COALESCE(s.subdomain, '(platform home)') AS dashboard,
       count(*) AS features,
       count(*) FILTER (WHERE df.visible) AS visible
  FROM public.dashboard_features df
  LEFT JOIN public.villager_sites s ON s.id = df.site_id
 GROUP BY 1
 ORDER BY 1;

COMMIT;
