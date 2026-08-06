-- 04-journey-row.sql — the journey takes its real URL.
--
-- `03-journey-preview.sql` authored the rf-journey section at slug
-- `journey-preview` so it could be driven beside the package still serving
-- `/journey`. It matched: same seven stops, same nine scroll markers, same
-- words, one viewport tall with no outer scroll, at 1440 and at 390. So the
-- package and its route are being deleted in the same change, and this moves
-- the row onto `/journey`.
--
-- ORDER. Run this BEFORE the deploy that removes the route, not after. While
-- `src/app/[lang]/journey/page.tsx` exists it shadows a page row of the same
-- slug, so the row sits unreachable and harmless; the moment the route goes,
-- the row is what answers. Run it the other way round and `/journey` 404s for
-- the length of a build.
--
-- The preview row is DELETED rather than left behind: two published rows with
-- the same section and different slugs is the duplicate-but-different pair that
-- starts drift, and `site_releases` keeps the history either way.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/04-journey-row.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-journey-row', true);

-- Idempotent by construction: if `journey` already exists this does nothing,
-- and the preview is dropped either way.
UPDATE public.page_models
   SET slug = 'journey',
       model_json = jsonb_set(model_json, '{slug}', '"journey"'),
       in_nav = false,
       updated_at = now()
 WHERE site = 'resonantweaver'
   AND slug = 'journey-preview'
   AND lang = 'en'
   AND mode = 'published'
   AND user_id IS NOT DISTINCT FROM NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.page_models p
      WHERE p.site = 'resonantweaver' AND p.slug = 'journey' AND p.lang = 'en'
        AND p.mode = 'published' AND p.user_id IS NOT DISTINCT FROM NULL
   );

DELETE FROM public.page_models
 WHERE site = 'resonantweaver'
   AND slug = 'journey-preview'
   AND lang = 'en'
   AND mode = 'published'
   AND user_id IS NOT DISTINCT FROM NULL;

DO $$
DECLARE
  n int;
  stops int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'resonantweaver' AND slug = 'journey' AND lang = 'en'
     AND mode = 'published' AND user_id IS NULL AND deleted_at IS NULL AND is_public;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected exactly one published journey row, found %', n;
  END IF;

  -- The row's own model must agree with its slug, or the editor writes back to
  -- the wrong place the first time anyone saves it.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'resonantweaver' AND slug = 'journey'
     AND model_json->>'slug' <> 'journey';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: the model still names the old slug';
  END IF;

  SELECT jsonb_array_length(s->'config'->'props'->'stops') INTO stops
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'journey' AND s->>'type' = 'rf-journey';
  IF stops IS DISTINCT FROM 7 THEN
    RAISE EXCEPTION 'assert: expected 7 stops on the journey section, found %', stops;
  END IF;

  -- It owns the viewport, so it must be the page's only section with no chrome
  -- around it. A journey with a nav bar over it is the defect this checks for.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'resonantweaver' AND slug = 'journey'
     AND (jsonb_array_length(model_json->'sections') <> 1
          OR model_json->'chrome'->>'navEnabled' <> 'false'
          OR model_json->'chrome'->>'footerEnabled' <> 'false');
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: the journey page is not a bare single-section page';
  END IF;

  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'resonantweaver' AND slug = 'journey-preview' AND deleted_at IS NULL;
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: the preview row is still here';
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT slug, title, is_public, in_nav,
       jsonb_array_length(model_json->'sections') AS sections
  FROM public.page_models
 WHERE site = 'resonantweaver' AND mode = 'published' AND user_id IS NULL
 ORDER BY slug;

COMMIT;
