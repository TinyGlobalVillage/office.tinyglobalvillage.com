-- 10-nav-one-store.sql — her four nav links move into the ONE store.
--
-- Ruling (Gio, 2026-08-12, NAV-ONE-STORE.md): the navbar is the registry. The
-- site's published `navigation` dict is where it lives — the editor's Nav
-- accordion edits that row, nav blocks render it (useSiteLinks), and the
-- dashboard's balloon menu derives from it minus the utility exceptions.
--
-- What this does, in order:
--   1. Publishes her `navigation` dict: the same four links her bar renders
--      today (Starseed, Sun Walk, Contact, Login — hrefs verbatim from the
--      navLayers block, which gen-chrome-rows.mjs guarded against her source),
--      plus her logo so the Nav card's Logo section is truthful.
--   2. Flips the navLayers block to `useSiteLinks: true` and empties its
--      private `items` — the bar now renders the dict. Byte-identical output:
--      same four labels/hrefs through the same PillNav.
--   3. Deletes the stale user-scoped DRAFT navigation row IF it is still the
--      untouched base dict (one Home link). It was auto-minted when the Nav
--      card was opened; left in place it would shadow the published four.
--      A draft that has been edited is NOT deleted.
--   4. Sets writing.in_nav = false: her nav does not name it. (The balloon
--      derives from the dict after the HQ change; this keeps the page flag
--      honest rather than load-bearing.)
--
-- Re-runnable: every step is idempotent; assertions abort the transaction if
-- the world is not the shape this file believes.

BEGIN;

-- ── Assert the navLayers block is where we think it is ─────────────────────
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
  FROM content_overrides
  WHERE site = 'resonantweaver' AND key = 'navLayers' AND mode = 'published'
    AND lang = 'en' AND user_id IS NULL
    AND data->'layers'->0->'blockRef'->>'type' = 'rf-pill-nav';
  IF n <> 1 THEN
    RAISE EXCEPTION 'expected exactly one published navLayers row with layers[0] = rf-pill-nav, found %', n;
  END IF;
END $$;

-- ── 1. The published navigation dict ───────────────────────────────────────
-- isNavData requires links (object) + socialMedia (array) + langToggle
-- (object); the logo block matches the base dict's shape. No unique index
-- covers (key, lang, mode, user_id, site) — only the id pkey — so this is
-- UPDATE-then-INSERT-if-absent, not ON CONFLICT.
WITH dict AS (
  SELECT '{
    "logo": {
      "src": "/images/tenants/resonantweaver/Small-Logo-RW-2026.svg",
      "alt": "Resonant Weaver home",
      "filename": "Small-Logo-RW-2026.svg",
      "sizeBytes": 0,
      "width": 1024,
      "height": 1024
    },
    "links": {
      "starseed": { "label": "Starseed", "ariaLabel": "Go to Starseed", "href": "/starseed/", "inNav": true, "order": 0 },
      "sun-walk": { "label": "Sun Walk", "ariaLabel": "Go to Sun Walk", "href": "/sun-walk/", "inNav": true, "order": 1 },
      "contact":  { "label": "Contact",  "ariaLabel": "Go to the contact form", "href": "/#contact", "inNav": true, "order": 2 },
      "login":    { "label": "Login",    "ariaLabel": "Log in", "href": "/login/", "inNav": true, "order": 3 }
    },
    "socialMedia": [],
    "langToggle": { "toggleLabel": "Language Toggle", "enAlt": "English" }
  }'::jsonb AS data
),
updated AS (
  UPDATE content_overrides co
  SET data = dict.data, updated_at = now()
  FROM dict
  WHERE co.site = 'resonantweaver' AND co.key = 'navigation'
    AND co.mode = 'published' AND co.lang = 'en' AND co.user_id IS NULL
  RETURNING co.id
)
INSERT INTO content_overrides (key, lang, mode, user_id, site, data, updated_at)
SELECT 'navigation', 'en', 'published', NULL, 'resonantweaver', dict.data, now()
FROM dict
WHERE NOT EXISTS (SELECT 1 FROM updated)
  AND NOT EXISTS (
    SELECT 1 FROM content_overrides
    WHERE site = 'resonantweaver' AND key = 'navigation'
      AND mode = 'published' AND lang = 'en' AND user_id IS NULL
  );

-- ── 2. The block reads the dict ─────────────────────────────────────────────
UPDATE content_overrides
SET data = jsonb_set(
  jsonb_set(data, '{layers,0,blockRef,props,items}', '[]'::jsonb),
  '{layers,0,blockRef,props,useSiteLinks}', 'true'::jsonb
)
WHERE site = 'resonantweaver' AND key = 'navLayers' AND mode = 'published'
  AND lang = 'en' AND user_id IS NULL
  AND data->'layers'->0->'blockRef'->>'type' = 'rf-pill-nav';

-- ── 3. The stale base-shaped draft goes ─────────────────────────────────────
-- Only when its links are exactly the base dict's single Home link — an
-- edited draft is someone's work and stays.
DELETE FROM content_overrides
WHERE site = 'resonantweaver' AND key = 'navigation' AND mode = 'draft'
  AND lang = 'en'
  AND (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(data->'links') k) = ARRAY['home'];

-- ── 4. writing is not on her nav ────────────────────────────────────────────
UPDATE page_models
SET in_nav = false
WHERE site = 'resonantweaver' AND slug = 'writing' AND in_nav IS DISTINCT FROM false;

-- ── Assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  links text[];
  items jsonb;
  usl jsonb;
  writing_on int;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO links
  FROM content_overrides,
       jsonb_object_keys(data->'links') k
  WHERE site = 'resonantweaver' AND key = 'navigation' AND mode = 'published'
    AND lang = 'en' AND user_id IS NULL;
  IF links IS DISTINCT FROM ARRAY['contact','login','starseed','sun-walk'] THEN
    RAISE EXCEPTION 'published navigation dict does not hold her four links: %', links;
  END IF;

  SELECT data->'layers'->0->'blockRef'->'props'->'items',
         data->'layers'->0->'blockRef'->'props'->'useSiteLinks'
    INTO items, usl
  FROM content_overrides
  WHERE site = 'resonantweaver' AND key = 'navLayers' AND mode = 'published'
    AND lang = 'en' AND user_id IS NULL;
  IF items IS DISTINCT FROM '[]'::jsonb OR usl IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'navLayers block not flipped: items=%, useSiteLinks=%', items, usl;
  END IF;

  SELECT count(*) INTO writing_on
  FROM page_models
  WHERE site = 'resonantweaver' AND slug = 'writing' AND in_nav = true;
  IF writing_on <> 0 THEN
    RAISE EXCEPTION '% writing rows still carry in_nav = true', writing_on;
  END IF;
END $$;

COMMIT;
