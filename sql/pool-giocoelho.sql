-- Pool giocoelho.com onto the shared HQ renderer (tenant-convergence plan 25/27).
--
-- WHY THIS IS SMALL, AND WHY IT GOES FIRST
-- The plan ordered section D by row count and put giocoelho last. That was the
-- wrong measure. What decides the cost of pooling a tenant is not how many rows
-- its private schema holds, it is how much of the SITE lives in the database
-- rather than in hand-written React. On that measure giocoelho is the only one
-- of the three that is ready:
--
--   giocoelho       6 pages already stored as page_models and rendered through
--                   the SAME shared kit HQ uses (createPublishedCatchAllPage →
--                   PageRenderer → the @tgv/module-page-editor catalog). The
--                   thin route files (`[lang]/about/page.tsx` et al) are mounts,
--                   not content. Its rows render on HQ unchanged.
--   demo-fliring    6 bespoke bilingual EN/NO pages, neon comedy-club design,
--                   one seed page_models row. Left standalone (Gio, 2026-08-03).
--   resonantweaver  23 hand-coded pages plus the starseed engine, which is still
--                   client-local `src/lib/starseed/` — there is no
--                   @tgv/module-starseed yet. Pooling it before plan 30–32
--                   extracts that package would delete the engine. Blocked.
--
-- WHAT THIS DOES
-- Copies giocoelho's own page + chrome rows out of its private schema into
-- `public`, keyed by `site='giocoelho'`, and gives its villager_sites row the
-- subdomain that makes `/u/giocoelho/*` resolve. Nothing that serves traffic
-- changes: giocoelho.com still reaches its own pm2 app until nginx is repointed.
-- That is deliberate (plan 37 — additive first, cutover last).
--
-- WHAT IT DOES NOT DO
-- It does not touch the private schema. The rows stay where they are, so the
-- rollback is "stop reading public" — restore the nginx vhost, `pm2 start`, and
-- giocoelho is exactly as it was. It also does not carry the pages that are NOT
-- in the database (resume, hemp, humandesign, playlists, blog/collections/course
-- surfaces); those are code and are listed in the final report, not silently
-- dropped.
--
-- Re-runnable: every step is guarded and ends in assertions that refuse to
-- commit while the tenant would not render.

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

-- The release trigger (plan 17) fires on every published row this inserts, so
-- giocoelho gets a real version-1 history the moment it pools. Name the author
-- honestly — without this the tile would credit the Postgres role.
SELECT set_config('app.actor', 'migration:pool-giocoelho', true);

-- 1 ── The subdomain. HQ resolves a pooled tenant two ways: by host (custom
--      domain → villager_sites.domain, which giocoelho.com already matches) and
--      by subdomain (/u/<sub>). The second is what the proxy rewrites INTO, so
--      without it every custom-domain hit rewrites to /u//… and 404s. Only fill
--      it when empty — never overwrite a name someone chose.
DO $$
DECLARE n int;
BEGIN
  UPDATE public.villager_sites
     SET subdomain = 'giocoelho'
   WHERE domain = 'giocoelho.com'
     AND coalesce(btrim(subdomain), '') = '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'subdomain set on % row(s)', n;
END $$;

-- 2 ── The pages. `public.page_models` is unique on
--      (slug, lang, mode, user_id, site), but user_id is NULL on every published
--      row and NULL is distinct from NULL in a btree unique index — so that
--      index would NOT stop a re-run from inserting a second copy. The guard has
--      to be explicit and null-safe, hence `IS NOT DISTINCT FROM`.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO public.page_models
    (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
  SELECT g.slug, g.lang, g.mode, g.user_id, g.deleted_at, g.title,
         g.is_public, g.in_nav, g.model_json, g.updated_at, 'giocoelho'
    FROM giocoelho.page_models g
   WHERE NOT EXISTS (
           SELECT 1 FROM public.page_models p
            WHERE p.site = 'giocoelho'
              AND p.slug = g.slug
              AND p.lang = g.lang
              AND p.mode = g.mode
              AND p.user_id IS NOT DISTINCT FROM g.user_id
         );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'pages copied: %', n;
END $$;

-- 3 ── The chrome. `navigation` and `footer` are the nav/footer dicts the
--      renderer falls back through (site → platform → base). `updated_at` is NOT
--      NULL with no default here, so it is carried across rather than defaulted.
DO $$
DECLARE n int;
BEGIN
  INSERT INTO public.content_overrides
    (key, lang, mode, user_id, data, updated_at, site)
  SELECT g.key, g.lang, g.mode, g.user_id, g.data, g.updated_at, 'giocoelho'
    FROM giocoelho.content_overrides g
   WHERE NOT EXISTS (
           SELECT 1 FROM public.content_overrides c
            WHERE c.site = 'giocoelho'
              AND c.key = g.key
              AND c.lang = g.lang
              AND c.mode = g.mode
              AND c.user_id IS NOT DISTINCT FROM g.user_id
         );
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'chrome overrides copied: %', n;
END $$;

-- 4 ── Assertions. Each one is a thing that, if false, means giocoelho.com would
--      serve a blank page or a 404 after the cutover. Failing here rolls the
--      whole file back rather than leaving a half-pooled tenant.
DO $$
DECLARE
  v_sub text; v_status text; n int; missing text;
BEGIN
  -- (a) resolvable: the row must have the subdomain AND a servable status, or
  --     resolveMemberBySubdomain returns null and the proxy bounces to the apex.
  SELECT subdomain, deploy_status INTO v_sub, v_status
    FROM public.villager_sites WHERE domain = 'giocoelho.com';
  IF v_sub IS DISTINCT FROM 'giocoelho' THEN
    RAISE EXCEPTION 'villager_sites.subdomain is % — /u/giocoelho will not resolve', coalesce(v_sub, '<null>');
  END IF;
  IF v_status NOT IN ('pending', 'deploying', 'live') THEN
    RAISE EXCEPTION 'deploy_status % is not servable — the resolver filters it out', v_status;
  END IF;
  RAISE NOTICE 'resolvable: subdomain=% status=%', v_sub, v_status;

  -- (b) nothing was left behind.
  SELECT count(*) INTO n FROM giocoelho.page_models g
   WHERE NOT EXISTS (
     SELECT 1 FROM public.page_models p
      WHERE p.site='giocoelho' AND p.slug=g.slug AND p.lang=g.lang
        AND p.mode=g.mode AND p.user_id IS NOT DISTINCT FROM g.user_id);
  IF n <> 0 THEN RAISE EXCEPTION '% page row(s) did not copy', n; END IF;

  SELECT count(*) INTO n FROM giocoelho.content_overrides g
   WHERE NOT EXISTS (
     SELECT 1 FROM public.content_overrides c
      WHERE c.site='giocoelho' AND c.key=g.key AND c.lang=g.lang
        AND c.mode=g.mode AND c.user_id IS NOT DISTINCT FROM g.user_id);
  IF n <> 0 THEN RAISE EXCEPTION '% chrome row(s) did not copy', n; END IF;

  -- (c) no duplicates — the null-user_id hole in the unique index means a bad
  --     re-run would show up here and nowhere else.
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM public.page_models WHERE site='giocoelho'
     GROUP BY slug, lang, mode, user_id HAVING count(*) > 1) d;
  IF n <> 0 THEN RAISE EXCEPTION '% duplicated page row(s) — the re-run guard failed', n; END IF;

  -- (d) readable the way HQ reads it: published, no user, not deleted. This is
  --     readPublishedPageWithFlags' exact filter — if a page misses it, the URL
  --     404s even though the row is sitting right there.
  SELECT string_agg(slug, ', ') INTO missing
    FROM giocoelho.page_models g
   WHERE g.mode = 'published'
     AND NOT EXISTS (
       SELECT 1 FROM public.page_models p
        WHERE p.site='giocoelho' AND p.slug=g.slug AND p.lang=g.lang
          AND p.mode='published' AND p.user_id IS NULL AND p.deleted_at IS NULL);
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'these published pages are not readable by HQ: %', missing;
  END IF;

  SELECT count(*) INTO n FROM public.page_models
   WHERE site='giocoelho' AND mode='published' AND user_id IS NULL AND deleted_at IS NULL;
  RAISE NOTICE 'pages HQ can serve at /u/giocoelho/<slug>: %', n;

  -- (e) the landing. /u/giocoelho with no branding.landingSlug reads 'home'.
  IF NOT EXISTS (
    SELECT 1 FROM public.page_models
     WHERE site='giocoelho' AND slug='home' AND lang='en'
       AND mode='published' AND user_id IS NULL AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'no published home page — the site root would 404';
  END IF;
  RAISE NOTICE 'landing page present';

  -- (f) the version history the pool created (plan 17/18 — Client Versions).
  SELECT count(*) INTO n FROM public.site_releases WHERE site='giocoelho';
  RAISE NOTICE 'site_releases captured for giocoelho: %', n;
END $$;

COMMIT;

-- What the tenant looks like now, for the record.
SELECT slug, lang, mode, is_public, in_nav
  FROM public.page_models WHERE site = 'giocoelho' ORDER BY slug, mode;
SELECT key, lang, mode FROM public.content_overrides WHERE site = 'giocoelho' ORDER BY key, mode;
SELECT id, client_name, subdomain, domain, deploy_status, tenant_app_slug
  FROM public.villager_sites WHERE domain = 'giocoelho.com';
