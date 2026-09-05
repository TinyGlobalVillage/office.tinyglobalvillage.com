-- 11-starseed-rows.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.
--
-- The Sun Walk and the Galactic Field Guide as page_models rows, at the exact
-- slugs they already answer on: `/sun-walk` and `/galactic-field-guide`. No
-- redirect and no parallel address, because the addresses are hers and were
-- never up for renaming.
--
-- THESE ROWS DO NOT ANSWER THOSE URLS YET, and that is the plan. Both paths
-- are in resonantweaver's SITE_SURFACES grant, so the proxy hands them to the
-- app routes under `app/[lang]/**` and never rewrites to the tenant path. The
-- route wins while the grant exists. W13 drops the grant and the routes in one
-- commit, and these rows answer the same URLs on the next request — nothing
-- else has to change, which is the point of seeding them public now.
--
-- They ARE public (`is_public = true`), which is how they can be walked at
-- /u/resonantweaver/<slug> for the parity pass before the cutover. That does
-- not double-list them: the sitemap route builds one Map keyed by path, fills
-- it from published+public rows, and only then adds a `SITEMAP_SURFACES` entry
-- `if (!seen.has(...))` — and both sides normalise to a trailing slash, so the
-- row and the grant line collapse onto the same key.
--
-- Idempotent: re-running inserts nothing. Safe to run before a verify pass.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/11-starseed-rows.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-starseed-rows', true);

-- sun-walk — one rf-sun-walk section carrying the three header strings.
INSERT INTO public.page_models
  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
SELECT 'sun-walk', 'en', 'published', NULL, NULL, 'Sun Walk', true, false,
       $rwss${
  "id": "pm-rw-sun-walk",
  "slug": "sun-walk",
  "title": "Sun Walk",
  "chrome": {
    "navEnabled": true,
    "footerEnabled": true
  },
  "sections": [
    {
      "id": "sec-sun-walk",
      "type": "rf-sun-walk",
      "label": "The Sun Walk",
      "blocks": [],
      "enabled": true,
      "config": {
        "props": {
          "eyebrow": "Perpetual calendar",
          "title": "The Sun Walk",
          "lead": "Each week of the year, the Sun walks through a fixed-star gateway — one of eight star currents. The walk is the same every year: a perpetual map of which current is singing now, and which star anchors it."
        }
      }
    }
  ]
}$rwss$::jsonb, now(), 'resonantweaver'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.page_models
    WHERE site = 'resonantweaver' AND slug = 'sun-walk' AND lang = 'en'
      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL
 );

-- galactic-field-guide — one rf-field-guide section carrying 3 plate pairs.
INSERT INTO public.page_models
  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
SELECT 'galactic-field-guide', 'en', 'published', NULL, NULL, 'Galactic Field Guide', true, false,
       $rwss${
  "id": "pm-rw-field-guide",
  "slug": "galactic-field-guide",
  "title": "Galactic Field Guide",
  "chrome": {
    "navEnabled": true,
    "footerEnabled": true
  },
  "sections": [
    {
      "id": "sec-field-guide",
      "type": "rf-field-guide",
      "label": "Galactic Field Guide",
      "blocks": [],
      "enabled": true,
      "config": {
        "props": {
          "theme": "nocturne",
          "readingSize": 1,
          "plates": {
            "lyra": {
              "subject": "/images/tenants/resonantweaver/fieldguide/lyra-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/lyra-habitat.jpg"
            },
            "pleiades": {
              "subject": "/images/tenants/resonantweaver/fieldguide/pleiades-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/pleiades-habitat.jpg"
            },
            "sirius": {
              "subject": "/images/tenants/resonantweaver/fieldguide/sirius-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/sirius-habitat.jpg"
            }
          }
        }
      }
    }
  ]
}$rwss$::jsonb, now(), 'resonantweaver'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.page_models
    WHERE site = 'resonantweaver' AND slug = 'galactic-field-guide' AND lang = 'en'
      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL
 );

-- Assert what landed, not that something landed: a pre-existing row at either
-- slug would have made the INSERT above a silent no-op, and this is what
-- notices.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'sun-walk' AND p.mode = 'published'
     AND s->>'type' = 'rf-sun-walk'
     AND s->'config'->'props'->>'title' = 'The Sun Walk';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-sun-walk section titled %, found %', 'The Sun Walk', n;
  END IF;

  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'galactic-field-guide' AND p.mode = 'published'
     AND s->>'type' = 'rf-field-guide'
     AND s->'config'->'props'->>'theme' = 'nocturne'
     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'plates')) = 3;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-field-guide section carrying 3 plate pairs, found %', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

COMMIT;
