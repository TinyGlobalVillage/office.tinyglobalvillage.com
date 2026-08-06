-- dashboard-features-uniform.sql — every tenant gets every feature.
--
-- Gio's ruling, 2026-08-05: "every tenant should have all of the features right
-- now, because they're all my projects and Marthe's. We have customized
-- nothing." So this makes the fleet uniform instead of accidental.
--
-- WHY IT WAS NOT. `dashboard_features` rows are seeded at site birth, and the
-- seeder that grants a site's CHILD features (`featuresForBirth` +
-- `seedDashboardFeatures`, plan 19) shipped 2026-08-03. Four of the six sites
-- were created before that — resonantweaver 2026-06-16, refusionist 06-18,
-- giocoelho 06-21, nevlo 07-10 — so they carry only whatever happened to be
-- written at the time. resonantweaver had the seven tab-level keys and none of
-- the Editor tab's children, which is why that tab drew empty for her: every
-- tile on it is a child feature. nevlo had one row in total.
--
-- (`villager_sites.modules` is NOT the cause and is not fixed here — it is `{}`
-- on every site including the ones with full dashboards, so it has never been
-- what fed anyone's tabs.)
--
-- WHAT IS SEEDED. Every key in the dashboard feature registry
-- (`@tgv/module-dashboard/helpers/featureRegistry.ts`), with two exclusions the
-- REGISTRY ITSELF declares — honoured rather than overridden, because they are
-- product rules and not drift:
--
--   • `account`  — `customerOnly: true`. It is a customer's tab, not an
--                  operator's; seeding it onto an owner's dashboard would put a
--                  tab there that the registry says does not belong to them.
--   • `profile`  — `proprietaryTo: ["refusionist", "resonantweaver"]`. The
--                  profile engines are granted per site in code (PROFILE_ENGINES),
--                  so on any other site this tab would open an engine that host
--                  is not entitled to. Seeded for those two only.
--
-- Legacy keys already in the table that the registry no longer knows (`cart`,
-- `support`, `subscriptions`) are left exactly as they are. They render nothing
-- and removing them is a separate decision.
--
-- ALL VISIBLE, which is the part that differs from the birth seeder. That one is
-- `ON CONFLICT DO NOTHING` on purpose, so re-driving provisioning cannot undo a
-- member's toggle. This is not provisioning — it is an explicit instruction to
-- make everything visible right now — so it UPDATES `visible` to true. Exactly
-- one row in the fleet was false when this was written; if someone has since
-- turned something off deliberately, this turns it back on, and that is what was
-- asked for.
--
-- `e2eproof9c93` is excluded: an end-to-end test fixture, not a project.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/dashboard-features-uniform.sql
--
-- Re-runnable. Running it twice changes nothing the second time.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:dashboard-features-uniform', true);

CREATE TEMP TABLE _feature_keys (feature_key text PRIMARY KEY, all_sites boolean)
  ON COMMIT DROP;

INSERT INTO _feature_keys (feature_key, all_sites) VALUES
  -- tabs
  ('home', true), ('settings', true), ('editor', true), ('booking', true),
  ('storefront', true), ('village', true), ('wallet', true),
  ('sessions', true), ('performers', true),
  -- Editor children — the ones that were missing
  ('page-editor', true), ('members', true), ('yellowpages', true),
  ('testimonials', true), ('reviews', true), ('forums', true),
  ('documents', true), ('forms', true), ('blog', true),
  ('email-campaigns', true), ('storage', true),
  -- Booking children
  ('appointments', true), ('meeting-room', true), ('invoicing', true),
  -- Store Front children
  ('events', true), ('studio', true), ('course', true), ('products', true),
  ('discount-referral', true), ('analytics', true), ('stripe-config', true),
  ('customer-transactions', true),
  -- Village children
  ('suggestions', true),
  -- proprietary: seeded only where the registry allows it
  ('profile', false);

CREATE TEMP TABLE _owners (member_id uuid, subdomain text) ON COMMIT DROP;

INSERT INTO _owners
SELECT DISTINCT v.member_id, s.subdomain
  FROM public.villager_sites s
  JOIN public.villager v ON v.site_id = s.id
 WHERE s.subdomain IS NOT NULL
   AND s.subdomain <> 'e2eproof9c93';

-- ── insert what is missing ─────────────────────────────────────────────────
INSERT INTO public.dashboard_features (user_id, feature_key, visible, created_at, updated_at)
SELECT o.member_id, k.feature_key, true, now(), now()
  FROM _owners o
  CROSS JOIN _feature_keys k
 WHERE (k.all_sites OR o.subdomain IN ('refusionist', 'resonantweaver'))
ON CONFLICT (user_id, feature_key) DO NOTHING;

-- ── and switch on anything already there but hidden ────────────────────────
UPDATE public.dashboard_features df
   SET visible = true, updated_at = now()
  FROM _owners o, _feature_keys k
 WHERE df.user_id = o.member_id
   AND df.feature_key = k.feature_key
   AND (k.all_sites OR o.subdomain IN ('refusionist', 'resonantweaver'))
   AND df.visible IS DISTINCT FROM true;

-- ── and take back the one feature that was never everyone's ────────────────
-- `profile` is on giocoelho and guardians from a bulk seed dated 2026-06-21,
-- before the registry declared it `proprietaryTo: ["refusionist",
-- "resonantweaver"]`. The assertion below caught it on the first run of this
-- file, which is the only reason it is known.
--
-- It is removed rather than left, and that is not a contradiction of "all
-- tenants the same": the profile ENGINES are granted per site in code
-- (PROFILE_ENGINES), so on giocoelho and guardians this tab opens an engine
-- those sites are not entitled to and renders nothing. A dead tab on a
-- customer's dashboard is worse than no tab. Uniform WITHIN the product rule,
-- not uniform through it.
--
-- SCOPED TO THE PERSON, NOT THE SITE, and the first re-run is what taught me
-- that. `dashboard_features` is keyed by (user_id, feature_key) — it is the
-- PERSON'S dashboard, as the birth seeder's own comment says — so a member who
-- owns a proprietary site AND an ordinary one appears twice in `_owners`. A
-- per-site predicate then inserted `profile` on one pass and deleted it on the
-- other, forever: the file reported INSERT 1 / DELETE 1 on every run instead of
-- settling. Gio owns both giocoelho and refusionist, so this was live.
--
-- The rule a per-person table can actually express is: keep `profile` for anyone
-- who owns AT LEAST ONE site it is proprietary to. That is a real limitation
-- worth knowing — per-SITE feature grants are not representable here at all —
-- and it is why the two dashboards this cleans up belonged to owners with no
-- proprietary site of their own.
DELETE FROM public.dashboard_features df
 WHERE df.feature_key = 'profile'
   AND EXISTS (SELECT 1 FROM _owners o WHERE o.member_id = df.user_id)
   AND NOT EXISTS (
     SELECT 1 FROM _owners o2
      WHERE o2.member_id = df.user_id
        AND o2.subdomain IN ('refusionist', 'resonantweaver')
   );

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n int;
  expected int;
BEGIN
  -- Every owner has every all-sites key, visible.
  SELECT count(*) INTO n
    FROM _owners o
    CROSS JOIN _feature_keys k
   WHERE k.all_sites
     AND NOT EXISTS (
       SELECT 1 FROM public.dashboard_features df
        WHERE df.user_id = o.member_id AND df.feature_key = k.feature_key AND df.visible
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % owner/feature pair(s) missing or hidden', n;
  END IF;

  -- The Editor tab draws from child features; an owner with none draws an empty
  -- tab, which is the defect this file exists to fix. Check it by name.
  SELECT count(*) INTO n
    FROM _owners o
   WHERE NOT EXISTS (
     SELECT 1 FROM public.dashboard_features df
      WHERE df.user_id = o.member_id AND df.visible
        AND df.feature_key IN ('blog','forms','testimonials','reviews','forums','storage','documents','email-campaigns')
   );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % owner(s) still have an empty Editor tab', n;
  END IF;

  -- The registry's own gates are respected, not overridden.
  SELECT count(*) INTO n
    FROM public.dashboard_features df
    JOIN _owners o ON o.member_id = df.user_id
   WHERE df.feature_key = 'profile'
     AND NOT EXISTS (
       SELECT 1 FROM _owners o2
        WHERE o2.member_id = df.user_id
          AND o2.subdomain IN ('refusionist', 'resonantweaver')
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: profile leaked onto % site(s) it is not proprietary to', n;
  END IF;

  SELECT count(*) INTO n
    FROM public.dashboard_features df
    JOIN _owners o ON o.member_id = df.user_id
   WHERE df.feature_key = 'account';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: the customer-only account tab was seeded onto % owner(s)', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT o.subdomain,
       count(*) FILTER (WHERE df.visible) AS visible_features
  FROM _owners o
  JOIN public.dashboard_features df ON df.user_id = o.member_id
 GROUP BY o.subdomain
 ORDER BY o.subdomain;

COMMIT;
