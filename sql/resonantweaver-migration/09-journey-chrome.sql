-- 09-journey-chrome.sql — the journey page puts her chrome back on.
--
-- The journey row was authored with nav and footer OFF on the theory that a
-- section owning the viewport should be the only thing on the page. Her live
-- /journey/ says otherwise, measured on the 2026-08-09 parity pass: the nav
-- pill FLOATS over the sealed experience (adding no height — rf-journey's
-- globals zero the body's nav padding while mounted, so enabling the nav does
-- not push the viewport down), and the footer sits BELOW the 100svh container
-- as real outer scroll: her page is 1012px tall at a 900px viewport, and the
-- missing 112px was the whole reason the differ paired only 2 of her 9 bands.
--
-- rf-journey's own [data-powered-by] hide (Gio's 2026-08-05 ruling) is
-- untouched: that line is the PLATFORM's attribution; the "Powered by Tiny
-- Global Village LLC™" she shows lives inside her OWN footer chrome rows.
--
-- Idempotent: jsonb_set is absolute, the re-run is a no-op.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/09-journey-chrome.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-journey-chrome', true);

UPDATE public.page_models
   SET model_json = jsonb_set(
         jsonb_set(model_json, '{chrome,navEnabled}', 'true'::jsonb),
         '{chrome,footerEnabled}', 'true'::jsonb),
       updated_at = now()
 WHERE site = 'resonantweaver'
   AND slug = 'journey'
   AND lang = 'en'
   AND mode = 'published'
   AND user_id IS NOT DISTINCT FROM NULL
   AND (model_json->'chrome'->>'navEnabled' IS DISTINCT FROM 'true'
        OR model_json->'chrome'->>'footerEnabled' IS DISTINCT FROM 'true');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'resonantweaver' AND slug = 'journey' AND lang = 'en'
     AND mode = 'published' AND user_id IS NULL AND deleted_at IS NULL AND is_public
     AND model_json->'chrome'->>'navEnabled' = 'true'
     AND model_json->'chrome'->>'footerEnabled' = 'true';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one published journey row wearing her chrome, found %', n;
  END IF;

  -- The experience itself must be untouched: one rf-journey section, 7 stops.
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'journey' AND p.mode = 'published'
     AND s->>'type' = 'rf-journey'
     AND jsonb_array_length(s->'config'->'props'->'stops') = 7;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: the rf-journey section moved, found % matching', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

COMMIT;
