-- 01-registry-migration.sql — nav-link atoms: the fleet's dicts join the registry.
--
-- Gio's four-switches architecture (2026-08-12 evening, plan
-- generic-popping-sunset.md): every registry row carries inNav (public-bar
-- eyeball) / balloon / attached / order, and link-ATOMS own rows via `navKey`.
-- Apply AFTER the HQ deploy that ships the switches (pre-SQL the defaults
-- reproduce old behavior, so ordering is safe but this file assumes the new
-- readers).
--
-- What it does, in order:
--   1. MAIN — stamp `navKey` on the six authored nav-link button atoms
--      (published + every draft of the platform navLayers), and rebuild the
--      platform dict's links from those atoms: the three stale test rows
--      (blog / uat-balloon-test / fashion-boutique-landing) go, six atom rows
--      arrive (key `atom-<layerId>`, matching the editor's navKeyForNode).
--      The '#' stub links (Pricing, Resources) get an explicit balloon:false —
--      a link that navigates nowhere is a hover target on the bar, not a door
--      on a menu. Main's balloon finally mirrors its real bar.
--   2. NEVLO — its navLayers rows are W4-wave COPIES of the platform bar
--      (verified 2026-08-12: 13 layers, byte-labels of TGV's marketing bar).
--      Neutralize, don't stamp: DELETE them. Public nevlo already renders the
--      identity-derived bar (the copies were re-neutralized on read); after
--      the editor-identity fix the editor derives the same bar.
--   3. GIOCOELHO — seed his pre-ruling Listed set (the in_nav=true pages:
--      about, buti-popups, fitness, gallery, recipes/paodequeijo) into his
--      dict as HIDDEN + BALLOON rows: on the balloon, off the public bar
--      (Gio: "seeded, but toggle them off on the eyeball").
--   4. REFUSIONIST — same seed from its still-intact curation (about,
--      fitness, gallery, recipes/paodequeijo, humandesign).
--   5. Delete the sites' owner-canonical balloon rows so they re-seed from
--      the registry (same move as 10-nav-one-store step 5 — the stored flags
--      were clamped by post-ruling reads and are not curation).
--
-- Re-runnable: every step converges to the same state; assertions abort the
-- transaction if the world is not the shape this file believes.

BEGIN;

-- ── Assert the platform bar still carries the six link atoms ────────────────
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM content_overrides, jsonb_array_elements(data->'layers') l
  WHERE key = 'navLayers' AND mode = 'published' AND user_id IS NULL AND site IS NULL
    AND l->>'id' LIKE 'nav-link-%' AND l->>'type' = 'button';
  IF n <> 6 THEN
    RAISE EXCEPTION 'expected 6 nav-link-* button atoms on the platform bar, found %', n;
  END IF;
END $$;

-- ── 1a. navKey stamps on the platform bar's atoms (published + drafts) ──────
UPDATE content_overrides co
SET data = jsonb_set(co.data, '{layers}', (
  SELECT jsonb_agg(
    CASE
      WHEN l->>'id' LIKE 'nav-link-%' AND l->>'type' = 'button'
        THEN l || jsonb_build_object('navKey', 'atom-' || (l->>'id'))
      ELSE l
    END
    ORDER BY o.ord
  )
  FROM jsonb_array_elements(co.data->'layers') WITH ORDINALITY o(l, ord)
), true)
WHERE co.key = 'navLayers' AND co.site IS NULL
  AND (co.mode = 'published' OR co.mode = 'draft');

-- ── 1b. The platform dict's links = home + the six atom rows ────────────────
-- Applied to the published row AND any platform drafts (a draft rung left
-- carrying the stale rows would resurface them on the next publish promotion —
-- the RW migration's lesson).
UPDATE content_overrides co
SET data = jsonb_set(co.data, '{links}',
  ((co.data->'links') - 'blog' - 'uat-balloon-test' - 'fashion-boutique-landing') || (
    SELECT jsonb_object_agg(
      'atom-' || (l->>'id'),
      jsonb_build_object(
        'label',     l->>'text',
        'ariaLabel', 'Go to ' || (l->>'text'),
        'href',      l->>'href',
        'inNav',     true,
        'order',     o.ord,
        '_tgv',      jsonb_build_object('source','atom','sourceSlug','chrome-nav','layerId', l->>'id')
      ) || CASE WHEN l->>'href' = '#' THEN '{"balloon": false}'::jsonb ELSE '{}'::jsonb END
    )
    FROM content_overrides nl, jsonb_array_elements(nl.data->'layers') WITH ORDINALITY o(l, ord)
    WHERE nl.key = 'navLayers' AND nl.mode = 'published' AND nl.user_id IS NULL AND nl.site IS NULL
      AND l->>'id' LIKE 'nav-link-%' AND l->>'type' = 'button'
  ), true)
WHERE co.key = 'navigation' AND co.site IS NULL
  AND (co.mode = 'published' OR co.mode = 'draft');

-- ── 2. Nevlo's platform-copy chrome goes ────────────────────────────────────
DELETE FROM content_overrides
WHERE key = 'navLayers' AND site = 'nevlo';

-- ── 3+4. Seed the hidden+balloon rows (giocoelho, refusionist) ──────────────
-- Keys = page slugs (the page↔dict sync's own convention), inNav:false
-- (hidden from the public bar), balloon:true (explicit — a member door),
-- order 100+ so they sink below anything the bar already carries.
UPDATE content_overrides co
SET data = jsonb_set(co.data, '{links}', (co.data->'links') || $seed$
{
  "about":               {"label":"About","ariaLabel":"Go to About","href":"/about","inNav":false,"balloon":true,"order":101,"_tgv":{"source":"page","sourceSlug":"about"}},
  "buti-popups":         {"label":"Buti Movement Pop-Ups","ariaLabel":"Go to Buti Movement Pop-Ups","href":"/buti-popups","inNav":false,"balloon":true,"order":102,"_tgv":{"source":"page","sourceSlug":"buti-popups"}},
  "fitness":             {"label":"fitness","ariaLabel":"Go to fitness","href":"/fitness","inNav":false,"balloon":true,"order":103,"_tgv":{"source":"page","sourceSlug":"fitness"}},
  "gallery":             {"label":"Gallery","ariaLabel":"Go to Gallery","href":"/gallery","inNav":false,"balloon":true,"order":104,"_tgv":{"source":"page","sourceSlug":"gallery"}},
  "recipes/paodequeijo": {"label":"Pão de Queijo","ariaLabel":"Go to Pão de Queijo","href":"/recipes/paodequeijo","inNav":false,"balloon":true,"order":105,"_tgv":{"source":"page","sourceSlug":"recipes/paodequeijo"}}
}
$seed$::jsonb, true)
WHERE co.key = 'navigation' AND co.site = 'giocoelho'
  AND (co.mode = 'published' OR co.mode = 'draft');

UPDATE content_overrides co
SET data = jsonb_set(co.data, '{links}', (co.data->'links') || $seed$
{
  "about":               {"label":"About","ariaLabel":"Go to About","href":"/about","inNav":false,"balloon":true,"order":101,"_tgv":{"source":"page","sourceSlug":"about"}},
  "fitness":             {"label":"Refusion Fitness","ariaLabel":"Go to Refusion Fitness","href":"/fitness","inNav":false,"balloon":true,"order":102,"_tgv":{"source":"page","sourceSlug":"fitness"}},
  "gallery":             {"label":"Gallery","ariaLabel":"Go to Gallery","href":"/gallery","inNav":false,"balloon":true,"order":103,"_tgv":{"source":"page","sourceSlug":"gallery"}},
  "recipes/paodequeijo": {"label":"Pão de Queijo","ariaLabel":"Go to Pão de Queijo","href":"/recipes/paodequeijo","inNav":false,"balloon":true,"order":104,"_tgv":{"source":"page","sourceSlug":"recipes/paodequeijo"}},
  "humandesign":         {"label":"Human Design","ariaLabel":"Go to Human Design","href":"/humandesign","inNav":false,"balloon":true,"order":105,"_tgv":{"source":"page","sourceSlug":"humandesign"}}
}
$seed$::jsonb, true)
WHERE co.key = 'navigation' AND co.site = 'refusionist'
  AND (co.mode = 'published' OR co.mode = 'draft');

-- ── 5. The canonical balloon rows re-seed from the registry ─────────────────
-- giocoelho's stored flags were CLAMP-persisted by today's reads (verified:
-- updated 2026-08-12, everything false but UAT Blog) — not curation. Deleting
-- the owner-canonical rows lets the route re-seed: registry rows Listed,
-- everything else Unlisted. main's sentinel row re-seeds the same way.
DELETE FROM member_bottom_navbar b
USING villager v, villager_sites s
WHERE v.member_id = b.user_id AND s.id = v.site_id AND s.subdomain = b.site
  AND b.site IN ('giocoelho', 'refusionist');
DELETE FROM member_bottom_navbar
WHERE site = 'main' AND user_id = '00000000-0000-0000-0000-000000000000';

-- ── Assertions ───────────────────────────────────────────────────────────────
DO $$
DECLARE
  ks text[];
  n int;
BEGIN
  SELECT array_agg(k ORDER BY k) INTO ks
  FROM content_overrides, jsonb_object_keys(data->'links') k
  WHERE key = 'navigation' AND mode = 'published' AND user_id IS NULL AND site IS NULL;
  IF ks IS DISTINCT FROM ARRAY[
    'atom-nav-link-builder','atom-nav-link-custom','atom-nav-link-features',
    'atom-nav-link-pricing','atom-nav-link-resources','atom-nav-link-village','home'
  ] THEN
    RAISE EXCEPTION 'platform dict is not home + the six atom rows: %', ks;
  END IF;

  SELECT count(*) INTO n FROM content_overrides WHERE key = 'navLayers' AND site = 'nevlo';
  IF n <> 0 THEN RAISE EXCEPTION '% nevlo navLayers rows survive', n; END IF;

  SELECT count(*) INTO n
  FROM content_overrides, jsonb_each(data->'links') e
  WHERE key = 'navigation' AND mode = 'published' AND user_id IS NULL AND site = 'giocoelho'
    AND e.value->>'balloon' = 'true' AND e.value->>'inNav' = 'false';
  IF n <> 5 THEN RAISE EXCEPTION 'giocoelho: expected 5 hidden+balloon rows, found %', n; END IF;

  SELECT count(*) INTO n
  FROM content_overrides, jsonb_each(data->'links') e
  WHERE key = 'navigation' AND mode = 'published' AND user_id IS NULL AND site = 'refusionist'
    AND e.value->>'balloon' = 'true' AND e.value->>'inNav' = 'false';
  IF n <> 5 THEN RAISE EXCEPTION 'refusionist: expected 5 hidden+balloon rows, found %', n; END IF;
END $$;

COMMIT;
