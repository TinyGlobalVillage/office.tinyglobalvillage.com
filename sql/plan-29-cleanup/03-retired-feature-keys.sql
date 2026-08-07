-- 03-retired-feature-keys.sql — `cart`, `subscriptions` and `support` are toggles for tabs that
-- no longer exist.
--
-- WHAT THEY ARE. A `dashboard_features` row is a person's answer to "show this tab on this
-- dashboard". The tab itself comes from `FEATURE_REGISTRY` in `@tgv/module-dashboard`, forty keys.
-- These three are not among them and have not been for weeks; the pooled renderer's
-- `validRegistryKeys` refuses to PLACE a key it does not know, so the rows are inert — an answer to
-- a question nobody asks any more. The convergence ledger
-- (`scripts/feature-ledger.mjs`, built 2026-08-06) is what found them, and running it after this
-- file is how you confirm the sweep: `orphan rows` should read `—` on every site.
--
-- VERIFIED AGAINST THE REGISTRY RATHER THAN AGAINST THE REPORT. The three keys are exactly the
-- non-canon set in `public.dashboard_features` — there is no fourth, and every other key in the
-- table is one of the forty. `support` was a real configured surface (the Get Support button), now
-- served by `/api/forms/get-support` and the shared forms module rather than by a dashboard feature
-- key, so the capability moved and only the toggle dies. `cart` was presence-only, no panel.
-- `subscriptions` is Gio's alone, one row per dashboard.
--
-- THE COUNT IN THE PLAN IS SHORT, AND THE REASON IS IN THE MEASURING TOOL. Plan 29 reports these on
-- giocoelho, guardians, nevlo and refusionist. That is 11 rows. There are 32:
--
--     giocoelho                 3     cart, subscriptions, support
--     guardians                 4     cart ×2, subscriptions, support
--     nevlo                     1     support
--     refusionist               3     cart, subscriptions, support
--     [Tiny Global Village]     6     cart ×3, subscriptions, support ×2
--     (no site_id)             15     cart ×11, subscriptions, support ×3
--
-- The six on Tiny Global Village are missing from the ledger because the ledger's site list is
-- `select … from public.villager_sites where subdomain is not null`, and HQ's OWN `villager_sites`
-- row has a NULL subdomain (so does Demo Fliring's). The platform is a tenant of itself and the tool
-- built to see every tenant cannot see it. Worth fixing in `feature-ledger.mjs` — this file only
-- notes it, because a cleanup that quietly patches its own measuring instrument is not a cleanup.
-- The fifteen unkeyed ones the ledger does report, in its closing paragraph, as plan-29 material.
--
-- resonantweaver is absent from that table because
-- `sql/resonantweaver-migration/06-cutover-features.sql` already took her two, site-scoped,
-- deliberately leaving everyone else's for this file.
--
-- WHAT THIS FILE DOES NOT TOUCH, and it is more than it does. There are FIVE `dashboard_features`
-- tables in `tgv_db` — `public` plus a schema-local copy for each of demo_fliring, giocoelho,
-- refusionist and resonantweaver. The tenant copies hold 171 rows between them and 17 of those are
-- on these same three keys (refusionist 15, giocoelho 1, resonantweaver 1). They are out of scope
-- ON PURPOSE: resonantweaver is still served by her own process until the nginx flip and her app
-- reads HER schema's copy, so deleting from it would take two working tabs off a live dashboard —
-- the exact mistake 06's header talks itself out of. giocoelho and refusionist are pooled and their
-- copies look like dead weight, but "looks like" is not a reason to drop a tenant's rows. That is a
-- ruling, not a sweep.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/plan-29-cleanup/03-retired-feature-keys.sql
--
-- Runs as `tgv_app`, which owns the table. Re-runnable to zero, and independent of 02 in both
-- directions — the 15 unkeyed rows are in both files' scope and either may take them first.
--
-- REVERSAL: none is needed and none is possible. A row here is a boolean plus, for two of the 32,
-- a `configured_at` stamp; the tabs are already gone from the registry, so restoring the rows would
-- restore nothing visible.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'plan-29:retired-feature-keys', true);

-- Canon, as of `@tgv/module-dashboard` on 2026-08-06 — forty keys, transcribed from
-- `helpers/featureRegistry.ts`. A snapshot in a SQL file is a second source of truth and would
-- normally be the wrong thing to write; here it is the point. The assertion at the bottom compares
-- the table against THIS list, so the day the registry retires a forty-first key, this file fails
-- and names it instead of passing green over a fresh orphan. `feature-ledger.mjs` remains the LIVE
-- check — it imports the registry rather than copying it.
DROP TABLE IF EXISTS plan29_canon;
CREATE TEMP TABLE plan29_canon (feature_key text PRIMARY KEY);
INSERT INTO plan29_canon (feature_key) VALUES
  ('account'), ('analytics'), ('appointments'), ('blog'), ('booking'), ('course'),
  ('customer-transactions'), ('discount-referral'), ('documents'), ('editor'),
  ('email-campaigns'), ('events'), ('forms'), ('forums'), ('home'), ('invoicing'),
  ('meeting-room'), ('members'), ('page-editor'), ('performers'), ('products'), ('profile'),
  ('reviews'), ('seo'), ('sessions'), ('settings'), ('storage'), ('storefront'),
  ('stripe-config'), ('studio'), ('suggestions'), ('testimonials'), ('village'),
  ('village-blog'), ('village-forums'), ('village-listing'), ('village-reviews'),
  ('village-testimonials'), ('wallet'), ('yellowpages');

-- What is about to go, printed before it goes, per dashboard. The run's transcript should carry
-- this whether or not anybody reads the header.
SELECT COALESCE(s.subdomain, '[' || s.client_name || ']', '(no site)') AS dashboard,
       d.feature_key,
       count(*) AS rows
  FROM public.dashboard_features d
  LEFT JOIN public.villager_sites s ON s.id = d.site_id
 WHERE d.feature_key IN ('cart', 'subscriptions', 'support')
 GROUP BY 1, 2
 ORDER BY 1, 2;

-- Dropped first, and named per file, so 02 and 03 can be run down the same psql session.
DROP TABLE IF EXISTS plan29_before_03;
CREATE TEMP TABLE plan29_before_03 AS
SELECT (SELECT count(*) FROM public.dashboard_features) AS total,
       (SELECT count(*) FROM public.dashboard_features
         WHERE feature_key IN ('cart', 'subscriptions', 'support')) AS retired;

-- ── the delete ─────────────────────────────────────────────────────────────
-- Named literally rather than derived as "everything not in plan29_canon". Deriving it would make
-- this file delete whatever a future registry edit happens to orphan, silently and fleet-wide,
-- which is precisely the decision the header says belongs to a person. Three keys, named, and the
-- assertion below is what catches a fourth.
DELETE FROM public.dashboard_features
 WHERE feature_key IN ('cart', 'subscriptions', 'support');

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int; strays text; before_total bigint; before_retired bigint; after_total bigint;
BEGIN
  SELECT count(*) INTO n FROM public.dashboard_features
   WHERE feature_key IN ('cart', 'subscriptions', 'support');
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % retired-key row(s) still standing', n;
  END IF;

  -- THE ONE WORTH FAILING ON. Every key left in the table must be a key the platform still offers.
  -- Today that holds by measurement; if it stops holding, the right answer is a decision about the
  -- new orphan, not another silent pass.
  SELECT string_agg(DISTINCT d.feature_key, ', ' ORDER BY d.feature_key)
    INTO strays
    FROM public.dashboard_features d
   WHERE NOT EXISTS (SELECT 1 FROM plan29_canon c WHERE c.feature_key = d.feature_key);
  IF strays IS NOT NULL THEN
    RAISE EXCEPTION 'assert: dashboard_features still carries key(s) the registry does not offer: % — decide what they are before sweeping them', strays;
  END IF;

  -- The blast radius: exactly the rows counted, and not one more.
  SELECT total, retired INTO before_total, before_retired FROM plan29_before_03;
  SELECT count(*) INTO after_total FROM public.dashboard_features;
  IF before_total - after_total <> before_retired THEN
    RAISE EXCEPTION 'assert: expected to remove % row(s), removed %', before_retired, before_total - after_total;
  END IF;

  RAISE NOTICE 'assertions passed — % retired-key row(s) removed, % row(s) left, every key in canon',
    before_retired, after_total;
END $$;

SELECT COALESCE(s.subdomain, '[' || s.client_name || ']', '(no site)') AS dashboard,
       count(*) AS features
  FROM public.dashboard_features d
  LEFT JOIN public.villager_sites s ON s.id = d.site_id
 GROUP BY 1
 ORDER BY 1;

COMMIT;
