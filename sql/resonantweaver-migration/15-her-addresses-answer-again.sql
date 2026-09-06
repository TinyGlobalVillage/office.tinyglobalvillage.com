-- 15 — the six addresses that stopped answering
--
-- Gio 2026-09-05: "none of her links are working anymore".
--
-- Measured against `baseline/her-app-2026-08-10b.tgz`, the frozen capture of
-- her own app: it has 25 routes and every one of them answered 200. On the
-- pooled site today, 14 answer 404. That is the complaint, and it is bigger
-- than the three dead links a crawl of the live pages finds, because a page
-- that is itself unreachable takes its own outbound links out of the crawl
-- with it.
--
-- Every 404 is a `page_models` row that exists, is fully authored, and is
-- simply not published — nine of them soft-deleted in a 110-second burst on
-- 2026-09-03 and one more on 2026-09-04, with no decision recorded for any of
-- them in this directory, in CUTOVER-PLAN, or in the checklist. The migration's
-- own writing points the other way: `siteRedirects.ts` sends three legacy
-- `experience/*` URLs to `offer/*` targets and argues at length that a
-- redirect to a 404 "is worse than the plain 404 because it looks fixed" —
-- and two of those three targets are among the unpublished.
--
-- WHAT THIS FILE PUBLISHES, and why exactly these six. The rule is closure,
-- not enthusiasm: a page goes live only if something live already points at
-- it, and then everything IT points at must be live too, or publishing it
-- would mint new 404s where there were none.
--
--   1. landing-star-preview/experience/all-products   ← linked from /receive/
--   2. landing-star-preview/offer/pearl-chamber       ← linked from /receive/,
--                                                       and the redirect target
--                                                       for experience/pearl-chamber
--   3. pearl-chamber                                  ← linked from /receive/,
--                                                       and from (2)
--   4. landing-star-preview/offer/galactic-pendulum   ← the redirect target for
--                                                       experience/galactic-pendulum,
--                                                       which 308s into a 404 today
--   5. landing-star-preview/offer/galactic-initiation           ← linked from (1)
--   6. landing-star-preview/offer/galactic-integration-session  ← linked from (1)
--
-- (5) and (6) are here only because (1) is: her offering map lists them, so
-- publishing the map without them would trade two old 404s for two new ones.
-- With these six the set is closed — every internal href on every live page of
-- hers resolves, and so does every rule in SITE_REDIRECTS.
--
-- WHAT THIS FILE DELIBERATELY LEAVES ALONE. Six more of her routes stay 404,
-- because nothing live links to them and publishing a page is a decision about
-- her site, not a repair of it:
--
--   home-classic  — CUTOVER-PLAN already rules on this one: "her kept-aside old
--                   landing … It is hers to bring back, not ours to port."
--   journey       — The Seven Gates. A real component (rf-journey, L1→L2 in the
--                   conversion track) with a real row, unlinked since the hub
--                   dropped its door.
--   writing       — two sections, unlinked.
--   offer/awareness-and-perception-training, offer/extended-starseed-profile,
--   offer/meeting-your-galactic-self-meditation — three offers her own offering
--                   map does not list.
--
-- These are Gio's to call, and the switch is one line of this file away.
--
-- Nav is untouched: every row here keeps in_nav = false, so the balloon menu
-- and her navbar are exactly as they were.

BEGIN;

UPDATE page_models
   SET is_public  = true,
       deleted_at = NULL,
       updated_at = now()
 WHERE site = 'resonantweaver'
   AND mode = 'published'
   AND slug IN (
     'landing-star-preview/experience/all-products',
     'landing-star-preview/offer/pearl-chamber',
     'pearl-chamber',
     'landing-star-preview/offer/galactic-pendulum',
     'landing-star-preview/offer/galactic-initiation',
     'landing-star-preview/offer/galactic-integration-session'
   );

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM page_models
   WHERE site = 'resonantweaver' AND mode = 'published' AND is_public
     AND deleted_at IS NULL
     AND slug IN ('landing-star-preview/experience/all-products',
                  'landing-star-preview/offer/pearl-chamber',
                  'pearl-chamber',
                  'landing-star-preview/offer/galactic-pendulum',
                  'landing-star-preview/offer/galactic-initiation',
                  'landing-star-preview/offer/galactic-integration-session');
  IF n <> 6 THEN
    RAISE EXCEPTION 'expected 6 published rows, found %', n;
  END IF;
  RAISE NOTICE 'six addresses answer again';
END $$;

COMMIT;

-- Rollback, exactly as it was before this file ran:
--
--   UPDATE page_models SET is_public = false
--    WHERE site='resonantweaver' AND mode='published'
--      AND slug IN ('landing-star-preview/experience/all-products',
--                   'landing-star-preview/offer/pearl-chamber',
--                   'pearl-chamber',
--                   'landing-star-preview/offer/galactic-pendulum',
--                   'landing-star-preview/offer/galactic-initiation',
--                   'landing-star-preview/offer/galactic-integration-session');
--   UPDATE page_models SET deleted_at = '2026-08-15 01:54:19.580997-05'
--    WHERE site='resonantweaver' AND mode='published' AND slug='pearl-chamber';
--   UPDATE page_models SET deleted_at = '2026-09-04 09:32:56.94-05'
--    WHERE site='resonantweaver' AND mode='published' AND slug='landing-star-preview/offer/galactic-pendulum';
--   UPDATE page_models SET deleted_at = '2026-09-03 00:46:03.733-05'
--    WHERE site='resonantweaver' AND mode='published' AND slug='landing-star-preview/offer/galactic-initiation';
--   UPDATE page_models SET deleted_at = '2026-09-03 00:46:39.899-05'
--    WHERE site='resonantweaver' AND mode='published' AND slug='landing-star-preview/offer/galactic-integration-session';
