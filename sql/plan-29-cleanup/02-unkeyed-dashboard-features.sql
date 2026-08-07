-- 02-unkeyed-dashboard-features.sql — the 195 rows with no site, and the reason they are dead.
--
-- WHAT THEY ARE. `sql/dashboard-features-site-scoped.sql` gave `dashboard_features` a `site_id` on
-- 2026-08-05 and fanned every existing row out to each site its owner owns, deliberately KEEPING
-- the original as the platform-home row — NULL `site_id`, the same convention
-- `member_dashboard_layout` and `member_dashboard_prefs` use. The unique index is over
-- `(user_id, COALESCE(site_id, '000…0'), feature_key)`, so a NULL site is legal, not corruption.
-- These 195 are those kept originals: 13 user_ids, 36 keys.
--
-- THE PREMISE THIS FILE WAS HANDED, AND WHY IT IS ONLY HALF TRUE. Plan 29 and the convergence
-- ledger both say the same thing — "since the table was re-keyed by site, these can never be read
-- back." That is a claim about the READER, so it was checked against the reader, and the reader
-- disagrees. `readFeatureState` in HQ's `dashboard/page.tsx`, and the GET in
-- `api/dashboard/features/route.ts` beside it, both match on
-- `COALESCE(site_id, '000…0') = COALESCE($siteId, '000…0')`. When `$siteId` is NULL that expression
-- selects EXACTLY these rows. And `getActiveSiteId` (`lib/sites/site-prefs.ts`) returns NULL in one
-- documented case: `if (sites.length === 0) return null`, a member who neither owns (`villager`) nor
-- staffs (`villager_clients`) a single site. So for a member with no site, the NULL-site rows are
-- not unreachable — they are the only rows their dashboard reads, and the toggle API writes them.
--
-- WHICH MEANS THE 195 SPLIT THREE WAYS, not one, and only the first way is the ledger's:
--
--     145   the member operates at least one site, so `getActiveSiteId` can never return NULL for
--           them and the row genuinely cannot be read. Gio (36), Marthe (35), N.Ev.Lo. (33),
--           Gio Coelho (33), the TGV admin account (8).
--      42   the member is SOFT-DELETED — `members.deleted_at` set 2026-06-30. The five
--           `employeeN@tinyglobalvillage.com` seed accounts and `claude@anthropic.com`, seven rows
--           each. Zero sites, so these rows WOULD be live if the account were.
--       8   the `user_id` names nobody at all. `d86da929-…` (7 rows) and `41b709b9-…` (1 row) are
--           absent from `members` and from every sibling member table; `dashboard_features` has no
--           foreign key on `user_id`, which is how that became possible and why it went unnoticed.
--
-- So all 195 are safe to delete, and NOT ONE of them is safe to delete for the reason the plan gave.
-- The distinction is not pedantry: the day a real customer signs up and owns nothing, they get
-- NULL-site rows that are live, and a sweep written to the plan's premise would wipe their
-- dashboard. This file deletes by the three real reasons and asserts the invariant that follows
-- from them, so re-running it in six months is safe rather than lucky.
--
-- NOTHING NEEDS KEYING, and that was checked row by row rather than assumed. For every one of the
-- 145, a keyed twin already exists with an IDENTICAL `visible` and an IDENTICAL `config` — zero
-- rows differ on either. The fan-out did its job and nobody has toggled a platform-home row since.
-- Step 1 below is therefore a no-op TODAY. It is still here, and it is not decoration: it is the
-- rule for the case the header's third paragraph describes, a single-site member holding an
-- unkeyed row with no twin, which is exactly what a future stray write would look like. It keys
-- what it can attribute unambiguously — one operable site, no existing row there — and carries
-- `visible`, `config` and `configured_at` across so a configured suite is not silently un-configured.
--
-- WHAT THIS FILE WILL NOT GUESS AT. Gio operates five sites and Marthe four; an unkeyed row of
-- theirs names no site by any rule, so if one ever lacked a twin it would fall to step 2's third
-- class (operates ≥ 1 site → unreadable) and be deleted, not spread across every dashboard they
-- have. Fanning out a second time is how the original oscillation started.
--
-- ONE THING FOR A HUMAN, noted rather than fixed. Both Gio and Marthe operate `nevlo` as STAFF, and
-- neither has a single keyed row there — the fan-out joined `villager` (ownership) only. Their nevlo
-- dashboards have been falling back to `defaultVisible` since 2026-08-05. That is a consequence of
-- the re-key, not of this file, and whether staff should inherit an owner's toggles is a ruling.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/plan-29-cleanup/02-unkeyed-dashboard-features.sql
--
-- Runs as `tgv_app`, which owns the table. Re-runnable to zero. Independent of 03 in both
-- directions: the 15 rows the two files have in common may be deleted by either, in either order.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'plan-29:unkeyed-dashboard-features', true);

-- The membership predicate, written ONCE. It has to mean exactly what `listMemberSites` means, or
-- the "can this member's active site ever be NULL" question gets a different answer here than the
-- app gets: owner rows from `villager` UNION staff rows from `villager_clients`, registered or
-- active. A pure customer is excluded there and must be excluded here — buying from a store is not
-- operating one.
DROP VIEW IF EXISTS plan29_operates;
CREATE TEMP VIEW plan29_operates AS
SELECT DISTINCT member_id, site_id FROM (
  SELECT member_id, site_id, 'owner' AS role, status FROM public.villager
  UNION ALL
  SELECT member_id, site_id, CASE WHEN is_staff THEN 'staff' ELSE 'customer' END, status
    FROM public.villager_clients
) m
WHERE role IN ('owner', 'staff') AND status IN ('registered', 'active');

-- Counted before anything moves, so the assertions can compare against this run rather than against
-- a constant that stops being true the moment 03 runs first. Dropped first, and named per file, so
-- running 02 and 03 down the SAME psql session works — which is how anybody rehearsing all three
-- will run them.
DROP TABLE IF EXISTS plan29_before_02;
CREATE TEMP TABLE plan29_before_02 AS
SELECT (SELECT count(*) FROM public.dashboard_features WHERE site_id IS NULL)     AS unkeyed,
       (SELECT count(*) FROM public.dashboard_features WHERE site_id IS NOT NULL) AS keyed;

SELECT * FROM plan29_before_02;

-- ── 1. attribute what can be attributed ────────────────────────────────────
-- Zero rows today, by measurement. An unkeyed row is attributable only when the member operates
-- EXACTLY ONE site and holds no row for that key there — anything else is a guess. `DO NOTHING` is
-- belt-and-braces against the unique index; the NOT EXISTS already covers it.
INSERT INTO public.dashboard_features (user_id, site_id, feature_key, visible, configured_at, config, created_at, updated_at)
SELECT d.user_id, o.site_id, d.feature_key, d.visible, d.configured_at, d.config, d.created_at, now()
  FROM public.dashboard_features d
  JOIN LATERAL (
    SELECT site_id FROM plan29_operates p WHERE p.member_id = d.user_id
  ) o ON true
 WHERE d.site_id IS NULL
   AND (SELECT count(*) FROM plan29_operates p WHERE p.member_id = d.user_id) = 1
   AND NOT EXISTS (
     SELECT 1 FROM public.dashboard_features k
      WHERE k.user_id = d.user_id AND k.site_id = o.site_id AND k.feature_key = d.feature_key
   )
ON CONFLICT DO NOTHING;

-- ── 2. delete what is dead, by the reason it is dead ───────────────────────
-- Three predicates, one DELETE, deliberately not `WHERE site_id IS NULL`. A row that satisfies none
-- of the three is a LIVE platform-home row belonging to somebody who can read it, and it survives
-- this file on purpose.
DELETE FROM public.dashboard_features d
 WHERE d.site_id IS NULL
   AND (
        -- (a) the user_id names nobody
        NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = d.user_id)
        -- (b) the member is soft-deleted
     OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = d.user_id AND m.deleted_at IS NOT NULL)
        -- (c) the member operates at least one site, so their active site is never NULL and this
        --     row is genuinely unreadable — the ledger's case, which turns out to be the smaller
        --     half of the three
     OR EXISTS (SELECT 1 FROM plan29_operates p WHERE p.member_id = d.user_id)
   );

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int; survivors text; before_keyed bigint; after_keyed bigint; before_unkeyed bigint;
BEGIN
  -- THE INVARIANT. Every `site_id IS NULL` row still standing belongs to a live member with no
  -- operable site — someone whose dashboard actually reads it. This is what makes the file safe to
  -- re-run: it resolves to "nothing left" today and to "nothing WRONG left" forever.
  SELECT count(*) INTO n
    FROM public.dashboard_features d
   WHERE d.site_id IS NULL
     AND (NOT EXISTS (SELECT 1 FROM public.members m WHERE m.id = d.user_id)
          OR EXISTS (SELECT 1 FROM public.members m WHERE m.id = d.user_id AND m.deleted_at IS NOT NULL)
          OR EXISTS (SELECT 1 FROM plan29_operates p WHERE p.member_id = d.user_id));
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % unreadable platform-home row(s) survived the delete', n;
  END IF;

  -- Not an error, but it must never be silent: a surviving NULL-site row means a real member owns
  -- nothing, and the next person to read this table needs to know that is legitimate.
  SELECT string_agg(DISTINCT coalesce(m.email, d.user_id::text), ', ')
    INTO survivors
    FROM public.dashboard_features d
    LEFT JOIN public.members m ON m.id = d.user_id
   WHERE d.site_id IS NULL;
  IF survivors IS NOT NULL THEN
    RAISE NOTICE 'kept the platform-home rows of: % — live members with no site, whose dashboard reads exactly these', survivors;
  END IF;

  -- The blast radius. Step 1 may ADD keyed rows (zero today); nothing here may ever remove one.
  SELECT keyed, unkeyed INTO before_keyed, before_unkeyed FROM plan29_before_02;
  SELECT count(*) INTO after_keyed FROM public.dashboard_features WHERE site_id IS NOT NULL;
  IF after_keyed < before_keyed THEN
    RAISE EXCEPTION 'assert: keyed rows fell from % to % — this file must never delete a row that names a site',
      before_keyed, after_keyed;
  END IF;

  -- The identity the whole re-key rests on.
  SELECT count(*) INTO n FROM (
    SELECT user_id, COALESCE(site_id, '00000000-0000-0000-0000-000000000000'::uuid) AS s, feature_key
      FROM public.dashboard_features GROUP BY 1, 2, 3 HAVING count(*) > 1
  ) dupes;
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % duplicate (user, site, feature) triple(s)', n;
  END IF;

  RAISE NOTICE 'assertions passed — % unkeyed row(s) before, % keyed row(s) before, % keyed after',
    before_unkeyed, before_keyed, after_keyed;
END $$;

SELECT COALESCE(s.subdomain, '[' || s.client_name || ']', '(no site)') AS dashboard,
       count(*) AS features
  FROM public.dashboard_features d
  LEFT JOIN public.villager_sites s ON s.id = d.site_id
 GROUP BY 1
 ORDER BY 1;

COMMIT;
