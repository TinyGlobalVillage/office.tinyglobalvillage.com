-- 14 — the home page gets her own two colours back
--
-- Gio 2026-09-05: "the coloring of her title and background were shifted and
-- she never made those shifts". She didn't. A machine did.
--
-- Her palette is two tokens, declared once in her own app
-- (`src/styles/tokens.ts`):
--
--     COPPER = "183, 138, 119"   -- #b78a77, the primary
--     TEAL   = "72, 210, 185"    -- #48d2b9, the accent
--
-- The pooled components reach the same two roles through CSS variables whose
-- FALLBACKS are TGV's house colours — `--tgv-cyan, rgb(0, 228, 253)` and
-- `--tgv-gold, #ffb454` (see module-page-editor `component-library/shared/
-- refusion.tsx`). While a theme is applied the variables are set and her
-- colours win. The atomizer, however, freezes a COMPUTED value into each
-- layer's style, and the pass that atomized `home` read a render where those
-- variables were not set — so it wrote the fallbacks down as if she had
-- chosen them, and no theme could reach them afterwards. That is why the
-- wordmark went cyan and the eyebrow went amber, and why re-publishing or
-- re-theming never brought them back.
--
-- Blast radius, measured across all 16 of her page models: `home` and only
-- `home` — 10 cyan literals and 2 amber, in the hero (mark glow, hairline,
-- R/ESONANT/W/EAVER, "Galactic Bridge ✦ Energy Guide", "A return to
-- yourself") and on the field-guide notify band's "Ask about access →".
-- Every other page carries her copper and teal already, which is what makes
-- a blind text substitution safe here: there is nothing else in this row that
-- those two strings can match.
--
-- Verified against `baseline/her-app-2026-08-10b.tgz`, the frozen capture of
-- her own app: home@1440 has the wordmark at rgb(183, 138, 119) and both
-- kickers at rgba(72, 210, 185, α) with the very alphas the pooled row now
-- carries — 0.68 on the eyebrow, 0.64 on the tagline.
--
-- Applied to production 2026-09-05. Both rows (draft and published) were
-- dumped first; the page model is read from the database at request time, so
-- this took effect without a deploy and was confirmed in a browser on the
-- live site: zero house literals left in the page, wordmark copper, kickers
-- teal, mark glow and hairline copper.
--
-- STILL DRIFTING, and deliberately not touched here: the contact form's
-- `— select one — ▼` and its required-field asterisks are `form-live`'s own
-- chrome rather than atoms of hers, and her app rendered TGV chrome on that
-- band too. That belongs to the pixel-parity track, not to this complaint.

BEGIN;

UPDATE page_models
   SET model_json = replace(
                      replace(model_json::text, '0, 228, 253', '183, 138, 119'),
                      '255, 180, 84', '72, 210, 185')::jsonb,
       updated_at = now()
 WHERE site = 'resonantweaver'
   AND slug = 'home';

-- Expect: cyan_left 0, gold_left 0, copper 24, teal 24, on both rows.
SELECT slug, mode,
       (length(model_json::text) - length(replace(model_json::text, '0, 228, 253', '')))/11    AS cyan_left,
       (length(model_json::text) - length(replace(model_json::text, '255, 180, 84', '')))/12   AS gold_left,
       (length(model_json::text) - length(replace(model_json::text, '183, 138, 119', '')))/14  AS copper,
       (length(model_json::text) - length(replace(model_json::text, '72, 210, 185', '')))/12   AS teal
  FROM page_models
 WHERE site = 'resonantweaver' AND slug = 'home'
 ORDER BY mode;

COMMIT;
