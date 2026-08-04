-- pool-giocoelho-pages.sql — the pages that were code, re-authored as blocks.
--
-- WHY THESE THREE AND NOT ALL NINE. pool-giocoelho.sql carried the six pages
-- that were already page_models rows. The rest of giocoelho.com is hand-written
-- React with no row to copy, so pooling would simply delete their URLs — and
-- /fitness links to /resume in its own copy, so one of them is a live internal
-- link that would 404 the moment nginx moves. Gio's ruling (2026-08-04) was
-- re-author before cutover rather than break URLs and fix later.
--
-- Three of them are content and become blocks cleanly. The others are not
-- pages at all and are written up in the plan rather than faked here:
--
--   playlists (+ /[category] + /[category]/[playlistId]) — a Spotify browser
--     reading data/spotify-playlists.json at request time, with owner-only
--     editing, share links and nested dynamic routes. That is an application.
--   fitnesstools/timer — a password-gated class timer, noindex, with its own
--     cookie gate. Also an application, and one Gio teaches with.
--   recipes/paodequeijo/print — the SAME recipe with a print stylesheet. The
--     pooled /recipes/paodequeijo already carries every ingredient and step;
--     authoring a second copy would be two rows to keep in step forever.
--   demo — a developer scratch page rendering one CurvedTrapezoid. Not content.
--
-- ONE THING TO KNOW ABOUT /humandesign. Its content is an event — a live Q&A on
-- Wed 22 Oct 2025 — and a name/email signup. The copy is carried across as it
-- stands, because the whole point of pooling is that Gio can now edit it in the
-- studio instead of in a repo. The SIGNUP FORM is deliberately not recreated:
-- form-live needs a forms-module form id, and standing up a live email-capture
-- endpoint for an event ten months past is a decision, not a migration step.
--
-- RE-RUNNABLE. Guarded by an explicit null-safe NOT EXISTS on the same tuple
-- page_models_slug_lang_mode_user_site_uq names — the index cannot do this job
-- because published rows carry user_id NULL and NULL is distinct from NULL.
--
--   psql -d tgv_db -f sql/pool-giocoelho-pages.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:pool-giocoelho-pages', true);

-- ── the three models ───────────────────────────────────────────────────────

CREATE TEMP TABLE _gio_pages (slug text, title text, model jsonb) ON COMMIT DROP;

-- /resume — the timeline the fitness page links to. story-timeline is the same
-- catalog block nevlo's history uses, so this is one shared component rather
-- than giocoelho's bespoke TimelineComponent carried over.
INSERT INTO _gio_pages VALUES (
  'resume',
  'Resume',
  jsonb_build_object(
    'id', 'pm-resume',
    'slug', 'resume',
    'title', 'Resume',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-resume-timeline',
        'type', 'story-timeline',
        'label', 'Timeline',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'eyebrow', 'Resume',
          'heading', 'Timeline of work & craft',
          'body', 'who knows what the future holds',
          'align', 'left',
          'padding', 'md',
          'tile', false,
          'tint', 'none',
          'accent', 'rgba(0,228,253,1)',
          'items', jsonb_build_array(
            jsonb_build_object(
              'year', '2004–2008',
              'title', 'Early Maker Years',
              'body', 'Sewing, pattern engineering, first commissions. Cut my teeth on fashion manufacturing, built repeatable patterns, and learned client delivery cycles.'),
            jsonb_build_object(
              'year', '2009–2015',
              'title', 'Nonprofit & Sustainability',
              'body', 'Earthship builds, program design, community ops. Led volunteers, coordinated logistics, and developed sustainable building curricula.'),
            jsonb_build_object(
              'year', '2016–2021',
              'title', 'Creative Tech',
              'body', 'Design systems, web stacks, media production. Built brand systems, shipped web apps, and integrated media workflows.'),
            jsonb_build_object(
              'year', '2022–Present',
              'title', 'giocoelho / TGV',
              'body', 'Founder, builder, teacher. Scaling ethical web, Human Design tools, and immersive 3D experiences.')
          )
        ))
      )
    )
  )
);

-- /hemp — a Notion database view in an iframe, and nothing else. rf-embed is
-- the block the about page already uses for its map, so the frame, the glow and
-- the responsive box come for free.
INSERT INTO _gio_pages VALUES (
  'hemp',
  'Hemp',
  jsonb_build_object(
    'id', 'pm-hemp',
    'slug', 'hemp',
    'title', 'Hemp',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-hemp-notion',
        'type', 'rf-embed',
        'label', 'Hemp research (Notion)',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'src', 'https://tinyglobalvillage.notion.site/ebd/2ab020ae8a6080d5934ddf82d20f8db5?v=2ab020ae8a6080beb876000c17330f49',
          'title', 'Hemp research database',
          'heading', 'Hemp',
          'maxWidth', 1100,
          'aspectRatio', '16 / 11',
          'glow', true,
          'glowColor', '#00bfff'
        ))
      )
    )
  )
);

-- /humandesign — the event copy and the Zoom invitation. No signup form; see
-- the header.
INSERT INTO _gio_pages VALUES (
  'humandesign',
  'Human Design',
  jsonb_build_object(
    'id', 'pm-humandesign',
    'slug', 'humandesign',
    'title', 'Human Design',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-hd-openhouse',
        'type', 'rf-media-copy',
        'label', 'Open House',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'eyebrow', 'Open House',
          'heading', 'Human Design Live Q&A',
          'headingLevel', 1,
          'paragraphs', jsonb_build_array(
            'A live Q&A with Gio Coelho — bring your chart, bring your questions.',
            'Wed, Oct 22, 2025 · 5:00–6:00 PM PST · on Zoom.'
          ),
          'ctas', jsonb_build_array(
            jsonb_build_object(
              'label', 'Join on Zoom →',
              'href', 'https://us06web.zoom.us/meetings/83852549222/invitations?signature=g-Hg6Mp-9YGwX-EbXxPobrmSQ7Zcy0i7gn0vsRL4qGc',
              'variant', 'primary')
          ),
          'bg', '#041720',
          'ink', '#eaf6fb',
          'muted', 'rgba(234,246,251,0.68)',
          'accent', '#00e4fd',
          'amber', '#ffb454',
          'eyebrowColor', 'accent',
          'imagePosition', 'left'
        ))
      )
    )
  )
);

-- ── insert, guarded ────────────────────────────────────────────────────────

WITH ins AS (
  INSERT INTO public.page_models
    (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
  SELECT g.slug, 'en', 'published', NULL, NULL, g.title, true, false, g.model, now(), 'giocoelho'
    FROM _gio_pages g
   WHERE NOT EXISTS (
     SELECT 1 FROM public.page_models p
      WHERE p.site = 'giocoelho'
        AND p.slug = g.slug
        AND p.lang = 'en'
        AND p.mode = 'published'
        AND p.user_id IS NOT DISTINCT FROM NULL
   )
  RETURNING 1
)
SELECT 'pages authored: ' || count(*) FROM ins;

-- ── assertions ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
BEGIN
  -- All three are present, public and live, exactly once each.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'giocoelho' AND lang = 'en' AND mode = 'published'
     AND user_id IS NULL AND deleted_at IS NULL AND is_public
     AND slug IN ('resume', 'hemp', 'humandesign');
  IF n <> 3 THEN
    RAISE EXCEPTION 'assert: expected 3 authored pages readable, found %', n;
  END IF;

  SELECT count(*) INTO n
    FROM (SELECT slug FROM public.page_models
           WHERE site = 'giocoelho' AND mode = 'published' AND user_id IS NULL
             AND slug IN ('resume', 'hemp', 'humandesign')
           GROUP BY slug HAVING count(*) > 1) d;
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % authored slug(s) duplicated', n;
  END IF;

  -- Every section names a type the shared catalog can render. A typo here is
  -- invisible in SQL and shows up as a blank page — which is exactly how the
  -- homeHero gap presented.
  SELECT count(*) INTO n
    FROM public.page_models p,
         LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'giocoelho' AND p.mode = 'published'
     AND p.slug IN ('resume', 'hemp', 'humandesign')
     AND s->>'type' NOT IN ('story-timeline', 'rf-embed', 'rf-media-copy');
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % authored section(s) name an unexpected type', n;
  END IF;

  -- Nothing app-relative crept in with the new copy.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'giocoelho'
     AND model_json::text ~ '"/images/(fitness|flyers|recipes|logo|backgrounds)/';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) carry an app-relative asset path', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT slug, is_public, in_nav
  FROM public.page_models
 WHERE site = 'giocoelho' AND mode = 'published' AND user_id IS NULL
 ORDER BY slug;

COMMIT;
