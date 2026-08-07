-- 06-cutover-features.sql — CUTOVER-PLAN §5b ruling 4: `support` and `cart` go.
--
-- SAFE TO RUN BEFORE THE FLIP — and the first draft of this header said the
-- opposite, so the correction is worth keeping. It read: "RUN THIS AT THE
-- CUTOVER, NOT BEFORE… deleting the rows while she is served by :3003 would
-- take two working tabs off a live dashboard." That assumed her live app reads
-- THIS table. It does not.
--
-- `resonantweaver_app` carries `search_path=resonantweaver, public` as a
-- per-database role setting (`pg_db_role_setting` — NOT `pg_roles.rolconfig`,
-- which is where the first look went and found nothing), and
-- `resonantweaver.dashboard_features` exists: 62 rows across 10 members. Her
-- `readFeatureState` queries the bare relation name, so every tab her live
-- dashboard draws comes from HER schema's copy. The rows below are in `public`,
-- which only HQ reads. Deleting them cannot change anything a visitor or a
-- member sees today.
--
-- Which also answers a question this migration had not asked: does the pooled
-- side lose those 10 members' toggles? No. All 62 rows in her schema are
-- `visible = true` — nobody has ever hidden a tab — and HQ's defs are
-- `defaultVisible`, so the pooled dashboard shows the same thing without them.
-- The 35 rows in `public` are one member's (Marthe's), seeded platform-side.
--
-- WHY THERE IS ANYTHING TO DELETE AT ALL. `mergeFeatureCatalog` merges the
-- shared catalog UNDER each host's own definitions and lets host-only keys pass
-- through — which is right (a bespoke `profile` engine has to survive it) and is
-- also why two keys the shared registry retired weeks ago kept appearing in her
-- Settings tab. Canon has 40 keys; `support` and `cart` are the only two her app
-- declares that canon does not, fleet-wide. Pooled, HQ supplies the definitions
-- and neither key exists, so the TABS go by themselves — these two rows are what
-- would be left behind, unreadable and unreachable, exactly the orphan shape
-- plan 29 is sweeping elsewhere.
--
-- WHAT SHE ACTUALLY LOSES, stated rather than glossed. `cart` is presence-only:
-- no panel, a stub. `support` was a real configured surface for her (the Get
-- Support button) — HQ serves Get Support through `/api/forms/get-support` and
-- the shared forms module rather than through a dashboard feature key, so the
-- capability moves; the toggle is what disappears.
--
-- Re-runnable, and ends in an assertion rather than a count nobody reads. Verify
-- afterwards with the ledger, which is the tool built to see this class of gap:
--   node scripts/feature-ledger.mjs --site resonantweaver
-- `orphan rows` should be empty where it read `cart, support`.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/06-cutover-features.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-06-cutover-features', true);

-- The two keys, scoped to HER site. Deliberately NOT a fleet-wide delete: the
-- same keys are orphaned on giocoelho, guardians, nevlo and refusionist too, and
-- that is plan 29's sweep with its own decision to take — not a side effect of
-- her cutover.
WITH site AS (
  SELECT id FROM public.villager_sites WHERE subdomain = 'resonantweaver'
)
DELETE FROM public.dashboard_features d
 USING site
 WHERE d.site_id = site.id
   AND d.feature_key IN ('support', 'cart');

DO $$
DECLARE
  n int;
  total int;
BEGIN
  SELECT count(*) INTO n
    FROM public.dashboard_features d
    JOIN public.villager_sites v ON v.id = d.site_id
   WHERE v.subdomain = 'resonantweaver'
     AND d.feature_key IN ('support', 'cart');
  IF n <> 0 THEN
    RAISE EXCEPTION 'resonantweaver still carries % retired feature row(s)', n;
  END IF;

  -- Nothing else of hers may have gone with them. She had 35 rows before this
  -- ran; a delete that took more than the two named keys is a bug, not a tidy-up.
  SELECT count(*) INTO total
    FROM public.dashboard_features d
    JOIN public.villager_sites v ON v.id = d.site_id
   WHERE v.subdomain = 'resonantweaver';
  IF total < 33 THEN
    RAISE EXCEPTION 'resonantweaver is down to % dashboard rows — expected 33 or more', total;
  END IF;

  -- The other tenants' orphans are plan 29's, and must still be here for it.
  RAISE NOTICE 'assertions passed — resonantweaver: % dashboard rows, 0 retired keys', total;
END $$;

SELECT d.feature_key, d.visible
  FROM public.dashboard_features d
  JOIN public.villager_sites v ON v.id = d.site_id
 WHERE v.subdomain = 'resonantweaver'
 ORDER BY d.feature_key;

COMMIT;
