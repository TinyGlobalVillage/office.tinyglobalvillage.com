// Author resonantweaver's nav and footer CHROME rows from her own layout code.
//
// Phase 2 of PIXEL-PARITY-PLAN. Until now she had no `navLayers` / `footerLayers`
// row at all, so the pooled renderer derived a bar from her site record — which
// is why the first thing Marthe said about the migration was "Menu is different".
// It is one fix worth twenty-three pages, because chrome is on every one of them.
//
// NOTHING IS REBUILT HERE. Her nav is `PillNav`, a SHARED component in
// @tgv/module-component-library that was generalised out of this exact site; her
// footer is thirty lines of styled-components. Both now have catalog entries
// (`rf-pill-nav`, `rf-site-footer`) and a chrome LayerNode can embed a catalog
// entry through `blockRef`, so the row points at the same component her app
// mounts rather than at a hand-measured replica of it.
//
// THE FRAME IS THE SUBTLE PART. Her nav carries its own `position: fixed` and
// reserves no height — the page starts at the top and the bar floats over it. A
// `chrome-sticky` / `chromeBehavior:'fixed'` frame pads `body` by the band's
// height, which would push every page down by ~72px and fail parity on all
// twenty-three at once. A plain flow frame with a `grow` layer gives
// `height:auto; overflow:visible`, and a fixed child is out of flow, so the
// frame measures zero and nothing below it moves.
//
// Every value below is guarded against her source. If she edits a nav label, a
// colour or the footer's copy in her repo, this refuses to emit rather than
// generating a row that quietly disagrees with the site it is copying.
//
//   node sql/resonantweaver-migration/gen-chrome-rows.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/macbookpro/Documents/REFUSIONBOX/MAC RCS/.claude/worktrees/office";
const RW = path.join(ROOT, "clients/resonantweaver.com");
const OUT = path.join(
  ROOT,
  "clients/office.tinyglobalvillage.com/sql/resonantweaver-migration/07-chrome.sql",
);

/* ------------------------------------------------------------ drift guard --- */

const drift = [];
const cache = new Map();
function source(rel) {
  if (!cache.has(rel)) {
    const abs = path.join(RW, rel);
    if (!fs.existsSync(abs)) {
      drift.push(`${rel}: file is gone`);
      cache.set(rel, "");
    } else {
      cache.set(rel, fs.readFileSync(abs, "utf8").replace(/\s+/g, " "));
    }
  }
  return cache.get(rel);
}
/** Assert a string is still in her source, then return the VALUE we transcribed
 *  from it. Value and guard live in one call so a value can never be edited
 *  without its guard being looked at. */
function from(rel, find, value) {
  const needle = find.replace(/\s+/g, " ").trim();
  if (!source(rel).includes(needle)) {
    drift.push(`${rel}: not found — ${JSON.stringify(needle.slice(0, 76))}`);
  }
  return value;
}

const LAYOUT = "src/app/[lang]/layout.client.tsx";
const FOOTER = "src/app/[lang]/_allPageComponents/footer/Footer.tsx";
const FWRAP = "src/app/[lang]/_allPageComponents/footer/FooterWrapper.tsx";
const DICT = "src/data/i18n/en.ts";

/* ------------------------------------------------------------------- nav --- */

// Her logo, copied into HQ's tenant asset dir. The path CHANGES on purpose —
// `/images/Small-Logo-RW-2026.svg` resolved against her own app's public dir and
// would 404 on the pooled renderer (giocoelho's broken-image trap, same fix).
const navProps = {
  logoSrc: from(
    LAYOUT,
    "logoSrc: '/images/Small-Logo-RW-2026.svg'",
    "/images/tenants/resonantweaver/Small-Logo-RW-2026.svg",
  ),
  logoAlt: from(LAYOUT, "ariaLabel: 'Resonant Weaver home'", "Resonant Weaver home"),
  // Her app leaves `homeHref` unset, so PillNav defaults it to `/${lang}` = /en,
  // which her own config 307s to `/`. Pooled, `/en` would be rewritten into
  // `/u/resonantweaver/en` and 404. The destination is named explicitly.
  homeHref: "/",
  items: [
    { label: from(LAYOUT, "{ label: 'Starseed', href: `/${lang}/starseed` }", "Starseed"), href: "/starseed/" },
    { label: from(LAYOUT, "{ label: 'Sun Walk', href: `/${lang}/sun-walk` }", "Sun Walk"), href: "/sun-walk/" },
    { label: from(LAYOUT, "{ label: 'Contact', href: `/${lang}#contact` }", "Contact"), href: "/#contact" },
    { label: from(LAYOUT, "{ label: 'Login', href: `/${lang}/login` }", "Login"), href: "/login/" },
  ],
  // Copper. `accent2` and `bone` are deliberately ABSENT: her app overrides
  // neither, so the shared nav's own defaults are what she renders today, and
  // naming them here would be transcribing a value nobody chose.
  accent: from(LAYOUT, "accentRgb: '183, 138, 119'", "183, 138, 119"),
  // `var(--font-mono)` in her app is Ubuntu Mono; on the pooled renderer that is
  // the site theme's `mono` role (01-theme.sql). A role, not a family, so
  // re-typing the site re-types the bar.
  fontRole: from(LAYOUT, "serif: 'var(--font-mono)'", "mono"),
  // HER BAR NEVER MARKS THE CURRENT PAGE, and the reason is in the four hrefs
  // guarded above: every one of them carries a `/${lang}/` prefix her own config
  // hides from the URL, so PillNav's `pathname === item.href` is false on every
  // page of hers — including the one she is standing on. Pooling took the prefix
  // off (it had to: `/en/starseed` 307s on her app and 404s here), the comparison
  // started succeeding, and one link per page turned bone where her site keeps it
  // copper. On all twenty-five pages at once, which is why it is chrome.
  //
  // Guarded on the same needle as the Starseed item, because it IS the same
  // fact: drop the prefix in her source and her own bar starts marking the
  // current page, at which point this "none" must come out.
  //
  // FOR GIO: this reproduces an accident, not a decision. The mark is a real
  // affordance every other pooled tenant keeps and Marthe's visitors have never
  // had. Say the word and this line becomes an empty string.
  currentPageColor: from(LAYOUT, "{ label: 'Starseed', href: `/${lang}/starseed` }", "none"),
  navId: "rw-sitenav",
};

/* ---------------------------------------------------------------- footer --- */

const footerProps = {
  line: from(DICT, 'title: "© 2026 Resonant Weaver. All rights reserved."', "© 2026 Resonant Weaver. All rights reserved."),
  creditText: from(DICT, 'message: "Powered by"', "Powered by"),
  creditLabel: from(FOOTER, "Tiny Global Village LLC™", "Tiny Global Village LLC™"),
  creditHref: from(FOOTER, 'href="https://tinyglobalvillage.com"', "https://tinyglobalvillage.com"),
  ink: from(FWRAP, "color: hsla(40, 20%, 90%, 0.72);", "hsla(40, 20%, 90%, 0.72)"),
  linkColor: from(FWRAP, "color: hsla(40, 20%, 90%, 0.82);", "hsla(40, 20%, 90%, 0.82)"),
  linkHoverColor: from(FWRAP, "color: #E8E5DA;", "#E8E5DA"),
  focusColor: from(FWRAP, "outline: 2px solid rgba(72, 210, 185, 0.7);", "rgba(72, 210, 185, 0.7)"),
  borderColor: from(FWRAP, "border-top: 1px solid rgba(255, 255, 255, 0.03);", "rgba(255, 255, 255, 0.03)"),
  // Transparent so the site backdrop runs through — her own comment says why.
  bg: from(FWRAP, "background: transparent;", "transparent"),
  fontRole: from(FWRAP, "font-family: var(--font-mono);", "mono"),
  anchorId: from(FOOTER, 'FooterSection id="footer"', "footer"),
};

/* ----------------------------------------------------------------- rows --- */

/** One `block` layer in a zero-height flow frame. See the header for why the
 *  frame is NOT chrome-sticky. */
const chromeRow = (id, name, type, props) => ({
  layers: [
    {
      id,
      type: "block",
      name,
      grow: true,
      box: { desktop: { x: 0, y: 0, w: 0, h: 0, rot: 0, hidden: false } },
      blockRef: { type, props },
    },
  ],
  frame: { desktop: { h: 0 } },
});

const navRow = chromeRow("rw-nav", "Pill nav", "rf-pill-nav", navProps);
const footerRow = chromeRow("rw-footer", "Site footer", "rf-site-footer", footerProps);

/* ----------------------------------------------------------------- emit --- */

if (drift.length) {
  console.error("REFUSING TO EMIT — her source no longer says what this file transcribed:\n");
  for (const d of drift) console.error("  • " + d);
  console.error(
    "\nRead the changed line, decide whether the row should follow it, then update BOTH the value and its guard.",
  );
  process.exit(1);
}

const TAG = "$rwchrome$";
const upsert = (key, data) => {
  const json = JSON.stringify(data, null, 2);
  if (json.includes(TAG)) throw new Error("dollar-quote tag collision");
  return [
    `-- ── ${key} ─────────────────────────────────────────────────────────────`,
    `INSERT INTO public.content_overrides (key, lang, mode, user_id, data, updated_at, site)`,
    `SELECT '${key}', 'en', 'published', NULL, ${TAG}${json}${TAG}::jsonb, now(), 'resonantweaver'`,
    ` WHERE NOT EXISTS (`,
    `   SELECT 1 FROM public.content_overrides`,
    `    WHERE site = 'resonantweaver' AND key = '${key}'`,
    `      AND lang = 'en' AND mode = 'published'`,
    `      AND user_id IS NOT DISTINCT FROM NULL`,
    ` );`,
    ``,
    `UPDATE public.content_overrides`,
    `   SET data = ${TAG}${json}${TAG}::jsonb, updated_at = now()`,
    ` WHERE site = 'resonantweaver' AND key = '${key}'`,
    `   AND lang = 'en' AND mode = 'published'`,
    `   AND user_id IS NOT DISTINCT FROM NULL`,
    `   AND data IS DISTINCT FROM ${TAG}${json}${TAG}::jsonb;`,
    ``,
  ].join("\n");
};

const sql = [
  "-- 07-chrome.sql — GENERATED by sql/resonantweaver-migration/gen-chrome-rows.mjs.",
  "-- DO NOT HAND-EDIT: re-running the generator overwrites it, and every value in",
  "-- here is guarded against resonantweaver.com's own source.",
  "--",
  "-- PHASE 2 of PIXEL-PARITY-PLAN — the chrome. She had NO nav or footer row at",
  "-- all, so the pooled renderer derived a bar from her site record. That is",
  "-- literally Marthe's \"Menu is different\", and it is one fix worth twenty-three",
  "-- pages, because chrome is on every one of them.",
  "--",
  "-- Each row is a single `block` layer pointing at a catalog entry — `rf-pill-nav`",
  "-- mounts the SHARED PillNav her own app mounts (it was generalised out of this",
  "-- site), and `rf-site-footer` is her footer's CSS transcribed breakpoint for",
  "-- breakpoint. Nothing is a hand-measured replica.",
  "--",
  "-- THE FRAME IS A PLAIN FLOW FRAME OF HEIGHT ZERO, NOT A CHROME BAND. Her nav is",
  "-- `position: fixed` and reserves no height; a `chromeBehavior:'fixed'` band pads",
  "-- `body` by its own height and would push every page down by the height of a bar",
  "-- that was never in the flow. `grow` makes the frame auto-height with",
  "-- overflow visible, and a fixed child is out of flow, so it measures zero.",
  "--",
  "-- RE-RUNNABLE, AND IT UPDATES — same posture as 01-theme.sql. A re-run DISCARDS",
  "-- studio edits to these two keys; the plan-17 capture trigger records the change",
  "-- so it is visible in Client Versions and revertible, but do not re-run this",
  "-- after Marthe starts editing her own chrome.",
  "--",
  "--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/07-chrome.sql",
  "",
  "\\set ON_ERROR_STOP on",
  "",
  "BEGIN;",
  "",
  "SELECT set_config('app.actor', 'migration:resonantweaver-07-chrome', true);",
  "",
  "-- A BEFORE-PICTURE, taken before a single write, so assertion (f) can ask what",
  "-- THIS RUN changed rather than what changed recently. The first version asked",
  "-- for chrome rows with `updated_at > now() - interval '1 minute'` and failed on",
  "-- its first real run — not because it wrote outside its site, but because the",
  "-- four PLATFORM chrome rows carry timestamps four and a half hours in the",
  "-- FUTURE (a UTC-vs-local write, predating this file by days). A clock window is",
  "-- not authorship, and a guard that fires on somebody else's bad timestamp is a",
  "-- guard people learn to delete.",
  "CREATE TEMP TABLE rw_chrome_before ON COMMIT DROP AS",
  "SELECT key, lang, mode, user_id, site, data, updated_at",
  "  FROM public.content_overrides",
  " WHERE key IN ('navLayers','footerLayers')",
  "   AND site IS DISTINCT FROM 'resonantweaver';",
  "",
  upsert("navLayers", navRow),
  upsert("footerLayers", footerRow),
  "-- ── assertions ───────────────────────────────────────────────────────────",
  "-- Each one is a thing that, if false, means resonantweaver.com serves somebody",
  "-- else's chrome — which is the whole defect this file exists to close.",
  "DO $$",
  "DECLARE n int; v text;",
  "BEGIN",
  "  -- (a) both rows exist, and each carries exactly one block layer pointing at",
  "  --     the entry it is supposed to.",
  "  SELECT count(*) INTO n FROM public.content_overrides",
  "   WHERE site = 'resonantweaver' AND lang = 'en' AND mode = 'published'",
  "     AND user_id IS NULL AND key IN ('navLayers','footerLayers');",
  "  IF n <> 2 THEN RAISE EXCEPTION 'assert: expected 2 chrome rows, found %', n; END IF;",
  "",
  "  SELECT c.data->'layers'->0->'blockRef'->>'type' INTO v FROM public.content_overrides c",
  "   WHERE c.site = 'resonantweaver' AND c.key = 'navLayers' AND c.lang = 'en'",
  "     AND c.mode = 'published' AND c.user_id IS NULL;",
  "  IF v IS DISTINCT FROM 'rf-pill-nav' THEN",
  "    RAISE EXCEPTION 'assert: navLayers points at %, not rf-pill-nav', coalesce(v, '<null>');",
  "  END IF;",
  "",
  "  SELECT c.data->'layers'->0->'blockRef'->>'type' INTO v FROM public.content_overrides c",
  "   WHERE c.site = 'resonantweaver' AND c.key = 'footerLayers' AND c.lang = 'en'",
  "     AND c.mode = 'published' AND c.user_id IS NULL;",
  "  IF v IS DISTINCT FROM 'rf-site-footer' THEN",
  "    RAISE EXCEPTION 'assert: footerLayers points at %, not rf-site-footer', coalesce(v, '<null>');",
  "  END IF;",
  "",
  "  -- (b) the layer GROWS and the frame is not a chrome band. Without both, the",
  "  --     frame clips to a fixed height and the nav is invisible, or it pads body",
  "  --     and every page moves down.",
  "  SELECT count(*) INTO n FROM public.content_overrides c",
  "   WHERE c.site = 'resonantweaver' AND c.key IN ('navLayers','footerLayers')",
  "     AND c.lang = 'en' AND c.mode = 'published' AND c.user_id IS NULL",
  "     AND (c.data->'layers'->0->>'grow') = 'true'",
  "     AND c.data->'frame'->>'mode' IS NULL",
  "     AND c.data->'frame'->>'chromeBehavior' IS NULL;",
  "  IF n <> 2 THEN",
  "    RAISE EXCEPTION 'assert: expected 2 growing flow frames, found %', n;",
  "  END IF;",
  "",
  "  -- (c) the logo points at HQ's tenant asset dir. Her own app-relative path",
  "  --     resolves against a public dir the pooled renderer does not have, and a",
  "  --     404 there is a nav with no brand mark on every page.",
  "  SELECT c.data->'layers'->0->'blockRef'->'props'->>'logoSrc' INTO v",
  "    FROM public.content_overrides c",
  "   WHERE c.site = 'resonantweaver' AND c.key = 'navLayers' AND c.lang = 'en'",
  "     AND c.mode = 'published' AND c.user_id IS NULL;",
  "  IF v IS DISTINCT FROM '/images/tenants/resonantweaver/Small-Logo-RW-2026.svg' THEN",
  "    RAISE EXCEPTION 'assert: nav logo is %', coalesce(v, '<null>');",
  "  END IF;",
  "",
  "  -- (d) no nav href carries a locale prefix. Her app hides the default locale,",
  "  --     so `/en/starseed` 307s there and 404s here — a prefixed link would cost",
  "  --     every visitor a redirect on every click, or break outright.",
  "  SELECT count(*) INTO n FROM public.content_overrides c,",
  "       LATERAL jsonb_array_elements(c.data->'layers'->0->'blockRef'->'props'->'items') i",
  "   WHERE c.site = 'resonantweaver' AND c.key = 'navLayers' AND c.lang = 'en'",
  "     AND c.mode = 'published' AND c.user_id IS NULL",
  "     AND (i->>'href') ~ '^/(en|no)(/|$)';",
  "  IF n <> 0 THEN RAISE EXCEPTION 'assert: % nav href(s) carry a locale prefix', n; END IF;",
  "",
  "  -- (e) her four links, in her order.",
  "  SELECT count(*) INTO n FROM public.content_overrides c",
  "   WHERE c.site = 'resonantweaver' AND c.key = 'navLayers' AND c.lang = 'en'",
  "     AND c.mode = 'published' AND c.user_id IS NULL",
  "     AND jsonb_array_length(c.data->'layers'->0->'blockRef'->'props'->'items') = 4;",
  "  IF n <> 1 THEN RAISE EXCEPTION 'assert: nav does not carry exactly 4 links'; END IF;",
  "",
  "  -- (f) nothing else on the fleet moved. Chrome is per-site; a changed row keyed",
  "  --     to another tenant, or to the platform, would mean this file wrote outside",
  "  --     its own site. Compared against the before-picture taken above, so it",
  "  --     measures what THIS TRANSACTION did and nothing else.",
  "  SELECT count(*) INTO n FROM (",
  "    (SELECT key, lang, mode, user_id, site, data, updated_at FROM rw_chrome_before",
  "      EXCEPT ALL",
  "     SELECT key, lang, mode, user_id, site, data, updated_at",
  "       FROM public.content_overrides",
  "      WHERE key IN ('navLayers','footerLayers') AND site IS DISTINCT FROM 'resonantweaver')",
  "    UNION ALL",
  "    (SELECT key, lang, mode, user_id, site, data, updated_at",
  "       FROM public.content_overrides",
  "      WHERE key IN ('navLayers','footerLayers') AND site IS DISTINCT FROM 'resonantweaver'",
  "      EXCEPT ALL",
  "     SELECT key, lang, mode, user_id, site, data, updated_at FROM rw_chrome_before)",
  "  ) d;",
  "  IF n <> 0 THEN RAISE EXCEPTION 'assert: this run changed % chrome row(s) outside resonantweaver', n; END IF;",
  "",
  "  RAISE NOTICE 'assertions passed — nav and footer are resonantweaver''s own';",
  "END $$;",
  "",
  "COMMIT;",
  "",
].join("\n");

fs.writeFileSync(OUT, sql);
console.log(
  `wrote 07-chrome.sql — nav: ${navProps.items.length} links, footer: ${
    Object.keys(footerProps).length
  } props, ${Math.round(sql.length / 1024)} KB`,
);
