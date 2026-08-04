-- pool-giocoelho-assets.sql — the half of pooling that isn't rows.
--
-- WHAT WENT WRONG AFTER pool-giocoelho.sql. That migration copied 12 page rows
-- and 4 chrome rows into public, every assertion passed, and the site still
-- came out wrong the moment a browser rendered it: every photograph on it was
-- a broken-image box. The models carry APP-RELATIVE srcs — `/images/fitness/
-- pose-scorpion.jpg` — which resolved against giocoelho's OWN Next app and
-- resolve against nothing on the shared renderer. The SQL layer cannot see
-- this; only the browser can. (Plan 38 says exactly that, and this is the
-- second defect it has caught on this one site.)
--
-- WHERE THEY GO. `/images/tenants/<site>/…` — HQ's existing home for a pooled
-- tenant's assets, already holding guardians' and nevlo's photographs, served
-- by the very process that renders the page. The files are committed alongside
-- this migration; this only rewrites the pointers.
--
-- AND THE BACKGROUND. giocoelho.com has a starfield behind every page. It lived
-- in that app's layout, so pooling the PAGES left it behind and the site came
-- up flat black — content correct, site unrecognisable. `siteBackground` is the
-- new site-scoped override key that carries it (see readSiteBackground.ts); the
-- capture trigger versions it like any other published chrome.
--
-- RE-RUNNABLE. Every step is guarded or self-idempotent: the replaces no longer
-- match once applied, and the insert is a NOT EXISTS. Note content_overrides
-- has NO unique index on (key, lang, mode, user_id, site) — the guard is the
-- only thing standing between a re-run and a duplicate row, and it has to be
-- null-safe (`IS NOT DISTINCT FROM`) because published rows carry user_id NULL
-- and NULL = NULL is never true.
--
--   psql -d tgv_db -f sql/pool-giocoelho-assets.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:pool-giocoelho-assets', true);

-- ── 1. page models: app-relative asset paths → the tenant asset home ────────
--
-- A text-level replace on the jsonb, because these srcs sit at several
-- different depths (section props, block props, gallery item arrays) and a
-- structural rewrite would need a path for each. The patterns are specific
-- enough that nothing else can match them: they are absolute, they name a
-- directory that only exists in giocoelho's app, and the statement is already
-- scoped to `site = 'giocoelho'`.
WITH rewritten AS (
  UPDATE public.page_models
     SET model_json = replace(
           replace(
             replace(model_json::text, '"/images/fitness/', '"/images/tenants/giocoelho/fitness/'),
             '"/images/flyers/', '"/images/tenants/giocoelho/flyers/'),
           '"/images/recipes/', '"/images/tenants/giocoelho/recipes/')::jsonb,
         updated_at = now()
   WHERE site = 'giocoelho'
     AND model_json::text ~ '"/images/(fitness|flyers|recipes)/'
  RETURNING 1
)
SELECT 'page rows with assets rewritten: ' || count(*) FROM rewritten;

-- ── 2. the nav logo ────────────────────────────────────────────────────────
--
-- Same problem, one field: the dict points at `/images/logo/anchor-circle-
-- square-crop.png`. It was being DROPPED rather than shown broken (usableLogo
-- refuses an app-relative src), so the nav has been wearing the wordmark alone.
-- The copy under the tenant asset home is resized to 256px — the original is a
-- 1024x1024, 1.4MB PNG for a mark that renders at about 40px, and page weight
-- is the tenant's to pay on every single page.
WITH relogo AS (
  UPDATE public.content_overrides
     SET data = jsonb_set(
           data,
           '{logo}',
           (data->'logo')
             || jsonb_build_object(
                  'src', '/images/tenants/giocoelho/logo/anchor-circle-256.png',
                  'filename', 'anchor-circle-256.png',
                  'width', 256,
                  'height', 256,
                  'sizeBytes', 87870
                )
         ),
         updated_at = now()
   WHERE site = 'giocoelho'
     AND key = 'navigation'
     AND data->'logo'->>'src' = '/images/logo/anchor-circle-square-crop.png'
  RETURNING 1
)
SELECT 'nav logo rows repointed: ' || count(*) FROM relogo;

-- ── 3. the site background ─────────────────────────────────────────────────
--
-- `color` is the image's own dark tone (sampled: the 10th-percentile pixel of
-- void.avif), so the page settles to the right colour while a 1920x2880 image
-- decodes instead of flashing white, and so the site still looks like itself if
-- the image ever fails to load.
WITH ins AS (
  INSERT INTO public.content_overrides (key, lang, mode, user_id, site, data, updated_at)
  SELECT 'siteBackground', 'en', 'published', NULL, 'giocoelho',
         jsonb_build_object(
           'image', '/images/tenants/giocoelho/backgrounds/void.avif',
           'color', '#09111c',
           'fit', 'cover',
           'position', '50% 50%'
         ),
         now()
   WHERE NOT EXISTS (
     SELECT 1 FROM public.content_overrides c
      WHERE c.key = 'siteBackground'
        AND c.lang = 'en'
        AND c.mode = 'published'
        AND c.site = 'giocoelho'
        AND c.user_id IS NOT DISTINCT FROM NULL
   )
  RETURNING 1
)
SELECT 'site background rows inserted: ' || count(*) FROM ins;

-- ── 4. assertions — refuse to commit on anything half-done ─────────────────

DO $$
DECLARE
  n int;
BEGIN
  -- Nothing app-relative left anywhere in giocoelho's models.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'giocoelho'
     AND model_json::text ~ '"/images/(fitness|flyers|recipes|logo|backgrounds)/';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % giocoelho page row(s) still carry an app-relative asset path', n;
  END IF;

  -- Every asset the models DO name now lives under the tenant asset home.
  SELECT count(*) INTO n
    FROM public.page_models p,
         LATERAL regexp_matches(
           p.model_json::text,
           '"(/[^"[:space:]]+\.(?:png|jpg|jpeg|webp|avif|svg|gif))"', 'g') AS t(m)
   WHERE p.site = 'giocoelho'
     AND m[1] NOT LIKE '/images/tenants/giocoelho/%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % giocoelho asset reference(s) point outside the tenant asset home', n;
  END IF;

  -- The nav carries a logo the shared renderer will keep (tenantChromeLayers'
  -- usableLogo accepts absolute URLs and this one prefix, nothing else).
  SELECT count(*) INTO n
    FROM public.content_overrides
   WHERE site = 'giocoelho' AND key = 'navigation'
     AND data->'logo'->>'src' LIKE '/images/tenants/giocoelho/%';
  IF n = 0 THEN
    RAISE EXCEPTION 'assert: no giocoelho nav row carries a servable logo';
  END IF;

  -- Exactly one published background, readable through the same filter
  -- readPublishedSiteBackground uses.
  SELECT count(*) INTO n
    FROM public.content_overrides
   WHERE key = 'siteBackground' AND lang = 'en' AND mode = 'published'
     AND site = 'giocoelho' AND user_id IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected exactly 1 published giocoelho background, found %', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT 'site_releases captured: ' || count(*)
  FROM public.site_releases WHERE site = 'giocoelho';

COMMIT;
