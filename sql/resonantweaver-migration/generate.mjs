#!/usr/bin/env node
// generate.mjs — author resonantweaver.com's bucket-A pages BY READING THEM.
//
//   node sql/resonantweaver-migration/generate.mjs         # writes 01/02 .sql
//   node sql/resonantweaver-migration/generate.mjs --check  # fails if stale
//
// WHY A GENERATOR AND NOT A HAND-WRITTEN MIGRATION. The two files it emits are
// ~700 lines of JSON; every one of giocoelho's and refusionist's pages was typed
// by hand, and both needed a browser pass to find what the typing lost. Marthe's
// site is the one where that is avoidable: she separated content from
// presentation years ago, so `src/data/*` already holds the offerings, the
// testimonials, the FAQ, the writing entries and the whole i18n dictionary as
// typed objects. Those are IMPORTED here — not transcribed — which makes the
// first render identical by construction rather than by proofreading.
//
// The prose she wrote inline in JSX has no object to import; it lives in
// copy.mjs and is checked back against her source on every run (see the drift
// guard below). If she edits a tagline in her repo, this refuses to emit.
//
// THE RUNTIME FILTER IS PART OF THE CONTENT. `onePage.tsx` hides any offering
// flagged `hidden`, then COLLAPSES a two-up row that lost an item to a single
// column, then drops a row that lost both. Two of her five rows are affected
// today. Reimplementing that here (`visibleRows`) is why the generated stack
// matches what a visitor sees rather than what the data file contains.
//
// esbuild bundles her TS to one ESM file so it can be imported without a
// TypeScript toolchain; her data modules import nothing but their own types, so
// the bundle has no externals and can be written to a temp dir.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  inlineCopy,
  rewrites,
  orbs,
  radii,
  ground,
  panel,
  assetMap,
  webfonts,
  webfontAliases,
  themeFonts,
  ASSET_BASE,
} from "./copy.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OFFICE = path.resolve(HERE, "../..");
const CLIENTS = path.resolve(OFFICE, "..");
const RW = process.env.RW_ROOT || path.join(CLIENTS, "resonantweaver.com");
const HQ = process.env.HQ_ROOT || path.join(CLIENTS, "tinyglobalvillage.com");
const MONOREPO = path.resolve(CLIENTS, "..");
const ESBUILD = path.join(MONOREPO, "node_modules/.bin/esbuild");

const SITE = "resonantweaver";
const CHECK = process.argv.includes("--check");

/** Her `(public)/(home)` group, which every route this generator reads sits in. */
const HOME_DIR = "src/app/[lang]/(public)/(home)";
const GATEWAY_FILE = `${HOME_DIR}/JourneyGateway.tsx`;

/** The archived landing's own title, from `home-classic/page.tsx`'s metadata —
 *  not `dict.home.meta.title`, which is the LIVE page's and would put the same
 *  words on both. */
const HOME_CLASSIC_TITLE = "Resonant Weaver — classic landing (archived)";

function die(msg) {
  console.error(`generate: ${msg}`);
  process.exit(1);
}

/* ------------------------------------------------------------ drift guard --- */

const sourceCache = new Map();
/** Read a file from her checkout the way a BROWSER sees the JSX in it: entities
 *  unescaped, runs of whitespace collapsed. That is what makes a three-line
 *  paragraph in the source match the one-line string it renders as. */
function normalizedSource(rel) {
  if (!sourceCache.has(rel)) {
    const abs = path.join(RW, rel);
    if (!fs.existsSync(abs)) die(`source file is gone: ${rel}`);
    const raw = fs
      .readFileSync(abs, "utf8")
      .replace(/&apos;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ");
    sourceCache.set(rel, raw);
  }
  return sourceCache.get(rel);
}

const drift = [];
/** Assert a transcribed string is still in her source, and return it. */
function verbatim(entry) {
  const needle = (entry.find ?? entry.text).replace(/\s+/g, " ").trim();
  if (!normalizedSource(entry.file).includes(needle)) {
    drift.push(`${entry.file}: not found — ${JSON.stringify(needle.slice(0, 72))}`);
  }
  return entry.text;
}
function guardOnly(entry) {
  const needle = entry.find.replace(/\s+/g, " ").trim();
  if (!normalizedSource(entry.file).includes(needle)) {
    drift.push(`${entry.file}: not found — ${JSON.stringify(needle.slice(0, 72))}`);
  }
}

/** EXTRACT an inline-JSX `<svg>` array from her source as standalone SVG data
 *  URIs, in her order.
 *
 *  Not a transcription. Every other glyph-shaped thing on this page is a value
 *  we read and re-state, and `verbatim` can guard a value; path data is a
 *  drawing, and a drawing re-typed is a drawing that drifts silently — the
 *  differ would report a few hundred pixels and name nothing. So her JSX is
 *  parsed and re-emitted: if she redraws a glyph the row follows, and if the
 *  array changes SHAPE the run fails and says so.
 *
 *  The stroke is forced opaque black because a mask reads the ALPHA channel —
 *  `currentColor` is meaningless in an image rendered in isolation, and the
 *  paint belongs to `iconColor` on the section anyway (see RfGlyph). */
function jsxSvgDataUris({ file, arrayName, expect }) {
  const abs = path.join(RW, file);
  if (!fs.existsSync(abs)) die(`source file is gone: ${file}`);
  const raw = fs.readFileSync(abs, "utf8");
  const block = raw.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\];`));
  if (!block) {
    drift.push(`${file}: no \`const ${arrayName} = [ … ];\` array — the glyphs moved or were renamed`);
    return [];
  }
  const svgs = block[1].match(/<svg[\s\S]*?<\/svg>/g) || [];
  if (svgs.length !== expect) {
    drift.push(`${file}: ${arrayName} holds ${svgs.length} <svg> elements, expected ${expect}`);
    return [];
  }
  return svgs.map((jsx, i) => {
    const markup = jsx
      // React attribute spellings → SVG's own.
      .replace(/\bstrokeWidth=/g, "stroke-width=")
      .replace(/\bstrokeLinecap=/g, "stroke-linecap=")
      .replace(/\bstrokeLinejoin=/g, "stroke-linejoin=")
      .replace(/\bfillRule=/g, "fill-rule=")
      .replace(/\bclipRule=/g, "clip-rule=")
      // React's list key is not an SVG attribute.
      .replace(/\s+key="[^"]*"/g, "")
      .replace(/currentColor/g, "#000")
      .replace(/<svg /, '<svg xmlns="http://www.w3.org/2000/svg" ')
      .replace(/\s+/g, " ")
      .replace(/> </g, "><")
      .trim();
    if (!/<(path|circle|rect|line|polyline|polygon|ellipse)\b/.test(markup)) {
      drift.push(`${file}: ${arrayName}[${i}] draws nothing — no path/circle/rect/line`);
    }
    // A React attribute left in camelCase is silently ignored in a real SVG
    // file — a hairline glyph would arrive with a 1px default stroke and no
    // round caps, and nothing would say so. A handful of SVG attributes are
    // camelCase by spec, so the scan names them rather than banning the shape.
    const SVG_CAMEL = new Set([
      "viewBox", "preserveAspectRatio", "pathLength", "gradientUnits",
      "gradientTransform", "spreadMethod", "clipPathUnits", "maskUnits",
      "maskContentUnits", "patternUnits", "patternContentUnits", "patternTransform",
      "markerWidth", "markerHeight", "markerUnits", "startOffset", "textLength",
      "lengthAdjust", "baseProfile",
    ]);
    for (const [, attr] of markup.matchAll(/\s([a-zA-Z]+)=/g)) {
      if (/[a-z][A-Z]/.test(attr) && !SVG_CAMEL.has(attr)) {
        drift.push(`${file}: ${arrayName}[${i}] keeps \`${attr}\` — a browser ignores it in an SVG file`);
      }
    }
    return `data:image/svg+xml,${encodeURIComponent(markup)}`;
  });
}

/** WHICH COMPONENT A ROUTE ACTUALLY RENDERS.
 *
 *  Every guard above asks whether a STRING still says what we transcribed.
 *  None of them asked the prior question — whether the page we are reading is
 *  still the page that route serves. It was not: `(home)/page.tsx` swapped to
 *  the star landing on 2026-07-30 and the generator kept reading `onePage.tsx`
 *  through Phase 3, emitting her ARCHIVED landing as `home` with every
 *  transcription check passing, because each string was still true of the file
 *  it named. The guard was thorough one level below the mistake.
 *
 *  So: for each slug, assert the route file still renders the component this
 *  builder was written against. A swap fails the run and names both. */
const ROUTES = [
  {
    slug: "home",
    file: `${HOME_DIR}/page.tsx`,
    renders: "LandingStarPreview",
    note: "the star landing — her front door since bb7a892 (2026-07-30)",
  },
  {
    slug: "home-classic",
    file: `${HOME_DIR}/home-classic/page.tsx`,
    renders: "OnePage",
    note: "the archived landing, noindex, kept not deleted",
  },
  {
    slug: "writing",
    file: `${HOME_DIR}/writing/page.tsx`,
    renders: "WritingPage",
    note: "the writing index",
  },
  {
    slug: "landing-star-preview/experience/all-products",
    file: `${HOME_DIR}/landing-star-preview/experience/all-products/page.tsx`,
    renders: "AllProducts",
    note: "the offering listing — every door's 'see all' CTA lands here",
  },
  {
    slug: "pearl-chamber",
    file: `${HOME_DIR}/pearl-chamber/page.tsx`,
    renders: "PearlChamberSubscriptionPage",
    note: "the weekly intention holding — her one live subscription",
  },
  {
    slug: "starseed",
    file: `${HOME_DIR}/starseed/page.tsx`,
    renders: "StarseedOraclePage",
    note: "the Starwoven Journey sales page (the route keeps the old product name)",
  },
];

function guardRoutes() {
  for (const r of ROUTES) {
    const src = normalizedSource(r.file);
    // `export default … <Component` is the render, not merely an import: a
    // route that still IMPORTS the old component but returns a new one is
    // exactly the swap this is here to catch.
    if (!new RegExp(`return <${r.renders}[\\s/>]`).test(src)) {
      drift.push(
        `${r.file}: does NOT render <${r.renders}> — the '${r.slug}' builder reads ` +
          `${r.renders} (${r.note}). If the route was repointed, repoint the builder.`,
      );
    }
  }
}

/* ---------------------------------------------------------------- her data --- */

function loadData() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rw-gen-"));
  const entry = path.join(tmp, "entry.ts");
  const out = path.join(tmp, "data.mjs");
  const p = (rel) => JSON.stringify(path.join(RW, rel));
  fs.writeFileSync(
    entry,
    [
      `export { offeringRows } from ${p("src/data/home/offerings")};`,
      `export { testimonialsByOffering } from ${p("src/data/home/testimonials")};`,
      `export { faqItems } from ${p("src/data/home/faq")};`,
      `export { writingEntries } from ${p("src/data/writing/articles")};`,
      `export { dictionary as en } from ${p("src/data/i18n/en")};`,
      `export * as tokens from ${p("src/styles/tokens")};`,
      // Bucket B. The star landing is `(home)/page.tsx` — her actual front door
      // since bb7a892 — and it reads BOTH of these: its own content module for
      // the prose, and the offer catalog for the three featured tiles. The
      // catalog's resolveOffer() is imported rather than reimplemented, the same
      // call as `visibleRows` for bucket A: the display href, the action label
      // and the per-door accent are computed by HER function or they drift.
      `export * as star from ${p("src/app/[lang]/(public)/(home)/landing-star-preview/LandingStarPreview.content")};`,
      `export * as star_gateways from ${p("src/app/[lang]/(public)/(home)/landing-star-preview/[gateway]/GatewayPage.content")};`,
      // The offering listing behind every door's "See all" CTA. Its own copy is
      // three headings and a closing callout; the nine tiles on it come from
      // `offersByDoor`, which is HER filter (it drops `hidden`) and is imported
      // rather than reimplemented for the same reason `resolveOffer` is.
      `export * as star_all from ${p("src/app/[lang]/(public)/(home)/landing-star-preview/experience/all-products/AllProducts.content")};`,
      // The Starwoven Journey sales page. Its whole narrative is one typed
      // object — twelve sections of eyebrow/title/body plus the eight star
      // currents, whose COLOURS it reads live from the starseed package's own
      // WCAG-checked palette rather than restating them. So the page generates
      // the way the listing does: imported, not transcribed.
      `export { oracleContent } from ${p("src/app/[lang]/(public)/(home)/starseed/content")};`,
      `export { catalog, getOfferBySlug, resolveOffer, offersByDoor } from ${p("src/data/offers/offers")};`,
    ].join("\n"),
  );
  if (!fs.existsSync(ESBUILD)) die(`esbuild not found at ${ESBUILD}`);
  execFileSync(ESBUILD, [entry, "--bundle", "--format=esm", "--platform=node", `--outfile=${out}`, "--log-level=error"]);
  return import(pathToFileURL(out).href).finally(() => fs.rmSync(tmp, { recursive: true, force: true }));
}

/* ------------------------------------------------------------------ colour --- */

const hex = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
const toHex = ([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`;
/** "183, 138, 119" — the shape every token in her `tokens.ts` is written in. */
const parseTriplet = (s) => s.split(",").map((x) => Number(x.trim()));

/** "#06111c" → [6, 17, 28]. She writes her grounds as hex; `over()` needs numbers. */
function hexToRgb(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (!m) die(`hexToRgb: not a 6-digit hex colour: ${s}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = Math.floor(h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][seg];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** Flatten `rgba(fg, alpha)` painted over an opaque `bg`. The theme's colour
 *  roles are hex-only by design (a validator, not an oversight), and half her
 *  palette is bone at an alpha over the ground — so the honest hex is the one
 *  a browser already computes for those pixels. */
const over = (fg, bg, alpha) => fg.map((c, i) => c * alpha + bg[i] * (1 - alpha));

/* -------------------------------------------------------------- page model --- */

const toSlug = (s) => s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

/** Every asset path she wrote resolves against HER app. Route it through the
 *  map or refuse: an unmapped path is the broken-image trap that cost giocoelho
 *  a browser pass, and an empty string is a card with no picture — visibly
 *  wrong, which is the point. */
function asset(src, { optional = false } = {}) {
  if (!src) return "";
  const mapped = assetMap[src];
  if (mapped) return mapped;
  if (optional) {
    console.warn(`  ! no asset mapping for ${src} — dropped`);
    return "";
  }
  die(`no asset mapping for ${src} (add it to copy.mjs)`);
}

const section = (id, type, label, props) => ({
  id,
  type,
  label,
  blocks: [],
  enabled: true,
  config: { props },
});

/** onePage.tsx's own filter, reimplemented: hide, collapse, drop. */
function visibleRows(offeringRows) {
  return offeringRows
    .map((row) => {
      const items = row.items.filter((o) => !o.hidden);
      return { ...row, items, columns: Math.min(row.columns, items.length) };
    })
    .filter((row) => row.items.length > 0);
}

function offeringToItem(o) {
  // OfferingCard.tsx: a subscription goes to its own page, everything else to
  // the href on the offering; the labels are its two defaults.
  const href = o.subscriptionPath ? `/${o.subscriptionPath}` : o.href;
  const external = /^https?:\/\//.test(href);
  return {
    anchorId: toSlug(o.title),
    title: o.title,
    sub: o.sub,
    body: o.paragraphs.join("\n\n"),
    listLabel: o.listLabel ?? "Best suited for",
    bullets: o.bestFor,
    note: "🛈 see FAQ",
    price: o.price,
    ctaLabel: o.ctaLabel ?? (o.subscriptionPath ? "Subscribe" : "Book a Reading"),
    ctaHref: href,
    ctaTarget: external ? "_blank" : "",
    variant: o.mediaSrc ? "media" : o.variant === "feature" ? "feature" : "standard",
    leadImageUrl: asset(o.leadImageSrc),
    leadImageAlt: o.leadImageAlt ?? "",
    leadImageGlow: Boolean(o.leadImageGlow),
    mediaUrl: asset(o.mediaSrc),
    mediaAlt: o.mediaAlt ?? "",
    mediaRight: Boolean(o.mediaRight),
  };
}

/** Her hero, which BOTH landings render — `HeroSection.tsx` is imported
 *  unchanged by `onePage.tsx` and by `LandingStarPreview.tsx`. Built once here
 *  so the two pages cannot drift apart in the one place they are identical.
 *
 *  THE COLOURS ARE THE THEME'S AGAIN, and that is the fix, not a regression.
 *  This hero's primary is her COPPER (the wordmark, the mark's halo and near
 *  drop-shadow, the rule — `var(--primary)` / `FadeLineV` in her source) and
 *  its second accent is the TEAL her eyebrow and tagline wear at 0.68/0.64.
 *  From 2026-08-08 the row said so by hand — `accent: var(--tgv-gold)` and
 *  `amber: var(--tgv-cyan)`, each pointing at the OTHER role's var — because
 *  the theme's accent1 held her teal and the entry's own primary reads
 *  `--tgv-cyan`. Inverting both roles in one row is not a colour override, it
 *  is a role map read backwards; `themeSql` swaps accent1↔accent3 now, so the
 *  hero takes the theme unmodified and so do the nineteen sections behind it
 *  that never had a colour prop to swap. `markRight` was the other row bug:
 *  `SymbolWrap` is the FIRST grid child in `HeroSection.tsx`, mark LEFT.
 *
 *  `size` fits the STAR landing, whose `PreviewBody h1` upsizes every h1 on
 *  the page (4.5vw at 1440 = 64.8px base, ×1.22 initials = the 79.056px the
 *  differ measured); the classic landing has no such override, so it keeps
 *  the entry's default clamp — which IS `H1`'s in `OnePage.styles.ts`. */
function heroSection(data, { size } = {}) {
  return section("sec-hero", "rf-split-hero", "Hero", {
    // Her Main's 8rem clearance, outside the hero's box — the section measures
    // content-only, like her HeroSection element does.
    padAsMargin: true,
    markUrl: asset(verbatim(inlineCopy.hero.markUrl)),
    markAlt: "",
    markGlow: true,
    markBreathe: true,
    markRight: false,
    eyebrow: verbatim(inlineCopy.hero.eyebrow),
    words: inlineCopy.hero.words,
    dropInitials: true,
    ariaLabel: verbatim(inlineCopy.hero.ariaLabel),
    tagline: verbatim(inlineCopy.hero.tagline),
    rule: true,
    ...(size
      ? { wordmarkSize: "clamp(2.65rem, 4.5vw, 4.4rem)", wordmarkLineHeight: 1.04 }
      : {}),
  });
}

/** An eyebrow / title / paragraph block. Her star landing opens four of its
 *  sections with exactly this, as `<Intro>` — one helper rather than four
 *  near-identical literals.
 *
 *  rf-centered-intro since the family pass: the entry IS her `<Intro>`
 *  (LandingStarPreview.styles — 55rem centered column, 0.2em eyebrow at 66%
 *  of the teal, copy at her scale). The old rf-media-copy approximation was
 *  a left-aligned band; the census called out its eyebrow's type run. */
function introBlock(data, id, label, copy, extra = {}) {
  return section(id, "rf-centered-intro", label, {
    eyebrow: copy.eyebrow,
    eyebrowTracking: 0.2,
    eyebrowAlpha: 66,
    eyebrowSize: "0.68rem",
    // HER ACCENT ON THIS PAGE IS THE COPPER AND THIS EYEBROW IS THE TEAL.
    // `IntroEyebrow` is `rgba(TEAL, 0.66)` outright, and the alpha above thins
    // the accent — the wrong colour, thinned correctly. Every eyebrow on the
    // star landing rendered copper against her teal, at every width, from the
    // pass that authored them; the text census had been printing the rows all
    // along and they read as a token question rather than a defect.
    eyebrowInk: `rgba(${data.tokens.TEAL}, 0.66)`,
    title: copy.title,
    copy: copy.copy,
    maxWidth: 55,
    spacedBottom: true,
    spacedTop: false,
    muted: `rgba(${data.tokens.BONE}, 0.63)`,
    // Her home's Section rhythm and siblings ride here — clamp(5rem, 9vw, 8rem)
    // as marginTop on the intros that open a Section.
    ...extra,
  });
}

function buildHomeClassic(data, formId) {
  const sections = [];

  // HER SERIF, PAGE-WIDE — `onePage.tsx` starts its font switch at false, so
  // this page renders `data-font-preview="original"` and every face falls
  // through to SERIF. It has to lead the sections: the entry emits a global,
  // and the order is what a reader of the row sees, not what the cascade needs.
  sections.push(pageType("sec-classic-type", data));

  // The SAME hero the star landing renders — heroSection() is the one place it
  // is built, matching how her `HeroSection.tsx` is imported by both pages.
  // Which is exactly why the type row above is a PAGE fact and not a prop on
  // this section: one component, two pages, two families, because the variables
  // it reads are declared on one of the two pages and not the other.
  // No `size`: the classic page has no `PreviewBody h1` upsizing, so the
  // entry's default clamp — which is `H1`'s own in `OnePage.styles.ts` — is
  // already hers.
  sections.push(heroSection(data));

  sections.push(
    section("sec-intro", "rf-media-copy", "Intro", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: "",
      eyebrowColor: "accent",
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: inlineCopy.intro.map(verbatim),
      chips: [],
      ctas: [],
      // HER `IntroSection` PADS BY NOTHING, which is where its 142px came from.
      // It is a 50rem `Container` — 752 inside its 1.5rem sides — laid out as a
      // centred flex column with `gap: 1.25rem`, no vertical padding at all and
      // a 6rem margin below; the two `Intro` paragraphs cap at 44rem and centre
      // inside it, at her body scale on `var(--text-muted)`. Our row took the
      // frame's `lg` rung, i.e. 88px above and below a band she pads by zero.
      //
      // `copyGap` is a MARGIN where hers is a flex `gap`, so the last paragraph
      // now carries 20px her last one does not. It costs nothing: the frame
      // states no bottom padding, so that margin collapses through the section
      // and into the gateway's own 6rem — which is her `margin-bottom` exactly.
      // AND HER INTRO OPENS ON A `FadeLine`, WHICH IS THE BAND'S WHOLE HEIGHT
      // DELTA. `IntroSection.tsx` renders `<FadeLine aria-hidden />` before the
      // two paragraphs, so the flex column starts with 1px of gradient hairline
      // and one gap — 21px wide, 17px narrow — that the pooled row simply did
      // not have. It is the −21px that has sat on band 1 at 768 and 1440 since
      // the wash forensics, and the −17px at 390 that survived every step
      // above; the paragraphs themselves measure hers to the pixel.
      //
      // AND NOW IT IS PAINTED — Gio's ruling, 2026-08-11, the same one that
      // built the gateway's pair below. `fadeRuleAt: "top"` because her
      // `IntroSection` opens on a FadeLine and does not close on one; the 21px
      // and 17px this band carried as padding become the rule (1px) plus her
      // own flex gap (20px wide, 16px narrow), so nothing under it moves.
      framePad: "sm",
      fadeRule: `rgba(${data.tokens.COPPER}, 0.22)`,
      fadeRuleAt: "top",
      fadeRuleGap: "20px",
      fadeRuleGapNarrow: "16px",
      padTop: "0",
      padTopNarrow: "0",
      padBottom: "0",
      maxWidth: 752,
      centered: true,
      proseCenter: true,
      copyMaxWidth: "44rem",
      copyInk: bone(data, 0.65),
      copySize: "clamp(1rem, 2vw, 1.15rem)",
      copyWeight: 300,
      copyLh: "1.62",
      copyGap: "1.25rem",
      // …AND HER INTRO'S OWN SECOND SET, read the same way. `IntroSection`
      // steps its flex gap 1.25rem → 1rem and its bottom margin 6rem →
      // 4.25rem under 767; `Intro` steps the clamp to a flat 0.98rem on a
      // 1.52 line. The margin is the space ABOVE the gateway (it collapses
      // through a band with no top margin of its own), so it is stated there.
      copyGapNarrow: LANDING_INTRO_NARROW.gap,
      copySizeNarrow: LANDING_INTRO_NARROW.size,
      copyLhNarrow: LANDING_INTRO_NARROW.lh,
      narrowAt: 767,
    }),
  );

  // HER GATEWAY'S SECOND SET OF NUMBERS, READ RATHER THAN GUESSED.
  //
  // `JourneyGateway.tsx` steps six declarations under 767 and the pooled row
  // took the desktop half of every one of them, so at 390 the band ran 89px
  // taller than hers with each value inside it a shade too large. The 89 is
  // not an estimate: 12 (eyebrow gap) + 2 (eyebrow size) + 10 (Question size
  // and line-height) + 24 (the run above the button) + 12 (the fine print's
  // space) + 5 (its size) + 24 (the band's own two pads) — measured back off
  // her live app at 390 before a line of this was written, and the band was
  // 395 against her 306.
  //
  // The frame steps at HER 767, not the shared 768: 768 is one of the three
  // widths the differ measures, and a band that went narrow there would go
  // narrow at the exact width her page is still wide.
  const GATEWAY_NARROW = (() => {
    guardOnly({ file: GATEWAY_FILE, find: "margin-bottom: 3rem; gap: 1.5rem;" });
    guardOnly({ file: GATEWAY_FILE, find: "font-size: 0.76rem; letter-spacing: 0.13em;" });
    guardOnly({ file: GATEWAY_FILE, find: "font-size: 1.05rem; line-height: 1.52; max-width: 22rem;" });
    guardOnly({ file: GATEWAY_FILE, find: "font-size: 0.82rem; max-width: 18rem; line-height: 1.45;" });
    // The Question's tracking is NOT a step — she declares 0.02em at every
    // width, and this entry had no paragraph tracking knob at all, so the one
    // italic line her landing pages open on has been running tight since it
    // was authored. Same for the SubNote's 0.025em.
    guardOnly({ file: GATEWAY_FILE, find: "font-size: clamp(1.15rem, 2.8vw, 1.55rem); font-weight: 300; letter-spacing: 0.02em; line-height: 1.65;" });
    guardOnly({ file: GATEWAY_FILE, find: "font-size: 0.9rem; font-weight: 300; letter-spacing: 0.025em;" });
    const gap = "1.5rem"; // her Wrap's narrow gap, which IS every space below
    return {
      gap,
      eyebrowSize: "0.76rem",
      eyebrowTracking: "0.13em",
      copySize: "1.05rem",
      copyLh: "1.52",
      copyMaxWidth: "22rem",
      finePrintSize: "0.82rem",
      finePrintLh: "1.45",
      finePrintMaxWidth: "18rem",
      // 24 + the 7px chakra row + 24, the same arithmetic as the wide 79.
      ctaTop: "55px",
      // 1px of FadeLine plus the gap, at each hand — the wide pair is 37px.
      framePad: "25px",
      questionTracking: "0.02em",
      noteTracking: "0.025em",
    };
  })();

  /** HER TWO FADE LINES AND HER SEVEN CHAKRA DOTS — Gio's ruling 2026-08-11,
   *  shown the band and asked whether to draw them or take the space back:
   *  "build the dots and lines."
   *
   *  Until now this row carried their SPACE and not the marks — `padTop`/
   *  `padBottom` at 37px (1px of rule + 36px of gap) and `ctaTop` at 79px
   *  (36 + 7 + 36) — because none of the three has a word in it and no entry
   *  had anywhere to put them. That is why the band's residue was FLAT at
   *  2.8–7.4% across all three widths: the signature of paint, not geometry.
   *
   *  Painted, the same arithmetic just moves: the rules take the frame's
   *  padding as their own gap, the dot row takes the run above the button and
   *  gives `ctaTop` the half below it. Nothing below the band moves. */
  const GATEWAY_MARKS = (() => {
    guardOnly({
      file: "src/styles/dividers.ts",
      find: "export const FadeLine = styled.div` height: 1px; width: 100%; " +
        "background: linear-gradient( to right, transparent, rgba(${COPPER}, 0.22), transparent );",
    });
    // Both ends of her Wrap, so a rule that stopped opening or closing the
    // column would be caught rather than silently drawn twice.
    guardOnly({ file: GATEWAY_FILE, find: "<FadeLine aria-hidden /> <Eyebrow>" });
    guardOnly({ file: GATEWAY_FILE, find: "<FadeLine aria-hidden /> </Wrap>" });
    guardOnly({
      file: GATEWAY_FILE,
      find: "const CHAKRAS = [ \"#8B2222\", \"#B05010\", \"#A09000\", \"#0A6A30\", " +
        "\"#0A5A8A\", \"#5A2A9A\", \"#8A30AA\", ];",
    });
    guardOnly({ file: GATEWAY_FILE, find: "const DotsRow = styled.div` display: flex; align-items: center; `;" });
    guardOnly({
      file: GATEWAY_FILE,
      find: "const Thread = styled.div<{ $color: string }>` width: 22px; height: 1px; " +
        "background: linear-gradient(to right, ${({ $color }) => `${$color}33`}, " +
        "${({ $color }) => `${$color}55`});",
    });
    guardOnly({ file: GATEWAY_FILE, find: "@media (max-width: 480px) { width: 13px; }" });
    guardOnly({
      file: GATEWAY_FILE,
      find: "const Dot = styled.div<{ $color: string; $delay: number }>` width: 7px; height: 7px; " +
        "border-radius: 50%; background: ${({ $color }) => $color}; " +
        "box-shadow: 0 0 7px ${({ $color }) => $color};",
    });
    guardOnly({
      file: GATEWAY_FILE,
      find: "0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.45); }",
    });
    return {
      fadeRule: `rgba(${data.tokens.COPPER}, 0.22)`,
      fadeRuleGap: "2.25rem",
      fadeRuleGapNarrow: GATEWAY_NARROW.gap,
      dotRow: ["#8B2222", "#B05010", "#A09000", "#0A6A30", "#0A5A8A", "#5A2A9A", "#8A30AA"],
      dotSize: "7px",
      dotThread: "22px",
      dotThreadNarrow: "13px",
      dotNarrowAt: 480,
      dotGlow: "7px",
      dotPulse: true,
      dotTop: "2.25rem",
      dotTopNarrow: GATEWAY_NARROW.gap,
    };
  })();

  sections.push(
    section("sec-journey-gateway", "rf-media-copy", "Journey gateway", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: verbatim(inlineCopy.gateway.eyebrow),
      // Not the amber role. Her `Eyebrow` is `rgba(COPPER, 0.58)` — the SAME
      // declaration her offer cards' `Sub` carries, meta font, small-caps,
      // 0.82rem, 0.16em — and the amber role is her teal, so this one line was
      // the last full-strength teal left on the page after the role map went
      // back the right way round. Stated as ink because it is an alpha the
      // surface has no way to reach: the two accents are opaque roles.
      eyebrowColor: "accent",
      eyebrowInk: `rgba(${data.tokens.COPPER}, 0.58)`,
      eyebrowSize: "0.82rem",
      eyebrowTracking: "0.16em",
      eyebrowGap: "2.25rem",
      eyebrowSizeNarrow: GATEWAY_NARROW.eyebrowSize,
      eyebrowTrackingNarrow: GATEWAY_NARROW.eyebrowTracking,
      eyebrowGapNarrow: GATEWAY_NARROW.gap,
      // Her `Eyebrow` declares no weight and inherits 400; this entry's own
      // default is 800, which put a bold line on a page that has no bold on it.
      eyebrowWeight: 400,
      // No heading, deliberately. Her gateway has none: `Question` is a
      // centred italic <p> in muted text, not an <h2>, and authoring it as a
      // heading put an 800-weight line on a page that has no bold on it.
      // Rendering it as the paragraph it is, is both closer and simpler — and
      // is only possible now that an empty heading emits no element.
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      // The `note` moved OUT of the paragraphs. Her `SubNote` is not a second
      // Question — it is 0.9rem on `--text-dim` where the Question is 1.55rem
      // on `--text-muted`, and it sits UNDER the button, not above it. Both
      // facts are what `finePrint` is: the quiet line after the CTA. Authored
      // as a paragraph it took the Question's whole type run and rendered 1.6px
      // too large in the wrong colour in the wrong place.
      paragraphs: [verbatim(inlineCopy.gateway.question)],
      chips: [],
      ctas: [
        {
          label: verbatim(inlineCopy.gateway.ctaLabel),
          href: verbatim(inlineCopy.gateway.ctaHref),
          variant: "ritual",
        },
      ],
      finePrint: verbatim(inlineCopy.gateway.note),
      finePrintSize: "0.9rem",
      finePrintWeight: 300,
      finePrintColor: bone(data, 0.22),
      finePrintTop: "2.25rem",
      finePrintTracking: GATEWAY_NARROW.noteTracking,
      finePrintSizeNarrow: GATEWAY_NARROW.finePrintSize,
      finePrintLhNarrow: GATEWAY_NARROW.finePrintLh,
      finePrintMaxWidthNarrow: GATEWAY_NARROW.finePrintMaxWidth,
      finePrintTopNarrow: GATEWAY_NARROW.gap,
      // HER `Wrap`, MEASURED RATHER THAN GUESSED. 58rem wide (880 inside its
      // 1.5rem sides), a centred flex column on a flat `gap: 2.25rem`, opening
      // and closing with a `FadeLine` — so 1px of rule plus 36px of gap at each
      // hand, carried here as the band's own padding because a gradient
      // hairline is not a `border` and `ruleTop` takes one.
      //
      // AND NOW THEY ARE PAINTED — Gio's ruling, 2026-08-11. The arithmetic
      // above is unchanged and simply moved onto the marks: the two rules take
      // the frame's 37px as their own 36px gap (the 1px is the rule itself),
      // and the run above the button splits into 36 above the dot row and 36
      // below it. Nothing under the band moves by a pixel.
      ...GATEWAY_MARKS,
      framePad: "sm",
      padTop: "0",
      padBottom: "0",
      padTopNarrow: "0",
      padBottomNarrow: "0",
      narrowAt: 767,
      maxWidth: 880,
      centered: true,
      proseCenter: true,
      marginTop: "6rem",
      marginTopNarrow: LANDING_INTRO_NARROW.marginBottom,
      copyMaxWidth: "38rem",
      copyMaxWidthNarrow: GATEWAY_NARROW.copyMaxWidth,
      copyInk: bone(data, 0.65),
      copySize: "clamp(1.15rem, 2.8vw, 1.55rem)",
      copySizeNarrow: GATEWAY_NARROW.copySize,
      copyWeight: 300,
      copyLh: "1.65",
      copyLhNarrow: GATEWAY_NARROW.copyLh,
      copyTracking: GATEWAY_NARROW.questionTracking,
      copyGap: "0",
      // The half BELOW the dot row now; the half above it is `dotTop`.
      ctaTop: "2.25rem",
      ctaTopNarrow: GATEWAY_NARROW.gap,
    }),
  );

  // The offerings stack: a row, then that row's testimonials, repeating. The
  // heading rides on the first row so it cannot drift away from the stack.
  //
  // HER STACK IS A FLEX COLUMN WITH `gap: 25px` INSIDE `GridSection`'s OWN
  // `padding: 1rem 0 0.75rem`, and split into pooled bands there is no stack
  // left to hold either number. So every band states the gap that FOLLOWS it,
  // and the two ends state the wrapper's insets — 16px above the first row,
  // 12px below the last band, 25px between every pair. Three of those were
  // being emitted and three were not, for −67px of the −83 this stack measured
  // short at 1440: the 16 had nowhere to go while `padTop` pushes the heading
  // too (hence `headGap`), a quote band could not state a trailing gap at all
  // (hence its new `marginBottom`, and 26px lost mid-stack), and the closing
  // 12 had never been carried by anything.
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "max-width: 82rem; padding-top: 1rem; padding-bottom: 0.75rem;",
  });
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "export const OfferingsStack = styled.div` display: flex; flex-direction: column; gap: 25px; @media (max-width: 767px) { gap: 18px; } `;",
  });
  guardOnly({ file: `${HOME_DIR}/OnePage.styles.ts`, find: "@media (max-width: 767px) { padding-bottom: 2rem; } `;" });
  guardOnly({ file: `${HOME_DIR}/OnePage.styles.ts`, find: "letter-spacing: 0.06em; text-shadow: 0 0 30px rgba(${COPPER}, 0.22); margin: 0 0 2.5rem;" });
  const rows = visibleRows(data.offeringRows);
  const stack = [];
  rows.forEach((row, i) => {
    stack.push(
      section(`sec-offer-${i + 1}`, "rf-offer-card", `Offerings ${i + 1}`, {
        columns: row.columns,
        heading: i === 0 ? verbatim(inlineCopy.offeringsHeading) : "",
        // Her `<H2>` closes on 2.5rem and `GridSection` opens on 1rem, with the
        // stack's first row under both. One gap here, two boxes on her page.
        ...(i === 0 ? { headGap: "3.5rem" } : {}),
        bulletGlyph: "✦",
        // HER 64px ABOVE THE HEADING IS A MARGIN AND HAS TO STAY ONE. Her
        // gateway `Wrap` closes on `margin-bottom: 4rem` and the bare
        // `<H2>Work with me</H2>` follows it as a direct `Main` child. Carried
        // as this frame's `padTop` it lands INSIDE the band, so the heading and
        // all 3332px below it sat 64px lower inside their own strip and the
        // offerings seg went 14.99% → 17.39% for a gap it was supposed to
        // close. The entry grew a `marginTop` for exactly this (2026-08-10) —
        // it was the last of the family without one — so the 64px now sits
        // BETWEEN the bands, where hers does.
        //
        // AND IT STEPS UNDER 768, WHICH THE FIRST PASS TOOK ONLY HALF OF. That
        // `margin-bottom: 4rem` sits in a rule the narrow block overrides —
        // `@media (max-width: 767px) { margin-bottom: 3rem; gap: 1.5rem; }`,
        // the same declaration `GATEWAY_NARROW` above already guards and reads
        // its `gap` out of. The gap was taken and the margin was left, so the
        // space above "Work with me" ran 64 against her 48 at 390 and matched
        // at 768 and 1440 — the whole of the page's `seg 6`, 49px → 65px.
        // A guard that a value is still in her source proves nothing about the
        // OTHER value on the same line.
        padTop: 0,
        padBottom: 25,
        // Her stack's gap steps with the row's own at 767px.
        padBottomNarrow: 18,
        ...(i === 0 ? { marginTop: "4rem", marginTopNarrow: "3rem" } : {}),
        // Her `CardBody` — and through it every paragraph, every ✦ line and the
        // whole reading half of the card — is `var(--text-muted)`. See `bone()`
        // for why an unstated row is wrong rather than merely unspecified; this
        // is where it bit hardest, because the offerings stack is 3332px of the
        // 6970 this page runs to.
        muted: bone(data, 0.65),
        items: row.items.map(offeringToItem),
      }),
    );
    const quotes = row.items.flatMap((o) => data.testimonialsByOffering[o.title] ?? []);
    if (quotes.length) {
      stack.push(
        section(`sec-quotes-${i + 1}`, "rf-testimonials", `Testimonials — ${row.items[0].title}`, {
          kicker: "Testimonials",
          quoteMark: '"',
          ruleBelow: true,
          // The stack gap after this band. A margin, not padding: this band
          // paints a background, so padding would move the quotes inside it.
          marginBottom: "25px",
          marginBottomNarrow: "18px",
          // Her `TestimonialText` is `rgba(BONE, 0.72)` — a THIRD alpha, not the
          // card body's 0.65, and the only place on the page that uses it.
          muted: bone(data, 0.72),
          items: quotes.map((t) => ({ quote: t.quote, attribution: t.attribution ?? "" })),
        }),
      );
    }
  });

  // The last band closes the stack, so what follows it is not a gap between two
  // children but `GridSection`'s own `padding-bottom: 0.75rem`, which steps to
  // 2rem under 768. Whichever kind of band happens to be last states both in
  // the knobs that band has.
  const closing = stack[stack.length - 1];
  if (closing) {
    if (closing.type === "rf-testimonials") {
      closing.config.props.marginBottom = "12px";
      closing.config.props.marginBottomNarrow = "32px";
    } else {
      closing.config.props.padBottom = 12;
      closing.config.props.padBottomNarrow = 32;
    }
  }
  sections.push(...stack);

  sections.push(
    section("sec-faq", "rf-accordion", "FAQ", {
      heading: verbatim(inlineCopy.faq.heading),
      lede: verbatim(inlineCopy.faq.lede),
      defaultOpen: -1,
      look: "panel",
      centeredHead: true,
      ruleUnderHead: true,
      animate: true,
      exclusive: true,
      // AND THE SEVEN HAIRLINES THIS BAND HAS BEEN PAINTING ARE THE SAME
      // DEFECT THE STAR LANDING'S FAQ CARRIES — one component, two ports. The
      // difference here is that ours never STATED a rule at all: with
      // `itemEdge` empty the panel look derives one from the accent, so the
      // lines came from the entry's own default rather than from a value read
      // off her. Same result on the page, same fix, and the same 1px per row.
      // This closes the residue left open on 2026-08-10 — it needed her
      // rendered page to settle, and her rendered page shows no line between
      // any two questions on either landing.
      ...LANDING_FAQ_RULES,
      // `FAQPanel`'s rule at `--rule`, which on this landing nothing recolours.
      panelEdge: `rgba(${data.tokens.COPPER}, 0.22)`,
      // HER FAQ HEAD IS THE PAGE'S `H2`, not a section heading of its own —
      // `FAQHead` imports it by name and only resets its bottom margin. So it
      // is copper at the page's display scale, where ours was rendering bone at
      // 38.4px. Below it, `FAQIntro` is `--text-muted`, `FAQSummaryButton` is
      // the copper at 0.75 on the display face, and `FAQContentInner` is the
      // same `bodyTextCss`/`--text-muted` every card body on the page runs.
      headColor: `rgb(${data.tokens.COPPER})`,
      headSize: "clamp(1.9rem, 4.5vw, 3.25rem)",
      headWeight: 300,
      headTracking: "0.06em",
      ledeColor: bone(data, 0.65),
      ledeSize: LANDING_BAND_PADS.lede.size,
      ledeWeight: 300,
      ledeLh: LANDING_BAND_PADS.lede.lh,
      ledeSizeNarrow: LANDING_BAND_PADS.lede.sizeNarrow,
      ledeLhNarrow: LANDING_BAND_PADS.lede.lhNarrow,
      nameColor: `rgba(${data.tokens.COPPER}, 0.75)`,
      nameSize: "0.98rem",
      nameWeight: 300,
      nameTracking: "0.02em",
      // AND THE FIFTH VALUE IS THE ONE SHE DOESN'T WRITE. The guard below is
      // her whole `FAQSummaryButton` declaration block: face, size, tracking,
      // weight, colour — and no `line-height` anywhere between them, so her
      // question sets at the FACE's normal (≈1.083 in Cormorant). Ours hard-
      // coded 1.25, which at 0.98rem is 19.60px against her 16.98 — 2.62px on
      // a one-line row, eight rows deep, and her closed FAQ measured 53.78px
      // per row against our 56.39. Seventh in the inherited-line-height family.
      // `normal` and not 16.98px: the number would pin her band to Cormorant.
      nameLh: (() => {
        guardOnly({
          file: `${HOME_DIR}/OnePage.styles.ts`,
          find:
            "padding: 1.15rem 0; display: flex; align-items: center; " +
            "justify-content: space-between; gap: 1rem; " +
            "font-family: ${LANDING_DISPLAY_FONT}; font-size: 0.98rem; " +
            "letter-spacing: 0.02em; font-weight: 300; " +
            "color: rgba(${COPPER}, 0.75); text-align: left;",
        });
        return "normal";
      })(),
      // AND HER CHEVRON IS A DRAWING, NOT A GLYPH. Ours is `⌄` at 1.1rem —
      // a 17.60px box — and hers is a flat 16px svg square. The summary row is
      // centred flex, so the tallest child sets its height: her question's own
      // line is 16.98px, which our chevron beat by 0.60 and hers loses to by
      // 0.98. Sized to her box, the TEXT drives the row on both sides. A glyph
      // will never be her stroke; it can stop deciding how tall her row is.
      chevSize: (() => {
        guardOnly({
          file: `${HOME_DIR}/OnePage.styles.ts`,
          find: "width: 16px; height: 16px; flex: 0 0 auto; opacity: 0.4; color: var(--primary);",
        });
        return "1rem";
      })(),
      muted: bone(data, 0.65),
      // `FAQSection` is a 50rem `Container` — 752 inside its 1.5rem sides —
      // padding 3.5rem above and 5rem below, stepping to 2.75rem/3.75rem under
      // 767. `md` (64 at both hands) was the nearest rung the frame had, which
      // is 8 short above and 16 over below and neither of her narrow numbers.
      // Now the four values are hers; the rung stays for the sides.
      maxWidth: 752,
      // AND `maxWidth` WAS NEVER THE SECTION. On rf-accordion it is the CARD
      // in rem and does nothing on a row with no `cardWash`; the entry passed
      // no width to its frame at all, so this band has laid out at the shared
      // 1100 since it was authored — every question starting at x=163 against
      // her 337 and every chevron 174px out, while the heading's own cap landed
      // correctly and hid it as a type delta rather than a geometry one. Found
      // 2026-08-11 by measuring the FadeLine this row draws under the head:
      // 1100 wide against her 752.
      frameWidth: 752,
      framePad: "md",
      padTop: LANDING_BAND_PADS.faq.top,
      padBottom: LANDING_BAND_PADS.faq.bottom,
      padTopNarrow: LANDING_BAND_PADS.faq.topNarrow,
      padBottomNarrow: LANDING_BAND_PADS.faq.bottomNarrow,
      narrowAt: 767,
      items: data.faqItems.map((f) => ({ name: f.q, body: f.a })),
    }),
  );

  sections.push(
    // HER `ContactSection`, RESOLVED — the last unauthored form on the site.
    // The waitlists and the star landing's card both carry their `--mf-*` map;
    // this one never did, so it rendered the platform's form inside a 640px
    // column where hers runs 720 inside a 52rem section, and the census read it
    // as 42.49% over 874px — the second-largest thing on the page.
    //
    // Every value is read out of `ContactFormWrapper.ts` (FormWrapper / Form /
    // Field), `RitualButton.tsx` (the submit, which is `RitualButtonButton` and
    // not the file's own `Button` export — she imports the ritual one) and
    // `OnePage.styles`' `ContactSection` + `H2`.
    //
    // THREE OF HER DECLARATIONS RESOLVE TO NOTHING AND ARE CARRIED THAT WAY.
    // `background-color: var(--card)` on the fields is an undefined custom
    // property — `--card` is declared nowhere in her app — so her inputs are
    // transparent over the page, not tinted; authoring the star card's
    // `rgba(0,0,0,0.3)` here would have been a tint she does not have. Same for
    // the autofill shadow, and `FormPanel` is never imported by this form.
    //
    // `--mf-title-gap` IS FOUR THINGS. Her H2 closes on `margin: 0 0 2.5rem`
    // inside a `gap: 2rem` flex column, then a `FadeLine`, then another 2rem,
    // then `FormWrapper`'s own `padding-top: 2rem` — 8.5rem and a hairline
    // between the words and the first label. The rule itself is a gradient and
    // has no border to be, so the space is carried and the line is not.
    //
    // AND IT IS FIVE THINGS, WHICH IS WHY THIS NUMBER MOVED. 8.5rem is the
    // whole distance on HER page — but on ours the title is a flex child of
    // `Root`, and `Root` adds `--mf-gap` under every child. So the authored
    // value renders as `title-gap + 20px`: 157px measured against her 137,
    // her first field row at y=219.95 and ours at 239.95, the same +20 all the
    // way down to the submit. The margin has to state the distance MINUS the
    // gap it sits inside — the same rule-order trap as `SectionChrome`'s
    // padding shorthand and `padCss`'s `$side`, one container up.
    //
    // Written as `7.25rem + 1px` rather than `8.5rem + 1px - 1.25rem` because
    // a reader checking this against her stylesheet should see one number to
    // find, not an equation to re-derive — the arithmetic is what this comment
    // is for. 116 + 1 + 20 = 137.
    section("sec-contact", "form-live", "Contact", {
      formId,
      accent: "",
      hideHeader: false,
      // Her `FormWrapper` is 48rem with 1.5rem sides — a 720px form column
      // inside a 52rem section. Ours closed at 640.
      maxWidth: 720,
      // HER 4rem/5rem IS PADDING, NOT A MARGIN, and the band has to wear it.
      // Stated as `marginTop` the 64px landed BETWEEN the FAQ and this band and
      // the census read it as a 64px strip her page does not have, while the
      // band itself came up 128px short of her 874.
      //
      // `lg` was the closest rung — 80px at both hands, 16 over at the top —
      // and the comment here used to end "the section chrome states no explicit
      // pads of its own", which was the reason to stop rather than a fact about
      // her page. It has them now, so the four numbers below are hers and the
      // rung is left holding only the sides.
      padding: "lg",
      padTop: LANDING_BAND_PADS.contact.top,
      padBottom: LANDING_BAND_PADS.contact.bottom,
      padTopNarrow: LANDING_BAND_PADS.contact.topNarrow,
      padBottomNarrow: LANDING_BAND_PADS.contact.bottomNarrow,
      narrowAt: 767,
      align: "center",
      vars: {
        "--mf-gap": "1.25rem",
        "--mf-field-gap": "0.5rem",
        "--mf-title-font": "var(--tgv-fontDisplay, inherit)",
        "--mf-title-size": "clamp(1.9rem, 4.5vw, 3.25rem)",
        "--mf-title-weight": "300",
        "--mf-title-tracking": "0.06em",
        "--mf-title-lh": "1.15",
        "--mf-title-align": "center",
        "--mf-title-color": `rgb(${data.tokens.COPPER})`,
        "--mf-title-gap": "calc(7.25rem + 1px)",
        // Her submit is not a bare flex child: `ContactForm.tsx` puts it in a
        // row of its own with 0.25rem of top padding, so it sits 4px below
        // where the column gap alone would place it. Four of the sixteen.
        "--mf-submit-gap": verbatim({
          file: "src/app/[lang]/_allPageComponents/forms/ContactForm.tsx",
          find: "display: 'flex', justifyContent: 'flex-start', paddingTop: '0.25rem'",
          text: "0.25rem",
        }),
        "--mf-label-font": "var(--tgv-fontBody, inherit)",
        "--mf-label-size": "0.75rem",
        "--mf-label-weight": "400",
        "--mf-label-tracking": "0.1em",
        "--mf-label-transform": "uppercase",
        // `color: var(--text); opacity: 0.7` — one declaration, flattened.
        "--mf-label-color": `rgba(${data.tokens.BONE}, 0.7)`,
        "--mf-field-pad": "0.9rem 1rem",
        "--mf-field-size": "1rem",
        "--mf-field-lh": "1.4",
        "--mf-field-font": "var(--tgv-fontBody, inherit)",
        "--mf-radius": "12px",
        "--mf-field-bg": "transparent",
        "--mf-field-edge": "#2f4f47",
        "--mf-ink": `rgb(${data.tokens.BONE})`,
        "--mf-field-focus": `rgb(${data.tokens.TEAL})`,
        "--mf-field-focus-ring": `0 0 0 2px color-mix(in srgb, rgb(${data.tokens.TEAL}) 40%, transparent)`,
        "--mf-placeholder": "#b69fa1",
        "--mf-placeholder-opacity": "1",
        "--mf-textarea-minh": "140px",
        // Her submit sits in a `justify-content: flex-start` row, so it is the
        // width of its own words — the star card's is the only stretched one.
        "--mf-submit-width": "auto",
        "--mf-submit-align": "flex-start",
        "--mf-submit-minh": "46px",
        "--mf-submit-pad": "0.76rem 1rem",
        "--mf-submit-size": "0.9rem",
        "--mf-submit-weight": "400",
        "--mf-submit-font": "var(--tgv-fontBody, inherit)",
        "--mf-submit-tracking": "0.08em",
        "--mf-submit-lh": "1",
        "--mf-submit-transform": "none",
        "--mf-submit-ink": `rgb(${data.tokens.COPPER})`,
        "--mf-submit-bg": `linear-gradient(180deg, rgba(${data.tokens.COPPER}, 0.07) 0%, rgba(255, 255, 255, 0.018) 100%)`,
        "--mf-submit-edge": `rgba(${data.tokens.COPPER}, 0.22)`,
        "--mf-submit-shadow": `inset 0 1px 0 rgba(${data.tokens.BONE}, 0.06), 0 10px 30px rgba(0, 0, 0, 0.16)`,
      },
    }),
  );

  // AboutSection.tsx is literally an offerings row holding one compact-media
  // card — no price, no CTA, a portrait beside the copy. Same component.
  sections.push(
    section("sec-about", "rf-offer-card", "About", {
      columns: 1,
      heading: "",
      bulletGlyph: "✦",
      // `GridSection`'s own `padding-top: 1rem`, and NOT the 80px above it —
      // that is `ContactSection`'s `padding-bottom: 5rem`, which now rides the
      // contact band where it belongs. Authored here it pushed every word in
      // the band 80px down inside its own strip and took the closing seg from
      // 32% to 66%: a band's padding moves its content, a page's rhythm moves
      // the band.
      //
      // Below, `GridSection`'s `padding-bottom: 0.75rem` is this band's and
      // `Main`'s closing `padding-bottom: 6rem` is the page's — the census read
      // the pair as her 208px against our 112, and authoring both as padding
      // grew the band instead of the gap.
      padTop: 16,
      padBottom: 12,
      // AND THIS BAND OWED THREE NARROW NUMBERS AND TOOK NONE OF THEM — the
      // same lesson /pearl-chamber/ learned one page over, where the comment
      // beside `marginTopNarrow` says it outright: her `Main` and her
      // `GridSection` step in the SAME `@media (max-width: 767px)` block, and a
      // band standing in for either owes both halves. Both constants have been
      // sitting here since that fix; the about band is a second `GridSection`
      // and a second stand-in for `Main`'s close, and it was given the desktop
      // half of each.
      //
      // `GridSection`'s `padding-bottom: 0.75rem → 2rem` is the band's own 20px
      // (1007 against her 1027, and it is the LAST band on the page, so nothing
      // below it could absorb the error); `Main`'s `6rem → 4.5rem` is the 24px
      // of page under it. The second one only became visible once the first was
      // fixed — the short band had been swallowing the long tail, and `seg 11`
      // went from silent to 173px → 197px the moment the band came right.
      padBottomNarrow: LANDING_GRID_PAD_BOTTOM_NARROW,
      marginBottom: "6rem",
      marginBottomNarrow: LANDING_MAIN_PAD_NARROW.bottom,
      // Her `CardBody`, the same one the offerings ride — `AboutSection.tsx`
      // imports it by name from `OnePage.styles`.
      muted: bone(data, 0.65),
      items: [
        {
          anchorId: "about",
          title: verbatim(inlineCopy.about.title),
          sub: verbatim(inlineCopy.about.sub),
          body: inlineCopy.about.paragraphs.map(verbatim).join("\n\n"),
          listLabel: "",
          bullets: [],
          note: "",
          price: "",
          ctaLabel: "",
          ctaHref: "",
          variant: "compact-media",
          mediaUrl: asset(verbatim(inlineCopy.about.mediaUrl)),
          mediaAlt: verbatim(inlineCopy.about.mediaAlt),
          mediaPortrait: true,
        },
      ],
    }),
  );

  // `home-classic`, not `home`. `(home)/page.tsx` has rendered the STAR LANDING
  // since bb7a892; this page moved to `(home)/home-classic/`, where its own
  // `metadata` sets `robots: { index: false, follow: false }`. Carrying the
  // noindex across is the whole point of keeping it: an archived landing that
  // competes with the live one for the same words is worse than no archive.
  const meta = data.en.home.meta;
  return {
    slug: "home-classic",
    title: HOME_CLASSIC_TITLE,
    inNav: false,
    model: {
      id: "pm-rw-home-classic",
      slug: "home-classic",
      title: HOME_CLASSIC_TITLE,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: meta.description,
          keywords: meta.keywords,
          ogImage: asset(data.en.home.twitter.images[0].url),
          noindex: true,
        },
      },
      sections,
    },
  };
}

/** THE STAR LANDING — `(home)/page.tsx`, her actual front door.
 *
 *  Eight sections: hero, orientation, the doors, the featured pathway, the
 *  Field Guide preview, the FAQ, contact, about. It reads two sources and both
 *  are imported rather than transcribed — `LandingStarPreview.content.ts` for
 *  the prose and `offers.ts` for the three featured tiles, resolved through HER
 *  `resolveOffer()` so the display href, the label and the price are computed
 *  by the same function the live page computes them with. */
function buildStarLanding(data, formId) {
  const star = data.star;

  // PreviewBody's toned ground — the 2026-08-08 hero/intro forensics. Her page
  // paints these two ellipses on the PAGE-HEIGHT body (`ellipse 66% 36%` = a
  // ~2200px-tall blue wash at 1440), while `siteBackground`'s orbs render in a
  // `position: fixed` viewport layer — the same wash at ~1/7 the height, pinned
  // to the top of the screen. Measured: her center column reads (11,28,44)
  // through the hero AND the intro; the pooled page read bare #06111c — that
  // one missing wash was most of seg01–04 (21–31% each). rf-page-tone is the
  // page-attached box her PreviewBody actually is; its opaque ground also
  // hides the fixed orbs here, so nothing double-paints. The orbs stay for the
  // pages whose wash IS viewport-fixed in her source (open-your-journey's and
  // starseed's `Sky`).
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "radial-gradient(ellipse 66% 36% at 50% 12%, rgba(35, 82, 121, 0.2), transparent 72%)",
  });
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "radial-gradient(ellipse 50% 34% at 82% 80%, rgba(${TEAL}, 0.035), transparent 70%)",
  });
  // The grids on this page stack at three different widths, and the two that
  // matter here are one band apart — a single number could not answer both.
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "@media (max-width: 900px) { grid-template-columns: repeat(2, minmax(0, 1fr)); } @media (max-width: 560px) { grid-template-columns: 1fr; }",
  });
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "export const FieldGuideRow = styled.div` display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin-top: clamp(2rem, 4vw, 3rem); @media (max-width: 760px) { grid-template-columns: 1fr; } `;",
  });
  // The 2026-08-10 pass, four claims, each of them a number a row now states.
  // (1) `Intro`'s own inset — the reason the same component renders 342 at the
  //     top of her page and 294 inside a Section.
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "export const Intro = styled.section` width: min(100% - 3rem, 55rem);",
  });
  // (2) Its eyebrow's HUE, which is the teal on a page whose accent is copper.
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "export const IntroEyebrow = styled.p` margin: 0 0 1rem; color: rgba(${TEAL}, 0.66);",
  });
  // (3) The notify note's measure — `IntroCopy`, the same 43rem her intros use.
  //
  // AND THE MEASURE WAS ONE OF SIX NUMBERS ON THAT DECLARATION. The guard read
  // `max-width: 43rem` and stopped at the semicolon; `margin`, `font-size` and
  // `line-height` sat on the next three lines of the same block, unread, and
  // the guard went on passing for all of them. Same shape as the three narrow
  // halves closed the same day — a guard proves a string is in her source, it
  // cannot prove you took every value on the line it sits in.
  //
  // What it cost, measured at 1440: the note set at the clamp's FLOOR (16px
  // against her 18.88, so 2 lines where she has 3), the box flush LEFT in a
  // 1248 column because `centered` centres the words and `margin: … auto …`
  // centres the box, and 21.6px of her space above it replaced by 14px of ours
  // below it. The band ran 43px short and everything under it — FAQ, contact,
  // about, footer — sat that much high.
  const NOTIFY_NOTE = (() => {
    guardOnly({
      file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
      find:
        "export const IntroCopy = styled.p` max-width: 43rem; margin: 1.35rem auto 0; " +
        "color: rgba(${BONE}, 0.63); font-family: var(--preview-body-font); " +
        "font-size: clamp(1rem, 1.55vw, 1.18rem); line-height: 1.65;",
    });
    return {
      maxWidth: "43rem",
      size: "clamp(1rem, 1.55vw, 1.18rem)",
      lh: "1.65",
      top: "1.35rem",
      bottom: "0",
    };
  })();
  // Her `NotifyButton` in full — the one CTA on this page, and the ritual
  // plate's geometry is only PART of it. `margin-top: 1.5rem` is the space our
  // row never had, `padding: 0.85rem 1.4rem` its own, and there is no
  // `RitualButtonStar` anywhere in the markup: her button is a bare `<a>` with
  // a label and an arrow, where ours drew a spark on each side.
  const NOTIFY_BUTTON = (() => {
    guardOnly({
      file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
      find:
        "export const NotifyButton = styled.a` display: inline-flex; align-items: center; " +
        "gap: 0.5rem; margin-top: 1.5rem; padding: 0.85rem 1.4rem;",
    });
    guardOnly({
      file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.tsx`,
      find:
        "<NotifyButton href={fieldGuide.notify.href}> {fieldGuide.notify.buttonLabel} " +
        "<span aria-hidden>→</span> </NotifyButton>",
    });
    return { top: "1.5rem", padX: "1.4rem" };
  })();
  // (4) The rule that overrules her About eyebrow. It is a DESCENDANT rule on
  //     the block, and the eyebrow is inside the block — so this is what the
  //     eyebrow renders, whatever `AboutEyebrow` says a few lines below it.
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`,
    find: "p { margin: 0 0 1rem; color: #c4ccd0; line-height: 1.7; font-size: 0.98rem; }",
  });
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/LandingStarPreview.tsx`,
    find: "<AboutBody> <AboutEyebrow>{about.eyebrow}</AboutEyebrow>",
  });
  const sections = [
    pageTone(
      "sec-star-tone",
      [
        "radial-gradient(ellipse 66% 36% at 50% 12%, rgba(35, 82, 121, 0.2), transparent 72%)",
        `radial-gradient(ellipse 50% 34% at 82% 80%, rgba(${data.tokens.TEAL}, 0.035), transparent 70%)`,
      ],
      // `PreviewBody = styled(Body)`, so the star landing inherits the same 1.5
      // its two siblings do — the wash is this page's own, the rhythm is not.
      { lineHeight: LANDING_LINE_HEIGHT },
    ),
    heroSection(data, { size: true }),
  ];

  sections.push(introBlock(data, "sec-star-intro", "Intro", star.intro));

  // The doors. `retiredDoors` is deliberately NOT read: she took those two off
  // the hub and kept them in the file the same way `home-classic` is kept, so
  // reading them here would put them back on her front page.
  sections.push(
    section("sec-star-doors", "rf-door-card", "Doors", {
      columns: 3,
      heading: "",
      ratio: "2 / 3",
      ratioStacked: "1 / 1",
      idleReveal: 0.62,
      // Her Cards/CardLink/CardTitle/CardCopy/Arrow values, authored — the
      // entry's defaults are the platform's, never hers.
      rowGap: "clamp(0.85rem, 1.5vw, 1.35rem)",
      sidePad: "0",
      cardBg: "#071421",
      titleSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
      titleWeight: 520,
      titleTracking: "-0.015em",
      titleLh: 1.05,
      copySize: "0.96rem",
      arrowColor: `rgba(${data.tokens.COPPER}, 0.94)`,
      // The other half of that pair, and it was missed the first time. The
      // entry's schema says it in its own words — "hers is the copper at 0.94
      // while the index runs teal, two hues one entry" — and then the escape
      // hatch went to the arrow, which is the one the accent already paints
      // correctly. All three "i · door" runs rendered copper against her teal.
      indexColor: `rgba(${data.tokens.TEAL}, 0.62)`,
      arrowSize: "0.7rem",
      arrowWeight: 700,
      arrowTracking: "0.1em",
      arrowTop: "1.7rem",
      arrowGap: "0.5rem",
      arrowGlyphSize: "1rem",
      hoverGlow: `rgba(${data.tokens.COPPER}, 0.08)`,
      muted: `rgba(${data.tokens.BONE}, 0.64)`,
      items: star.doors.map((door) => ({
        index: `${door.index} · Door`,
        title: door.title,
        copy: door.copy,
        cta: door.cta,
        // `linkTo` is an absolute site path; otherwise the gateway page under
        // the hub. Her renderer prefixes the language segment, which the pooled
        // renderer supplies itself — so the stored href is the unprefixed one.
        href: door.linkTo ?? `/landing-star-preview/${door.href}/`,
        imageUrl: asset(door.image),
        imageAlt: door.alt,
        disabled: Boolean(door.disabled),
        disabledLabel: door.disabled ? "Coming soon" : "",
      })),
    }),
  );

  sections.push(
    introBlock(data, "sec-star-featured-intro", "Featured — intro", star.featured, {
      marginTop: "clamp(5rem, 9vw, 8rem)",
      // HER `<Intro>` RENDERS AT TWO WIDTHS BECAUSE IT SITS AT TWO DEPTHS.
      // It states `min(100% - 3rem, 55rem)`; the one that opens the page has
      // the main for a parent, and this one opens a `<Section>` that is
      // already 24px in from each hand — so hers is 294 at 390 where the
      // opener is 342. Pooled, every band is a page-level sibling and the
      // nesting is gone, so the inset has to be stated. Ours ran the opener's
      // width here and on the field guide below: one line more of copy each,
      // 26px and 27px, and every glyph beneath them offset for the rest of
      // the page — most of home's 18.83% at 390.
      sideInset: "3rem",
    }),
  );
  // Her FeaturedGrid renders OfferingTile — which IS rf-hud-cards' tile mode
  // (the entry was derived from Cards.tsx). The first family cut authored this
  // grid as rf-offer-card, the exact mistake the entry's header warns about.
  sections.push(
    section("sec-star-featured", "rf-hud-cards", "Featured", {
      mode: "tile",
      columns: 3,
      heading: "",
      // Her `FeaturedGrid` reflows 3 → 2 → 1, and states why in its own words:
      // "narrow tablets never keep three cramped columns". Two numbers, so two
      // knobs — one of them new this window, because the entry could only ever
      // say where a grid becomes a column.
      stackAt: 560,
      stackTwoAt: 900,
      marginTop: "clamp(2rem, 4vw, 3rem)",
      gap: "clamp(0.85rem, 1.5vw, 1.35rem)",
      cardWash: "rgba(18, 63, 82, 0.5)",
      cardWashFeatured: "",
      imageGlow: "",
      markerColor: `rgba(${data.tokens.TEAL}, 0.7)`,
      priceColor: `rgb(${data.tokens.COPPER})`,
      linkColor: `rgba(${data.tokens.COPPER}, 0.94)`,
      badgeColor: `rgb(${data.tokens.TEAL})`,
      maxWidth: 78,
      muted: `rgba(${data.tokens.BONE}, 0.57)`,
      items: star.featuredSlugs.map((slug, i) => {
        const offer = data.resolveOffer(data.getOfferBySlug(slug));
        return {
          // OfferingTile renders "01 · <sub>" as one line above the title.
          marker: `0${i + 1} · ${offer.sub}`,
          title: offer.title,
          // The tile shows the FIRST paragraph only, falling back to the sub.
          copy: offer.paragraphs[0] ?? offer.sub,
          price: offer.price,
          linkLabel: offer.hasDetailPage
            ? "Learn more"
            : offer.external
              ? "View offering"
              : "Explore",
          href: offer.href,
          target: offer.external ? "_blank" : "",
        };
      }),
    }),
  );

  sections.push(
    introBlock(data, "sec-star-fieldguide-intro", "Field Guide — intro", star.fieldGuide, {
      marginTop: "clamp(5rem, 9vw, 8rem)",
      // The second of the two nested Intros — see the featured one above.
      sideInset: "3rem",
    }),
  );
  // Her FieldGuideTile is the hud material in its SMALL form — 1.4rem pad,
  // 0.62rem eyebrow at 0.16em over a 1.15rem display title, nothing else.
  sections.push(
    section("sec-star-fieldguide", "rf-hud-cards", "Field Guide — tiles", {
      mode: "tile",
      columns: 3,
      heading: "",
      // HER FIELD GUIDE GOES STRAIGHT 3 → 1, AND AT 760, NOT 768. The tile
      // mode's own default is 780, so at the tablet width the rig shoots this
      // row had already stacked while hers was still three-up: +203px, and the
      // whole of home's +202 at 768. Her featured row one band above steps
      // differently again (below), which is the argument for stating both.
      stackAt: 760,
      marginTop: "clamp(2rem, 4vw, 3rem)",
      gap: "1.25rem",
      cardWash: "rgba(18, 63, 82, 0.5)",
      cardWashFeatured: "",
      imageGlow: "",
      markerColor: `rgba(${data.tokens.TEAL}, 0.66)`,
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      maxWidth: 78,
      cardPad: "1.4rem 1.5rem",
      markerSize: "0.62rem",
      markerTracking: "0.16em",
      markerGap: "0.5rem",
      titleSize: "1.15rem",
      titleTracking: "normal",
      titleLh: "1.5",
      items: star.fieldGuide.tiles.map((tile) => ({
        marker: tile.eyebrow,
        title: tile.title,
      })),
    }),
  );
  sections.push(
    section("sec-star-fieldguide-notify", "rf-media-copy", "Field Guide — notify", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: "",
      eyebrowColor: "accent",
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [star.fieldGuide.notify.prompt],
      chips: [],
      // Her notify block is a bare centered note — no section frame at all,
      // 2.5rem above, and the button is the ritual plate's geometry worn in
      // the accent mono at her NotifyButton's exact type.
      framePad: "none",
      marginTop: "2.5rem",
      centered: true,
      // "no frame" IS TRUE VERTICALLY AND FALSE AT THE SIDES. The rhythm above
      // is a margin, so the rung had nothing to give — but the band sits inside
      // her `<Section>` and is 24px in from each hand like everything else in
      // it, while "none" means full-bleed in this frame by design. Ours ran the
      // whole 390 and came out one line shorter than hers: −28px, and the two
      // bands under it offset by that much.
      sideInset: "1.5rem",
      // Her Section closes at 78rem, and her copy is `IntroCopy` — 43rem. Ours
      // capped the column at the frame's 1100 and the prose at the entry's own
      // 62ch (636px), so the note read 52px narrow at every width above the
      // stack point and full-bleed below it.
      maxWidth: 1248,
      copyMaxWidth: NOTIFY_NOTE.maxWidth,
      // …and the other four values on that same declaration, read at last.
      copySize: NOTIFY_NOTE.size,
      copyLh: NOTIFY_NOTE.lh,
      copyTop: NOTIFY_NOTE.top,
      copyGap: NOTIFY_NOTE.bottom,
      // `margin: 1.35rem AUTO 0` — the box, not the words. `centered` above
      // was already true and centred neither.
      proseCenter: true,
      ctaTop: NOTIFY_BUTTON.top,
      muted: `rgba(${data.tokens.BONE}, 0.63)`,
      ctas: [
        {
          label: star.fieldGuide.notify.buttonLabel,
          href: star.fieldGuide.notify.href,
          variant: "ritual",
          // NotifyButton renders "Ask about access →" — the arrow is hers.
          arrow: true,
          // …and the two sparks are not. Her markup is the anchor, the label
          // and one aria-hidden arrow; `RitualButtonStar` appears nowhere on
          // this page. Ours drew both, which is 31px of button she never
          // authored (229 against her 198).
          sparks: "none",
          padX: NOTIFY_BUTTON.padX,
          font: "var(--tgv-fontAccent, inherit)",
          size: "0.72rem",
          weight: 700,
          tracking: "0.12em",
          transform: "uppercase",
        },
      ],
    }),
  );

  // Her own site-wide FAQ, NOT `src/data/home/faq.ts` — the star landing has a
  // second, longer list written for the whole practice rather than for the
  // offerings stack. Nine entries against the classic landing's own set.
  // Her FaqCard: the hud material around the quiet panel, the compact head,
  // white hairlines, display-role item names, teal chevrons.
  sections.push(
    section("sec-star-faq", "rf-accordion", "FAQ", {
      heading: verbatim(inlineCopy.faq.heading),
      lede: verbatim(inlineCopy.faq.lede),
      defaultOpen: -1,
      look: "panel",
      centeredHead: true,
      ruleUnderHead: true,
      animate: true,
      exclusive: true,
      cardWash: "rgba(18, 63, 82, 0.5)",
      cardPad: "clamp(1.6rem, 5vw, 2.6rem)",
      maxWidth: 48,
      framePad: "none",
      marginTop: "clamp(5rem, 9vw, 8rem)",
      // AND THE HAIRLINE WE READ OFF `[data-open]` IS A COLOUR ON A BORDER
      // WITH NO WIDTH. `FAQDetails` sets `border-bottom: 1px solid
      // rgba(COPPER, 0.1)` and then `&:last-child { border-bottom: none; }` —
      // and each `FAQDetails` is the ONLY child of its own `FAQItemRow`, so
      // `:last-child` matches every row and kills the border on all of them.
      // The card's `&& [data-open] { border-bottom-color: … }` then recolours
      // nothing. Shot at 1440 side by side: her eight questions are separated
      // by space; ours were separated by seven hairlines plus a 1px row each.
      //
      // What she DOES draw is one closing rule, `FAQPanel`'s own
      // `border-bottom: 1px solid var(--rule)`, recoloured by that same card
      // block — the exact inverse of the panel look, which put rules between
      // the rows and none at the end.
      ...LANDING_FAQ_RULES,
      // …recoloured by `FaqCard`'s `&& > div > div:last-child`, which is the
      // one selector in that block that lands on a border with a width.
      panelEdge: "rgba(255, 255, 255, 0.08)",
      itemHoverWash: "rgba(255, 255, 255, 0.02)",
      nameFont: "var(--tgv-fontDisplay, inherit)",
      nameSize: "0.98rem",
      nameWeight: 300,
      nameTracking: "0.02em",
      headColor: "#f5f9f8",
      headSize: "clamp(1.6rem, 5vw, 2.15rem)",
      headWeight: 500,
      headTracking: "-0.01em",
      ledeUpright: true,
      ledeColor: "#9aa4ab",
      // IT IS THE SAME COMPONENT AS `/home-classic/`'s FAQ, AND ONLY ONE OF
      // THE TWO PORTS EVER LEARNED THIS. `FAQAccordion` is imported by both
      // her landings; `FaqCard`'s `&&` block overrides the head scale, the
      // colours and the italic, and NOTHING ELSE — so `FAQIntro`'s own
      // 1.02rem/300/1.62 (0.97rem/1.52 narrow) and `FAQSummaryButton`'s
      // absent line-height govern here exactly as they do there. The
      // home-classic row states all five; this one was authored first and was
      // never handed back what that pass found. 2.4px per closed row, eight
      // rows deep, and the lede 0.8 short of hers on top of it: the band ran
      // 22px under her 833.
      //
      // `nameLh: normal` is the eighth member of the inherited-line-height
      // family and the same argument as the seventh — the number would pin
      // her band to a face. Here the face is Science Gothic, not Cormorant,
      // and `normal` is 23.0px against the 19.60 we hardcoded.
      ledeSize: LANDING_BAND_PADS.lede.size,
      ledeWeight: 300,
      ledeLh: LANDING_BAND_PADS.lede.lh,
      ledeSizeNarrow: LANDING_BAND_PADS.lede.sizeNarrow,
      ledeLhNarrow: LANDING_BAND_PADS.lede.lhNarrow,
      // …AND THE BREAKPOINT THE NARROW HALF ANSWERS TO. Hers is
      // `max-width: 767px`; the entry defaults to 768, which INCLUDES 768 —
      // so the first run of this fix put the phone's 0.97rem on the tablet
      // capture and the census read `16.32px → 15.52px` at exactly one width.
      // home-classic's FAQ has stated 767 since it was authored; this row is
      // the one that never did.
      narrowAt: 767,
      nameLh: "normal",
      // Her Chevron is the same 16px svg on both landings; ours is a 17.6px
      // glyph. It does not drive THIS row's height — her question's own line
      // is taller than either — but it is her drawing's box, and a row where
      // the chevron can win is one line-height away.
      chevSize: "16px",
      chevColor: `rgba(${data.tokens.TEAL}, 0.7)`,
      muted: `rgba(${data.tokens.BONE}, 0.65)`,
      items: star.faq.map((f) => ({ name: f.q, body: f.a })),
    }),
  );

  // Her ContactCard, resolved: the shared FormWrapper/RitualButton base with
  // the star card's && overrides baked — every value below is read out of
  // ContactFormWrapper.ts + RitualButton.tsx + LandingStarPreview.styles.
  sections.push(
    section("sec-star-contact", "form-live", "Contact", {
      formId,
      accent: "",
      hideHeader: false,
      maxWidth: 544,
      // A CAP SAYS WHAT THE BOX MAY NOT EXCEED AND NOTHING ABOUT THE EDGES.
      // Her card is that cap inside a section already 24px in from each hand,
      // so below 544 it is the section's width and at 390 that is 342. Ours
      // was the same cap over `width: 100%` and ran the full 390 — right at
      // 768 and 1440, where the cap binds, and 48px wide at 390, which put
      // every label, field and button on the band out of place. 22.83% on a
      // 657px band, all of it horizontal.
      sideInset: "1.5rem",
      padding: "none",
      marginTop: "clamp(5rem, 9vw, 8rem)",
      align: "center",
      cardWash: "rgba(18, 63, 82, 0.5)",
      cardPad: "clamp(1.6rem, 5vw, 2.6rem)",
      vars: {
        "--mf-gap": "1.25rem",
        "--mf-field-gap": "0.5rem",
        "--mf-title-font": "var(--tgv-fontDisplay, inherit)",
        "--mf-title-size": "clamp(1.6rem, 5vw, 2.15rem)",
        "--mf-title-weight": "500",
        "--mf-title-tracking": "-0.01em",
        "--mf-title-lh": "1.12",
        "--mf-title-align": "center",
        "--mf-title-color": "#f5f9f8",
        "--mf-title-gap": "0.35rem",
        "--mf-label-font": "var(--tgv-fontAccent, inherit)",
        "--mf-label-size": "0.75rem",
        "--mf-label-weight": "400",
        "--mf-label-tracking": "0.12em",
        "--mf-label-transform": "uppercase",
        "--mf-label-color": `rgba(${data.tokens.BONE}, 0.72)`,
        "--mf-field-pad": "0.9rem 1rem",
        "--mf-field-size": "1rem",
        "--mf-field-lh": "1.4",
        "--mf-field-font": "var(--tgv-fontBody, inherit)",
        "--mf-radius": "8px",
        "--mf-field-bg": "rgba(0, 0, 0, 0.3)",
        "--mf-field-edge": "rgba(255, 255, 255, 0.16)",
        "--mf-ink": `rgb(${data.tokens.BONE})`,
        "--mf-field-focus": `rgb(${data.tokens.TEAL})`,
        "--mf-field-focus-ring": `0 0 0 3px rgba(${data.tokens.TEAL}, 0.16)`,
        "--mf-placeholder": "#b69fa1",
        "--mf-placeholder-opacity": "1",
        "--mf-textarea-minh": "140px",
        "--mf-submit-width": "100%",
        "--mf-submit-align": "stretch",
        "--mf-submit-minh": "46px",
        "--mf-submit-pad": "0.76rem 1rem",
        "--mf-submit-size": "0.72rem",
        "--mf-submit-weight": "700",
        "--mf-submit-font": "var(--tgv-fontAccent, inherit)",
        "--mf-submit-tracking": "0.12em",
        "--mf-submit-lh": "1",
        "--mf-submit-transform": "uppercase",
        "--mf-submit-ink": `rgb(${data.tokens.COPPER})`,
        "--mf-submit-bg": `linear-gradient(180deg, rgba(${data.tokens.COPPER}, 0.07) 0%, rgba(255, 255, 255, 0.018) 100%)`,
        "--mf-submit-edge": `rgba(${data.tokens.COPPER}, 0.22)`,
        "--mf-submit-shadow": `inset 0 1px 0 rgba(${data.tokens.BONE}, 0.06), 0 10px 30px rgba(0, 0, 0, 0.16)`,
      },
    }),
  );

  // Her AboutCard: the hud material worn as a bio — portrait beside eyebrow/
  // title/paragraphs. rf-hud-cards' profile layout IS this card.
  sections.push(
    section("sec-star-about", "rf-hud-cards", "About", {
      mode: "profile",
      columns: 1,
      heading: "",
      marginTop: "clamp(5rem, 9vw, 8rem)",
      marginBottom: "clamp(5rem, 9vw, 8rem)",
      gap: "",
      cardWash: "rgba(18, 63, 82, 0.5)",
      cardWashFeatured: "",
      imageGlow: "",
      // HER EYEBROW HERE IS A BODY PARAGRAPH WEARING A TRACKING, and the four
      // values below are the ones her page RENDERS, not the four `AboutEyebrow`
      // declares (0.64rem, rgba(TEAL, 0.8), 0.6rem under, no line-height at
      // all). The markup is `<AboutBody><AboutEyebrow>…`, so `AboutBody p` at
      // (0,1,1) outranks the eyebrow's own class at (0,1,0) and takes size,
      // colour and margin with it — which is why they are the same three
      // values as `copySize`/`copyLh`/`copyColor` a few lines down. All that
      // survives of the eyebrow is its tracking and its uppercase.
      markerColor: "#c4ccd0",
      markerLh: "1.7",
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      maxWidth: 46,
      cardPad: "clamp(1.6rem, 5vw, 2.6rem)",
      markerSize: "0.98rem",
      markerTracking: "0.22em",
      markerGap: "1rem",
      titleSize: "clamp(1.5rem, 4vw, 2rem)",
      titleWeight: 500,
      titleTracking: "-0.01em",
      titleLh: "1.15",
      titleColor: "#f5f9f8",
      copySize: "0.98rem",
      copyLh: "1.7",
      copyColor: "#c4ccd0",
      anchorId: "about",
      items: [
        {
          marker: star.about.eyebrow,
          title: star.about.title,
          copy: star.about.body.join("\n\n"),
          imageUrl: asset(star.about.portrait.src),
          imageAlt: star.about.portrait.alt,
        },
      ],
    }),
  );

  // Both landings run `buildPageMetadata({ dictPage: dict.home })`, so the head
  // is the same on either — the swap changed the body, not the metadata.
  const meta = data.en.home.meta;
  return {
    slug: "home",
    title: meta.title,
    inNav: true,
    model: {
      id: "pm-rw-home",
      slug: "home",
      title: meta.title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: meta.description,
          keywords: meta.keywords,
          ogImage: asset(data.en.home.twitter.images[0].url),
        },
      },
      sections,
    },
  };
}

/* ------------------------------------------- the gateway/offer family rows --- */
// Shared authoring for the twelve landing-star detail pages, onto the entries
// DERIVED from her code (PIXEL-PARITY-PLAN §Phase 3 family pass, 2026-08-08):
// rf-page-tone ← GatewayBody/OfferBody, rf-back-link ← both BackLinks,
// rf-product-hero ← ProductHero/GatewayHero, rf-detail-split ← DetailSection,
// rf-process-steps ← ProcessCard/TrainingStep/ProcessFlow, rf-section-head ←
// SectionIntro, rf-callout-bar ← CalloutBar. Every color is the ROW's, per the
// ruling: her design is the SOURCE, never the DEFAULT.

/** `rgba(BONE, a)` — the alpha'd bone her muted copy runs on. The theme's t3
 *  is a FLATTENED hex (roles are hex-only), so per-section alphas live here.
 *
 *  AND THE MUTED ROLE IS A ROW PROP, NEVER THE THEME'S — which is why this
 *  helper is called at thirty-odd sites and skipping it is a real defect
 *  rather than an omission. `muted()` in the shared surface falls back to
 *  `var(--tgv-t3)`, and `themeToPairs` derives t3 by DARKENING `textMuted`
 *  0.18; her `--text-muted` is `rgba(BONE, 0.65)`, which flattens to the theme's
 *  `#999b98` — i.e. `--tgv-t2`, the sibling nothing reads. So an unstated row
 *  paints `rgb(125, 127, 125)` where hers paints `rgba(232, 229, 218, 0.65)`,
 *  and it does it on every paragraph in the band at once. That single missing
 *  prop was 35 of home-classic's colour rows and 3 of pearl-chamber's. */
const bone = (data, a) => `rgba(${data.tokens.BONE}, ${a})`;

/** HER SITE GROUND — `GlobalStyles`, `background: #050a0c` on html AND on body,
 *  and the only thing behind her chrome bands.
 *
 *  THE TONE IS THE PAGE'S GROUND AND THE FOOTER IS NOT ON THE PAGE. Her shell
 *  is `<SiteShell><PillNav/><main>{children}</main><Footer/></SiteShell>`, and
 *  every ground she paints — GatewayBody, OfferBody, PreviewBody, WritingPage —
 *  is inside `main`. Her shell's three radials are `background-attachment:
 *  fixed`, so in a full-page capture they paint once at the top and reach
 *  nothing 6000px down: her footer band measures a flat `rgb(5,10,12)` at every
 *  x on every route probed.
 *
 *  Ours painted the tone on `html body`, so the page's ground ran out from
 *  under the footer with its page-attached glows still on it. On `/` that is
 *  `rgb(6,17,28)` against her `rgb(5,10,12)` — a channel sum of exactly 24,
 *  which is the differ's tolerance to the pixel, so only the orb-tinted half of
 *  the band counted and it read as a block on one side with no cause.
 *
 *  `html` as well as `body` because the 15px scrollbar gutter she reserves is
 *  outside the body box and shows the canvas — which follows html once html has
 *  a background — so ours ran a column of the SITE ground down the right hand
 *  of every page.
 *
 *  WHICH IS NOT GIO'S FIELD-GUIDE RULING REOPENED. That ruling chose the pooled
 *  `siteBackground` over her shell green-black for the surfaces that declare no
 *  ground of their own; this is a page that DOES declare one, now saying what
 *  its own chrome sits on. `/galactic-field-guide/`, `/starseed/` and
 *  `/open-your-journey/` state no ground and are untouched. */
const SITE_GROUND = (() => {
  const file = "src/styles/GlobalStyles.ts";
  guardOnly({ file, find: "html { scroll-behavior: smooth; background: #050a0c;" });
  guardOnly({ file, find: "body { background: #050a0c; color: #e8e5da; }" });
  return { scope: "content", outerGround: "#050a0c" };
})();

/** OfferBody/GatewayBody's toned ground, as the leading section. `extra`
 *  carries anything the page states about itself rather than about its wash —
 *  today that is the gutter, which is a page fact and has no other page-level
 *  row to live on. */
const pageTone = (id, layers, extra = {}) =>
  section(id, "rf-page-tone", "Page tone", {
    layers,
    ground: "#06111c",
    ...SITE_GROUND,
    ...extra,
  });

/** HER SITE SHELL — `layout.client.tsx`, the wrapper EVERY page of hers is
 *  inside, and the sky the two landings with no body of their own show.
 *
 *  A copper wash off the top edge, a teal one low and right, over a green-black
 *  radial that is itself the ground, and the whole thing `background-attachment:
 *  fixed`. Most of her pages cover it — GatewayBody, OfferBody, PreviewBody,
 *  WritingPage and the two star surfaces all paint an opaque ground of their
 *  own — so it only shows on `/home-classic/` and `/pearl-chamber/`, whose
 *  `Body` sets custom properties, a min-height and a colour, and no background
 *  at all. Those are exactly the two pages that were wearing the STAR
 *  landing's blue-and-teal orbs instead: `siteBackground` is the only sky a
 *  pooled page has when it declares none, and the row there was authored from
 *  `LandingStarPreview.styles`.
 *
 *  ATTACHMENT IS PART OF THE TRANSCRIPTION, not a detail. `ellipse 90% 55%`
 *  against a 3000px page is a wash six times taller than the same ellipse
 *  against the viewport, and it scrolls. Hers is fixed; her per-page bodies are
 *  not, which is why the flag is a row prop rather than the entry's default. */
const SHELL_LAYERS = [
  {
    find: "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(183, 138, 119, 0.08) 0%, transparent 65%)",
    of: (d) => `radial-gradient(ellipse 90% 55% at 50% -5%, rgba(${d.tokens.COPPER}, 0.08) 0%, transparent 65%)`,
  },
  {
    find: "radial-gradient(ellipse 70% 45% at 85% 100%, rgba(72, 210, 185, 0.06) 0%, transparent 60%)",
    of: (d) => `radial-gradient(ellipse 70% 45% at 85% 100%, rgba(${d.tokens.TEAL}, 0.06) 0%, transparent 60%)`,
  },
  {
    // Her third layer IS the ground — an opaque three-stop radial, no
    // transparency anywhere in it — so `ground` below carries only its outer
    // stop, for the sliver a fixed layer cannot reach.
    find: "radial-gradient(circle at 50% 0%, hsl(165, 50%, 10%), hsl(170, 40%, 7%) 60%, hsl(180, 10%, 2%))",
    of: () => "radial-gradient(circle at 50% 0%, hsl(165, 50%, 10%), hsl(170, 40%, 7%) 60%, hsl(180, 10%, 2%))",
  },
];
const SHELL_FILE = "src/app/[lang]/layout.client.tsx";
const shellSky = (data) => {
  for (const l of SHELL_LAYERS) guardOnly({ file: SHELL_FILE, find: l.find });
  guardOnly({ file: SHELL_FILE, find: "background-attachment: fixed;" });
  return {
    layers: SHELL_LAYERS.map((l) => l.of(data)),
    // `hsl(180, 10%, 2%)`, her outermost stop, as the flat colour under it.
    ground: "#050606",
    fixed: true,
  };
};

/** HER THREE LANDINGS READ AT 1.5, AND ONLY HER THREE LANDINGS.
 *
 *  `OnePage.styles`' `Body` declares `line-height: 1.5` once, and every run on
 *  the page that does not state its own inherits it — the card eyebrows, the
 *  bullet lines, the prices, the form labels, the option list. Ours inherits
 *  the platform's 1.60, which is a pixel or two per line on each of them and
 *  reads out as `box` on half the strings the census compares.
 *
 *  It is the same shape as the 1.68 that took `/starseed/` its last 19px, and
 *  the same argument for stating it here rather than per entry: an inherited
 *  declaration reaches runs written before the knob existed. The scope is
 *  narrow on purpose — this belongs to the three rows that render `Body`: the
 *  star landing, `/home-classic/` and `/pearl-chamber/`. See PAGE_RHYTHM_NONE
 *  below for what the OTHER roots do, which is not what this comment used to
 *  claim they do. */
const LANDING_LINE_HEIGHT = verbatim({
  file: `${HOME_DIR}/OnePage.styles.ts`,
  find: "overflow-x: clip; position: relative; line-height: 1.5;",
  text: "1.5",
});

/** AND HER `Main` CARRIES TWO PADDINGS, NOT ONE.
 *
 *  `padding: 8rem 0 6rem`, stepping to `7rem 0 4.5rem` under 767. Any band that
 *  takes `Main`'s padding on a page's behalf — /pearl-chamber/ has no hero to
 *  get it from — has to take BOTH halves, or the page is 16px low on a phone
 *  and right on a desktop, which is the shape of bug a wide-only capture cannot
 *  see. Read as one string so a change to either number fails the run. */
const LANDING_MAIN_PAD_NARROW = (() => {
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "padding: 8rem 0 6rem; position: relative; @media (max-width: 767px) { padding: 7rem 0 4.5rem; } `;",
  });
  return { top: "7rem", bottom: "4.5rem" };
})();

/** HER FAQ AND HER CONTACT BAND, WHICH BOTH WRITE FOUR PADS AND A TYPE STEP.
 *
 *  `FAQSection` is 3.5rem/5rem stepping to 2.75rem/3.75rem; `ContactSection` is
 *  4rem/5rem stepping to 3rem/3.75rem. Both rows were rounding to a `framePad`
 *  rung — `md` is 64 at both hands where she writes 56 and 80, `lg` is 80 where
 *  she writes 64 and 80 — and a rung has no narrow half of its own beyond the
 *  frame's, so a phone got the frame's number twice over.
 *
 *  `FAQIntro` steps 1.02rem/1.62 → 0.97rem/1.52 with them. That one was in the
 *  parity report the whole time and read as a census row rather than a knob:
 *  `"common queries about the nature of"  size: 15.52px → 16.32px` is her
 *  0.97rem against our 1.02rem, printed at 390 on every run since the band was
 *  authored. A number the differ hands you is still a number she wrote. */
const LANDING_BAND_PADS = (() => {
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "padding-top: 3.5rem; padding-bottom: 5rem; display: flex; flex-direction: column; gap: 2rem; @media (max-width: 767px) { padding-top: 2.75rem; padding-bottom: 3.75rem; }",
  });
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "padding-top: 4rem; padding-bottom: 5rem; display: flex; flex-direction: column; gap: 2rem; @media (max-width: 767px) { padding-top: 3rem; padding-bottom: 3.75rem; }",
  });
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "font-size: 1.02rem; font-weight: 300; line-height: 1.62; color: var(--text-muted); @media (max-width: 767px) { font-size: 0.97rem; line-height: 1.52; }",
  });
  return {
    faq: { top: "3.5rem", bottom: "5rem", topNarrow: "2.75rem", bottomNarrow: "3.75rem" },
    contact: { top: "4rem", bottom: "5rem", topNarrow: "3rem", bottomNarrow: "3.75rem" },
    lede: { size: "1.02rem", lh: "1.62", sizeNarrow: "0.97rem", lhNarrow: "1.52" },
  };
})();

/** HER FAQ HAS ONE HAIRLINE, AND IT IS NOT BETWEEN THE ROWS.
 *
 *  `FAQDetails` opens with `border-bottom: 1px solid rgba(COPPER, 0.22)` and
 *  closes with `&:last-child { border-bottom: none; }` — and its parent
 *  `FAQItemRow` wraps exactly one of them, so `:last-child` matches EVERY row
 *  and the first declaration paints on none of them. `FAQPanel`'s own
 *  `border-bottom: 1px solid var(--rule)` is the only rule that survives: one
 *  line under the whole block. Ours had it exactly inverted — a rule between
 *  every pair and nothing at the end — because `itemEdge` was transcribed off
 *  the star card's `&& [data-open] { border-bottom-color: … }`, which is a
 *  colour applied to a border with no width.
 *
 *  Both landings import the same `FAQAccordion`, so both carry it. The star
 *  card recolours the surviving rule to rgba(255,255,255,0.08); home-classic
 *  leaves it at `--rule`. Proven by shooting both sides at 1440 — her rows are
 *  separated by space, ours were separated by lines — and it is why removing
 *  eight borders makes her band 8px SHORTER, not taller. */
const LANDING_FAQ_RULES = (() => {
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "export const FAQPanel = styled.div` border-bottom: 1px solid var(--rule); `;",
  });
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find:
      "export const FAQDetails = styled.div` border-bottom: 1px solid rgba(${COPPER}, 0.1); " +
      "transition: background 0.4s ease; &:last-child { border-bottom: none; }",
  });
  guardOnly({
    file: `${HOME_DIR}/components/FAQAccordion.tsx`,
    find: "<FAQItemRow key={idx}> <FAQDetails data-open={isOpen}>",
  });
  guardOnly({ file: `${HOME_DIR}/OnePage.styles.ts`, find: "--rule: rgba(${COPPER}, 0.22);" });
  return { itemEdge: "none" };
})();

/** …and so does her `IntroSection`, the band above the gateway.
 *
 *  Its flex `gap` steps 1.25rem → 1rem and its `margin-bottom` 6rem → 4.25rem,
 *  while `Intro` itself drops the clamp for a flat 0.98rem on a 1.52 line. The
 *  MARGIN is the space above the gateway rather than below the intro — it
 *  collapses through a band that declares no top margin of its own — so it is
 *  authored on the gateway, where the row that renders it can be measured. */
const LANDING_INTRO_NARROW = (() => {
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "gap: 1.25rem; text-align: center; margin-bottom: 6rem;",
  });
  guardOnly({ file: `${HOME_DIR}/OnePage.styles.ts`, find: "gap: 1rem; margin-bottom: 4.25rem;" });
  guardOnly({
    file: `${HOME_DIR}/OnePage.styles.ts`,
    find: "font-size: clamp(1rem, 2vw, 1.15rem); line-height: 1.62;",
  });
  guardOnly({ file: `${HOME_DIR}/OnePage.styles.ts`, find: "font-size: 0.98rem; line-height: 1.52;" });
  // The hairline is the band's whole height delta, so its presence is guarded
  // as tightly as the numbers: 1px of rule plus one gap, at each width.
  guardOnly({
    file: `${HOME_DIR}/components/IntroSection.tsx`,
    find: "<IntroSectionWrapper> <FadeLine aria-hidden /> <Intro>",
  });
  return { gap: "1rem", size: "0.98rem", lh: "1.52", marginBottom: "4.25rem", rule: "17px", ruleWide: "21px" };
})();

/** …and her `GridSection` steps in the SAME query, 0.75rem → 2rem below.
 *  Already guarded above as `padding-bottom: 2rem`; named here so the band that
 *  states it says where it came from. 2rem = 32px. */
const LANDING_GRID_PAD_BOTTOM_NARROW = 32;

/** AND HER OTHER SIX ROOTS DECLARE NO RHYTHM AT ALL, WHICH IS NOT THE SAME AS
 *  DECLARING A DIFFERENT ONE.
 *
 *  The note above used to read "her OTHER page roots each declare their own and
 *  none of them is 1.5". Half of that is true — starseed's is 1.68 and
 *  open-your-journey's is its own — and half of it was never checked. Six roots
 *  declare NOTHING: `GatewayBody`, `OfferBody`, `ProductBody`, `ProductsBody`,
 *  `CourseBody` and writing's `PageShell`. A root that declares nothing runs at
 *  `normal`, and `normal` is roughly 1.15–1.2 for this face — so nineteen of
 *  her twenty-five routes read at `normal` and every one of ours read at the
 *  platform's 1.60. Measured in a browser on her live app, both sides, all 25.
 *
 *  It is only a pixel on each run that states no line-height of its own, which
 *  is why the page HEIGHTS were already right and why this went six rounds as
 *  single findings — her footer, the writing eyebrow, the card footer runs,
 *  sun-walk, the dossier shell, and this window's form labels — before anyone
 *  asked what the ROOT said. Her eyebrows are 16px tall and ours were 17, on
 *  every offer, gateway, experience and course page on the site.
 *
 *  `normal` is a real CSS value, so this is a stated rhythm like the other two,
 *  not an absence. */
const PAGE_RHYTHM_NONE = (() => {
  const roots = [
    [`${HOME_DIR}/landing-star-preview/[gateway]/GatewayPage.styles.ts`, "GatewayBody"],
    [`${HOME_DIR}/landing-star-preview/offer/[slug]/OfferDetail.styles.ts`, "OfferBody"],
    [`${HOME_DIR}/landing-star-preview/experience/[product]/ProductPreview.styles.ts`, "ProductBody"],
    [`${HOME_DIR}/landing-star-preview/experience/all-products/AllProducts.styles.ts`, "ProductsBody"],
    [`${HOME_DIR}/landing-star-preview/course/Course.styles.ts`, "CourseBody"],
    [`${HOME_DIR}/writing/WritingPage.styles.ts`, "PageShell"],
  ];
  for (const [file, name] of roots) {
    const src = normalizedSource(file);
    const m = src.match(new RegExp(`export const ${name} = styled[^\`]*\`([^\`]*)\``));
    if (!m) {
      drift.push(`${file}: ${name} is gone — the pages that inherit its rhythm no longer read from it`);
      continue;
    }
    if (/line-height\s*:/.test(m[1])) {
      drift.push(`${file}: ${name} now declares a line-height — its pages are no longer "normal"`);
    }
  }
  return "normal";
})();

/** AND `PageShell` IS ALSO THE ONE ROOT THAT ASKS FOR NO SMOOTHING.
 *
 *  `SMOOTHED_ROOTS` in `themeSql` reads the ten roots that declare
 *  `-webkit-font-smoothing: antialiased` and the site row states it once for
 *  all of them. Her writing page is the exception on both counts — no rhythm
 *  and no smoothing — so its tone row has to say so, and this guard is the
 *  other half of that claim: the site-wide rule is only safe to state BECAUSE
 *  exactly one page opts out, and if `PageShell` ever grows the declaration
 *  the opt-out becomes a lie about her design.
 *
 *  Measured 2026-08-10: stating the site rule without this escape moved 51 of
 *  63 captures towards her and pushed `/writing/` 3.85 points away at 390. */
const PAGE_SMOOTHING_NONE = (() => {
  const file = `${HOME_DIR}/writing/WritingPage.styles.ts`;
  const src = normalizedSource(file);
  const m = src.match(/export const PageShell = styled[^`]*`([^`]*)`/);
  if (!m) {
    drift.push(`${file}: PageShell is gone — /writing/ no longer reads its glyph rendering from it`);
  } else if (/font-smoothing\s*:/.test(m[1])) {
    drift.push(
      `${file}: PageShell now declares a font-smoothing — /writing/ is no longer the page that opts out`,
    );
  }
  return "auto";
})();

/** THE PAGES THE FONT SWITCH LEAVES AT "ORIGINAL" — her serif, page-wide.
 *
 *  `OnePage.styles` asks for all three of its faces through a variable with a
 *  fallback (`var(--landing-display-font, SERIF)`) and declares those variables
 *  in exactly one block: `&[data-font-preview="shared"]` on its own Body. The
 *  star landing hardcodes that attribute, so her front door paints Science
 *  Gothic / Space Grotesk / Space Mono — `themeFonts` above, and the faces
 *  Marthe named. `onePage.tsx` starts the same switch at `useState(false)` and
 *  `PearlChamberSubscriptionPage` renders the Body without the attribute at
 *  all, so on those two pages the three variables are never declared and every
 *  run on the page falls through to her `SERIF`.
 *
 *  Which is `font 74` of 80 compared strings on home-classic and 7 of 13 on
 *  pearl-chamber — the two worst numbers on the board, 43.52% and 45.99% at
 *  1440 — and neither was ever about which face ships. Both rows were authored
 *  out of the star landing's vocabulary, and the star landing is the page that
 *  OVERRIDES.
 *
 *  ALL SIX ROLES, one family. That is not laziness about the mapping: her page
 *  points display, body and meta at the same fallback, so the roles genuinely
 *  collapse here, and stating every one of them means the two entries with no
 *  font knob at all (rf-steps, rf-list — they simply inherit) and the one that
 *  is hard-wired to the accent role (rf-back-link) come along without needing a
 *  prop each.
 *
 *  AND THE SKY IS HERS, WHICH IT WAS NOT UNTIL 2026-08-10. These two pages
 *  paint nothing of their own — her `Body` sets custom properties, a min-height
 *  and a colour, and never a background — and the reasoning here used to be
 *  that a tone row with a ground would blank "the site backdrop this page is
 *  supposed to keep". That was half right: the page IS supposed to keep the sky
 *  it is inside, but the sky it is inside is her SITE SHELL, and
 *  `siteBackground` carries the STAR landing's blue-and-teal washes instead —
 *  they were authored from `LandingStarPreview.styles` because that is the page
 *  the forensics were run on. So the two pages with no ground of their own were
 *  the two showing another page's. `shellSky` is the shell itself. */
const pageType = (id, data) =>
  section(id, "rf-page-tone", "Page type", {
    ...shellSky(data),
    // Her shell sky is fixed, so it never reached her footer either — these two
    // pages show it because their Body paints nothing, not because it runs the
    // document. Scoped to the column it stops covering the chrome, and the
    // chrome gets the ground her html and body actually state.
    ...SITE_GROUND,
    // Her `Container` — `padding: 0 1.5rem`, one value, no mobile step, and
    // every band on these two pages is one. The frame's own rungs step 24 → 18
    // under 768, so without this the whole page laid out 12px wider on a phone
    // than hers and rewrapped.
    gutter: "1.5rem",
    gutterNarrow: "1.5rem",
    lineHeight: LANDING_LINE_HEIGHT,
    fontRoles: Object.fromEntries(
      Object.keys(themeFonts)
        .filter((k) => k !== "guards" && k !== "unbacked")
        .map((role) => [role, themeFonts.serif]),
    ),
  });

/** Her BackLink: one quiet mono run on the page container, carrying the
 *  main's 9.5rem top pad, hover to the page/product accent. */
const backLinkRow = (id, label, href, maxWidth, accent) =>
  section(id, "rf-back-link", "Back", { label, href, maxWidth, pageTop: true, accent });

/** ONE OFFER DETAIL PAGE — `offer/[slug]/OfferDetail.tsx`, seven parts.
 *
 *  Page tone · back link · ProductHero · (placeholder note) · DetailSection ·
 *  (inside) · (process or flow) · (note band) · CalloutBar — each on the entry
 *  derived from the component her page composes.
 *
 *  NOINDEX, ALWAYS. `page.tsx`'s generateMetadata sets
 *  `robots: { index: false, follow: false }` for every offer without exception,
 *  so these pages are unlisted on her live site today. Carrying the copy across
 *  without the directive would publish nine pages she has deliberately kept out
 *  of the index. */
function buildOfferPage(data, entry) {
  const offer = data.resolveOffer(entry);
  const detail = offer.detail;
  // The plate border every offer action wears — color-mix of the OFFER's
  // accent, exactly her `color-mix(in srgb, var(--hero-accent) 48%, transparent)`.
  const plateEdge = `color-mix(in srgb, ${offer.accent} 48%, transparent)`;
  const sections = [];

  // OfferBody's toned ground: the offer's own glow at 28% 8%, the fixed cool
  // counter-glow at 88% 68%, over the opaque dark.
  sections.push(
    pageTone(
      `sec-offer-tone-${offer.slug}`,
      [
        `radial-gradient(ellipse 62% 28% at 28% 8%, ${offer.glow}, transparent 72%)`,
        "radial-gradient(ellipse 44% 25% at 88% 68%, rgba(39, 78, 112, 0.12), transparent 72%)",
      ],
      // `OfferBody` declares no rhythm, so the page reads at `normal`.
      { lineHeight: PAGE_RHYTHM_NONE },
    ),
  );

  // Back to the door this offer sits behind. Her own link is
  // `/{lang}/landing-star-preview/{door}/`; the pooled renderer supplies the
  // language segment itself, so the stored href is the unprefixed one.
  sections.push(
    backLinkRow(
      `sec-offer-back-${offer.slug}`,
      "← Back",
      `/landing-star-preview/${offer.door}/`,
      82,
      offer.accent,
    ),
  );

  const statusLabel = (offer.status ? STATUS_LABEL[offer.status] : "") ?? "";
  sections.push(
    section(`sec-offer-hero-${offer.slug}`, "rf-product-hero", "Hero", {
      anchorId: offer.slug,
      // No fallback: an offer without artwork of its own shows none, rather
      // than borrowing Door One's constellation — her component's own rule.
      imageUrl: asset(offer.image ?? "", { optional: true }),
      imageAlt: offer.imageAlt ?? "",
      imagePosition: "left",
      frameTone: "glow",
      glow: offer.glow,
      eyebrow: detail.eyebrow,
      eyebrowTracking: 0.18,
      title: offer.title,
      titleTracking: -0.03,
      lead: offer.sub,
      priceLabel: offer.price,
      statusLabel,
      statusReady: offer.status === "available" || offer.status === "founding-access",
      statusColor: `rgb(${data.tokens.TEAL})`,
      ctas: [
        {
          label: offer.actionLabel,
          href: offer.actionHref,
          variant: "plate",
          arrow: true,
          color: plateEdge,
          ...(offer.actionExternal ? { target: "_blank" } : {}),
        },
      ],
      maxWidth: 82,
      accent: offer.accent,
      muted: bone(data, 0.63),
    }),
  );

  // The dashed-border warning she shows on unapproved copy. It travels because
  // it is TRUE of the page — four of the six are still `[[placeholder]]` in her
  // data, and hiding the notice would present draft wording as finished.
  if (offer.placeholder) {
    // PlaceholderNote verbatim: the note IS the paragraph — rf-media-copy's
    // band padding made this 49px line a 243px section and the worst band on
    // three draft pages.
    sections.push(
      section(`sec-offer-note-${offer.slug}`, "rf-mono-note", "Placeholder note", {
        text: verbatim(inlineCopy.offer.placeholderNote),
        marginTop: "1.5rem",
        maxWidth: 82,
        ink: `rgb(${data.tokens.BONE})`,
        muted: bone(data, 0.55),
      }),
    );
  }

  // DetailSection — the ruled three-column band. Her list items run a hair
  // lighter than her paragraphs (0.59 vs 0.61 of the bone).
  sections.push(
    section(`sec-offer-work-${offer.slug}`, "rf-detail-split", "The work", {
      eyebrow: detail.workEyebrow ?? verbatim(inlineCopy.offer.workEyebrow),
      title: detail.detailTitle,
      paragraphs: [...detail.paragraphs],
      items: [...detail.includes],
      listLabel: detail.listLabel ?? verbatim(inlineCopy.offer.includesLabel),
      listMuted: bone(data, 0.59),
      maxWidth: 82,
      spacedTop: true,
      accent: offer.accent,
      muted: bone(data, 0.61),
    }),
  );

  // The optional SECOND numbered band, for offers whose deliverable has parts
  // worth naming. The old rows dropped it — part of somatic-signature's lost
  // height.
  if (detail.inside && detail.inside.items.length) {
    sections.push(
      section(`sec-offer-inside-${offer.slug}`, "rf-process-steps", "Inside", {
        eyebrow: detail.inside.eyebrow,
        title: detail.inside.title,
        mode: "cards",
        steps: detail.inside.items.map((item, i) => ({
          marker: `0${i + 1}`,
          title: item.title,
          copy: item.copy,
        })),
        flowSteps: [],
        note: "",
        cardWash: "rgba(18, 63, 82, 0.5)",
        maxWidth: 82,
        spacedTop: true,
        accent: offer.accent,
        muted: bone(data, 0.56),
      }),
    );
  }

  // The movement — her compact one-line flow when the offer declares one,
  // otherwise the numbered cards. The flow was unauthorable before this pass.
  if (detail.processCompact) {
    sections.push(
      section(`sec-offer-steps-${offer.slug}`, "rf-process-steps", "The movement", {
        eyebrow: detail.processEyebrow ?? verbatim(inlineCopy.offer.processEyebrow),
        title: detail.processTitle ?? verbatim(inlineCopy.offer.processHeading),
        mode: "flow",
        steps: [],
        flowSteps: [...detail.processCompact.steps],
        note: detail.processCompact.copy,
        cardWash: "",
        maxWidth: 82,
        spacedTop: true,
        accent: offer.accent,
        muted: bone(data, 0.61),
      }),
    );
  } else if (detail.process && detail.process.length) {
    sections.push(
      section(`sec-offer-steps-${offer.slug}`, "rf-process-steps", "The movement", {
        eyebrow: detail.processEyebrow ?? verbatim(inlineCopy.offer.processEyebrow),
        title: detail.processTitle ?? verbatim(inlineCopy.offer.processHeading),
        mode: "cards",
        steps: detail.process.map((step, i) => ({
          // ProcessCard's marker is a zero-padded index, same as the tiles.
          marker: `0${i + 1}`,
          title: step.title,
          copy: step.copy,
        })),
        flowSteps: [],
        note: "",
        cardWash: "rgba(18, 63, 82, 0.5)",
        maxWidth: 82,
        spacedTop: true,
        accent: offer.accent,
        muted: bone(data, 0.56),
      }),
    );
  }

  // The optional prose band between the process and the closing callout —
  // a heading with no eyebrow over NoteCopy paragraphs. Also dropped before.
  if (detail.noteTitle) {
    sections.push(
      section(`sec-offer-noteband-${offer.slug}`, "rf-process-steps", "Note", {
        eyebrow: "",
        title: detail.noteTitle,
        mode: "cards",
        steps: [],
        flowSteps: [],
        note: (detail.noteParagraphs ?? []).join("\n\n"),
        cardWash: "",
        maxWidth: 82,
        spacedTop: true,
        accent: offer.accent,
        muted: bone(data, 0.61),
      }),
    );
  }

  sections.push(
    section(`sec-offer-close-${offer.slug}`, "rf-callout-bar", "Closing", {
      eyebrow: detail.closeEyebrow ?? verbatim(inlineCopy.offer.closeEyebrow),
      eyebrowTracking: 0.18,
      title: detail.closeTitle,
      titleMax: "22ch",
      titleTracking: -0.025,
      titleLineHeight: 1.04,
      copy: detail.closeCopy,
      price: "",
      glow: offer.glow,
      ctas: [
        {
          label: offer.actionLabel,
          href: offer.actionHref,
          variant: "plate",
          arrow: true,
          color: plateEdge,
          ...(offer.actionExternal ? { target: "_blank" } : {}),
        },
      ],
      maxWidth: 82,
      spacedTop: true,
      padBottom: "7rem",
      accent: offer.accent,
      muted: bone(data, 0.59),
    }),
  );

  const slug = `landing-star-preview/offer/${offer.slug}`;
  const title = `${offer.title} — Offer Preview`;
  return {
    slug,
    title,
    inNav: false,
    model: {
      id: `pm-rw-offer-${offer.slug}`,
      slug,
      title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: offer.paragraphs[0] ?? offer.sub,
          keywords: [],
          ogImage: asset(offer.image ?? "/images/landing-star-preview/GalacticSelf.jpg"),
          noindex: true,
        },
      },
      sections,
    },
  };
}

/** The five words her StatusBadge paints, so a card that says "Coming soon" on
 *  her site does not arrive silently bookable on the platform.
 *
 *  Derived from `inlineCopy.offerStatus` rather than written out again — the map
 *  used to be an unguarded literal here, which meant these five strings were the
 *  only transcriptions in the generator that could go stale in silence. */
const STATUS_LABEL = Object.fromEntries(
  Object.entries(inlineCopy.offerStatus).map(([status, entry]) => [status, verbatim(entry)]),
);

/** Cards.tsx: `READY_STATUSES = ["available", "founding-access"]` — the two
 *  statuses whose badge wears the teal instead of muting toward the ink. */
const READY_STATUSES = ["available", "founding-access"];

/** The badge pair rf-hud-cards wants, from her status enum. `available`
 *  deliberately has no label — an offer that is simply open says so by being
 *  open — so it arrives badge-less here too. */
function hudStatus(status) {
  return {
    statusLabel: (status ? STATUS_LABEL[status] : "") ?? "",
    statusReady: status ? READY_STATUSES.includes(status) : false,
  };
}

/** GatewayPage.tsx's `resolveHref`, reimplemented. Her version prefixes the
 *  language segment, which the pooled renderer supplies itself — so what is
 *  stored is the unprefixed path. */
function gatewayHref(target) {
  if (target === "contact") return "/#contact";
  if (target === "all-products") return "/landing-star-preview/experience/all-products/";
  if (target.startsWith("http")) return target;
  if (target.startsWith("/")) return target;
  return `/${target}/`;
}

/** One card in a gateway's grid — `DoorCard`, now rf-hud-cards' door layout
 *  verbatim: marker, optional 4/3 artwork, cardHeadline, copy, price + the
 *  real StatusBadge, and the bare "label →" link her ArchiveLink draws. The
 *  first cut folded the badge into rf-offer-card's `note` because that entry
 *  had no badge; the refinement retires the fold. */
function gatewayCardToItem(card) {
  return {
    marker: card.marker,
    title: card.title,
    copy: card.copy,
    imageUrl: card.image ? asset(card.image) : "",
    imageAlt: card.imageAlt ?? "",
    price: card.price ?? "",
    ...hudStatus(card.status),
    linkLabel: card.linkLabel ?? "",
    href: card.link ? gatewayHref(card.link) : "",
  };
}

/** ONE GATEWAY — `[gateway]/GatewayPage.tsx`, the page behind each door.
 *
 *  Back link · hero (artwork + lead + primary action) · a titled grid of cards ·
 *  optionally a SECOND grid for the courses · closing bar. `develop` renders its
 *  first grid as TrainingSteps rather than DoorCards — same three-up row, no
 *  artwork and no price, which is what those cards carry. */
function buildGatewayPage(data, id) {
  const g = data.star_gateways.GATEWAYS[id];
  const shared = data.star_gateways.shared;
  // `lead: string | string[]` — receive's is an array (one <p> per entry in
  // GatewayPage.tsx). Authored unjoined it 500'd the whole page: the hero
  // splits `lead` on blank lines and tenantPageMetadata trims `description`,
  // and an array answers to neither. The blank-line join is the exact inverse
  // of the split, so the render is per-paragraph either way.
  const lead = Array.isArray(g.lead) ? g.lead.join("\n\n") : g.lead;
  // GatewayPage.styles' tone table: the door's glow and accent, verbatim.
  const toneGlow = {
    meet: "rgba(46, 92, 135, 0.24)",
    receive: `rgba(${data.tokens.TEAL}, 0.1)`,
    develop: `rgba(${data.tokens.COPPER}, 0.11)`,
  }[id];
  const pageAccent = id === "receive" ? `rgb(${data.tokens.TEAL})` : `rgb(${data.tokens.COPPER})`;
  // Her gateway plates border COPPER at 38% even on the teal door — the
  // per-CTA color is what carries that.
  const plateEdge = `rgba(${data.tokens.COPPER}, 0.38)`;
  const sections = [];

  // GatewayBody's toned ground: the door's glow high right, the fixed cool
  // counter-glow low left, over the opaque dark.
  sections.push(
    pageTone(
      `sec-gw-tone-${id}`,
      [
        `radial-gradient(ellipse 74% 34% at 70% 6%, ${toneGlow}, transparent 72%)`,
        "radial-gradient(ellipse 50% 30% at 12% 75%, rgba(30, 67, 96, 0.11), transparent 72%)",
      ],
      // `GatewayBody` declares no rhythm, so the page reads at `normal`.
      { lineHeight: PAGE_RHYTHM_NONE },
    ),
  );

  // Her back link points at /landing-star-preview/, which REDIRECTS to the
  // homepage — so it is authored as the destination, not the hop.
  sections.push(backLinkRow(`sec-gw-back-${id}`, shared.backLink, "/", 86, pageAccent));

  // GatewayHero — the words-led seat: text left, scrimmed photograph right,
  // plate primary + monolink secondary (her "↓" is part of the text when the
  // secondary jumps in-page; the → span rides `arrow` when it navigates).
  const heroCtas = [
    {
      label: g.primary,
      href: gatewayHref(g.primaryHref),
      variant: "plate",
      arrow: true,
      color: plateEdge,
    },
  ];
  if (g.secondary) {
    heroCtas.push(
      g.secondaryHref
        ? {
            label: g.secondary,
            href: gatewayHref(g.secondaryHref),
            variant: "monolink",
            arrow: true,
            color: bone(data, 0.52),
          }
        : {
            label: `${g.secondary} ↓`,
            href: "#gateway-content",
            variant: "monolink",
            color: bone(data, 0.52),
          },
    );
  }
  sections.push(
    section(`sec-gw-hero-${id}`, "rf-product-hero", "Hero", {
      imageUrl: asset(g.image),
      imageAlt: g.alt,
      imagePosition: "right",
      frameTone: "scrim",
      glow: "",
      eyebrow: g.eyebrow,
      eyebrowTracking: 0.19,
      title: g.title,
      titleTracking: -0.045,
      lead,
      priceLabel: "",
      statusLabel: "",
      statusReady: false,
      statusColor: "",
      ctas: heroCtas,
      maxWidth: 86,
      accent: pageAccent,
      muted: bone(data, 0.63),
    }),
  );

  // SectionIntro — heading left, copy right, the hairline the grid sits on.
  // Carries the #gateway-content anchor her secondary jumps to.
  sections.push(
    section(`sec-gw-intro-${id}`, "rf-section-head", "Section intro", {
      anchorId: "gateway-content",
      eyebrow: g.sectionEyebrow,
      eyebrowTracking: 0.19,
      title: g.sectionTitle,
      copy: g.sectionCopy,
      maxWidth: 86,
      spacedTop: true,
      accent: pageAccent,
      muted: bone(data, 0.58),
    }),
  );

  // The grid under the intro: her training rail for cardsAsSteps, the door
  // card grid otherwise. Both sit flush on the intro's hairline. Her Cards.tsx
  // tones, authored: markers and links follow --page-accent, the price is
  // copper (ArchivePrice), the badge is teal on EVERY door (Badge), and the
  // card material is hudCardSurface's rgba(18, 63, 82, 0.5) wash.
  const doorGridTones = {
    cardWash: "rgba(18, 63, 82, 0.5)",
    cardWashFeatured: "",
    imageGlow: "",
    markerColor: pageAccent,
    priceColor: `rgb(${data.tokens.COPPER})`,
    linkColor: pageAccent,
    badgeColor: `rgb(${data.tokens.TEAL})`,
  };
  if (g.cardsAsSteps) {
    sections.push(
      section(`sec-gw-cards-${id}`, "rf-process-steps", "Steps", {
        eyebrow: "",
        title: "",
        mode: "rail",
        steps: g.cards.map((card) => ({
          marker: card.marker,
          title: card.title,
          copy: card.copy,
        })),
        flowSteps: [],
        note: "",
        cardWash: "rgba(17, 40, 59, 0.2)",
        maxWidth: 86,
        spacedTop: false,
        accent: pageAccent,
        muted: bone(data, 0.56),
      }),
    );
  } else {
    sections.push(
      section(`sec-gw-cards-${id}`, "rf-hud-cards", "Cards", {
        mode: "door",
        // Her ArchiveGrid is auto-fit over 20rem tracks — three cards land
        // three-up, two land two-up, one rule for both grids.
        columns: 0,
        heading: "",
        marginTop: "",
        ...doorGridTones,
        maxWidth: 86,
        items: g.cards.map(gatewayCardToItem),
        muted: bone(data, 0.56),
      }),
    );
  }

  if (g.offerCards && g.offerCards.length) {
    // GatewayPage.tsx: `content.offerEyebrow ?? shared.coursesEyebrow` — develop
    // heads its offer grid "ways into the practice", not the shared courses
    // strings. The first family cut dropped the override and the differ said so.
    sections.push(
      section(`sec-gw-courses-intro-${id}`, "rf-section-head", "Courses — intro", {
        eyebrow: g.offerEyebrow ?? shared.coursesEyebrow,
        eyebrowTracking: 0.19,
        title: g.offerTitle ?? shared.coursesTitle,
        copy: g.offerCopy ?? shared.coursesCopy,
        maxWidth: 86,
        spacedTop: true,
        accent: pageAccent,
        muted: bone(data, 0.58),
      }),
    );
    sections.push(
      section(`sec-gw-courses-${id}`, "rf-hud-cards", "Courses", {
        mode: "door",
        columns: 0,
        heading: "",
        marginTop: "",
        ...doorGridTones,
        maxWidth: 86,
        items: g.offerCards.map(gatewayCardToItem),
        muted: bone(data, 0.56),
      }),
    );
  }

  // The optional note band — "which one fits?" on receive, "practice, not
  // performance" on develop. GatewayPage.tsx renders it as one more
  // SectionIntro; the pre-family rows never authored it at all.
  if (g.noteTitle) {
    sections.push(
      section(`sec-gw-note-${id}`, "rf-section-head", "Note", {
        eyebrow: g.noteEyebrow ?? "",
        eyebrowTracking: 0.19,
        title: g.noteTitle,
        copy: g.noteCopy ?? "",
        maxWidth: 86,
        spacedTop: true,
        accent: pageAccent,
        muted: bone(data, 0.58),
      }),
    );
  }

  sections.push(
    section(`sec-gw-close-${id}`, "rf-callout-bar", "Closing", {
      eyebrow: shared.closeEyebrow,
      eyebrowTracking: 0.18,
      title: g.closeTitle,
      titleMax: "",
      titleTracking: -0.035,
      titleLineHeight: 0.98,
      copy: g.closeCopy,
      price: "",
      glow: toneGlow,
      ctas: [
        {
          label: g.closeCta,
          href: gatewayHref(g.primaryHref),
          variant: "plate",
          arrow: true,
          color: plateEdge,
        },
      ],
      maxWidth: 70,
      spacedTop: true,
      padBottom: "7rem",
      accent: pageAccent,
      muted: bone(data, 0.59),
    }),
  );

  const slug = `landing-star-preview/${id}`;
  const title = data.star_gateways.GATEWAY_TITLES[id];
  return {
    slug,
    title,
    inNav: false,
    // Hidden on her app ⇒ a draft here: built, finished, not currently served,
    // and now openable in the studio rather than buried in a content module.
    mode: HIDDEN_GATEWAYS.has(id) ? "draft" : "published",
    model: {
      id: `pm-rw-gateway-${id}`,
      slug,
      title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        // Every gateway is noindex on her site — `[gateway]/page.tsx`'s
        // generateMetadata sets robots index:false for all of them.
        // A meta description is one flat string — space-joined, not the body's
        // blank-line join. Her app writes none at all for these (title+robots
        // only), so the copy choice here is SEO surplus, not a parity target.
        meta: {
          description: Array.isArray(g.lead) ? g.lead.join(" ") : g.lead,
          keywords: [],
          ogImage: asset(g.image),
          noindex: true,
        },
      },
      sections,
    },
  };
}

/** THE THREE GATEWAYS, AND WHICH OF THEM SHE CURRENTLY SERVES.
 *
 *  `[gateway]/page.tsx` holds `HIDDEN_GATEWAYS = new Set(["meet", "develop"])`
 *  and REDIRECTS both to `/starseed/`; only `receive` renders.
 *
 *  All three are authored. The hidden two land as **drafts** (Gio's call,
 *  2026-08-06): she built those pages, they are finished copy, and the whole
 *  point of moving her onto the platform is that a page she is not serving
 *  becomes something she can open in the studio, look at, and publish — instead
 *  of content only reachable by reading a file in a repo she does not open.
 *
 *  A draft is publicly inert: the tenant route calls
 *  `readPublishedPageWithFlags`, which filters `mode = 'published'`. So the URL
 *  behaves exactly as it does on her app today (the redirect in HQ's
 *  `siteRedirects.ts`), and nothing about the cutover changes for a visitor.
 *
 *  READ FROM HER SOURCE, not transcribed (2026-08-08): this used to be a
 *  hardcoded copy of her set, and it was the one transcription in this file
 *  with no drift guard — her Lion's Gate launch (e01bb4c) un-hid `develop` and
 *  the generator kept emitting it as a draft with every check green. The set
 *  is hers now; if the declaration ever changes shape, this dies loudly
 *  instead of guessing. HQ's `siteRedirects.ts` must list exactly these. */
const HIDDEN_GATEWAYS = (() => {
  const src = fs.readFileSync(
    path.join(RW, "src/app/[lang]/(public)/(home)/landing-star-preview/[gateway]/page.tsx"),
    "utf8",
  );
  const m = src.match(/HIDDEN_GATEWAYS\s*=\s*new Set\(\[([^\]]*)\]\)/);
  if (!m) die("cannot find HIDDEN_GATEWAYS in her [gateway]/page.tsx — the declaration moved");
  return new Set([...m[1].matchAll(/"([a-z-]+)"/g)].map((x) => x[1]));
})();
const ALL_GATEWAYS = ["meet", "develop", "receive"];

/** Every offer her `offer/[slug]` route actually SERVES a detail page for.
 *
 *  `hidden` is not a filter here. It hides a card from the hub's auto-generated
 *  lists; the route itself reads the catalog by slug and does not consult it, so
 *  a hidden offer's page is live on her site today and its URL may be in
 *  somebody's inbox. Dropping it would 404 a page that answers 200 now.
 *
 *  The two waitlist-only offers are NOT here — they render `WaitlistForm` and
 *  are built by `buildWaitlistPage` below. */
function offersWithDetailPages(data) {
  return data.catalog.filter((e) => e.detail);
}

/** The other branch of her `offer/[slug]` route: an entry with a
 *  `waitlistTopic` and no `detail` renders `OfferWaitlist` instead. Her route
 *  reads it exactly this way — `hasDetailPage` first, `waitlistTopic` second,
 *  `notFound()` for anything with neither — so the two filters together are the
 *  whole of what that URL serves, and neither is a guess. */
function offersWithWaitlist(data) {
  return data.catalog.filter((e) => !e.detail && e.waitlistTopic);
}

/** ONE WAITLIST FORM PER OFFER, which is what her own topic string implies.
 *
 *  Her component posts to `/api/contact/` with `topic: offer.waitlistTopic`, so
 *  one endpoint and one inbox served both offers and the topic told them apart.
 *  Pooled, the FORM is the thing that gets its own row and its own submissions
 *  view — so the distinction her topic carried is carried by having two forms.
 *  Anything else would put "Extended Starseed Profile — waitlist" and
 *  "Awareness and Perception Training — waitlist" in one undifferentiated list
 *  and make her read the topic back out by eye. */
function buildWaitlistForm(offer) {
  const c = inlineCopy.waitlist;
  const title = `${offer.title} — waitlist`;
  // Her own topic string, asserted rather than reconstructed: if she renames an
  // offer, `waitlistTopic` and this title must still agree.
  if (offer.waitlistTopic && offer.waitlistTopic !== title) {
    die(
      `waitlist topic drift for ${offer.slug}: her data says ${JSON.stringify(offer.waitlistTopic)}, ` +
        `this generator would title the form ${JSON.stringify(title)}`,
    );
  }
  return {
    id: stableUuid(`${SITE}:waitlist:${offer.slug}`),
    slug: `waitlist-${offer.slug}`,
    title,
    definition: {
      title,
      version: 1,
      fields: [
        { ref: "name", type: "short_text", title: verbatim(c.fieldName), required: true },
        { ref: "email", type: "email", title: verbatim(c.fieldEmail), required: true },
        // Optional on her form and optional here — the one field a person can
        // skip, which is why it is the one that must not become required.
        // `rows: 2` is her Textarea, which states none and so opens at the HTML
        // default of 2; ours opened at the renderer's 4. 38px of height on a
        // 608px band — the largest single number on either waitlist page.
        {
          ref: "note",
          type: "long_text",
          title: verbatim(c.fieldNote),
          required: false,
          properties: { rows: 2 },
        },
      ],
      settings: { submitLabel: verbatim(c.submitLabel) },
      thankyou: { title: verbatim(c.successMessage), description: "" },
    },
  };
}

/** ONE WAITLIST PAGE — `OfferWaitlist.tsx`, three parts: back link, hero, form.
 *
 *  NOINDEX like every other offer page: `page.tsx`'s generateMetadata sets
 *  `robots: { index: false, follow: false }` for the whole route without
 *  distinguishing the two branches.
 *
 *  NO PLACEHOLDER NOTE AND NO PARAGRAPHS. The detail builder emits both because
 *  the detail page renders both; this one renders neither, so carrying them
 *  would publish notes she wrote to herself onto her live site. See copy.mjs's
 *  `waitlist` block. */
function buildWaitlistPage(data, entry, formId) {
  const offer = data.resolveOffer(entry);
  const c = inlineCopy.waitlist;
  // The four values the form band below states outright, each read back from
  // the file it came out of. `OfferMain`'s own padding is what closes every
  // offer page; her Form's width, gap and margin are what the band replaces the
  // `md` rung with; her Textarea states no `rows`, which is the whole of the
  // 38px; her Submit is a bare grid child, which is the whole of the 165 → 342.
  const WAITLIST_SRC = "src/components/WaitlistForm.tsx";
  const OFFER_STYLES = `${HOME_DIR}/landing-star-preview/offer/[slug]/OfferDetail.styles.ts`;
  guardOnly({ file: OFFER_STYLES, find: "width: min(100% - 3rem, 82rem); margin: 0 auto; padding: 9.5rem 0 7rem;" });
  guardOnly({
    file: WAITLIST_SRC,
    find: "const Form = styled.form` display: grid; gap: 0.9rem; max-width: 28rem; margin-top: 2rem; text-align: left; `;",
  });
  guardOnly({ file: WAITLIST_SRC, find: "const Textarea = styled.textarea`${fieldStyles}`;" });
  const waitlistSrc = normalizedSource(WAITLIST_SRC);
  if (/<Textarea[^>]*\brows=/.test(waitlistSrc)) {
    drift.push(`${WAITLIST_SRC}: her Textarea now states rows — the note field's \`rows: 2\` is no longer her default`);
  }
  if (/const Submit = styled\.button`[^`]*\b(width|align-self|justify-self)\s*:/.test(waitlistSrc)) {
    drift.push(`${WAITLIST_SRC}: her Submit now states its own width — \`--mf-submit-align: stretch\` may no longer be it`);
  }
  if (/const Form = styled\.form`[^`]*\bline-height\s*:/.test(waitlistSrc)) {
    drift.push(`${WAITLIST_SRC}: her Form now states a line-height — \`--mf-lh: normal\` is no longer her value`);
  }
  const statusLabel = (offer.status ? STATUS_LABEL[offer.status] : "") ?? "";
  if (offer.status && !statusLabel) {
    die(`no transcribed badge label for offer status ${JSON.stringify(offer.status)} (${offer.slug})`);
  }

  const sections = [
    // OfferBody's toned ground — the waitlist shares the detail page's shell.
    pageTone(
      `sec-wait-tone-${offer.slug}`,
      [
        `radial-gradient(ellipse 62% 28% at 28% 8%, ${offer.glow}, transparent 72%)`,
        "radial-gradient(ellipse 44% 25% at 88% 68%, rgba(39, 78, 112, 0.12), transparent 72%)",
      ],
      { lineHeight: PAGE_RHYTHM_NONE },
    ),
    backLinkRow(
      `sec-wait-back-${offer.slug}`,
      verbatim(c.backLabel),
      `/landing-star-preview/${offer.door}/`,
      82,
      offer.accent,
    ),
    section(`sec-wait-hero-${offer.slug}`, "rf-product-hero", "Hero", {
      anchorId: offer.slug,
      // THIS seat keeps the GalacticSelf fallback — her waitlist hero borrows
      // it on purpose (`offer.image ?? …` in OfferWaitlist.tsx), unlike the
      // detail hero which deliberately shows none.
      imageUrl: asset(offer.image ?? "/images/landing-star-preview/GalacticSelf.jpg"),
      imageAlt: offer.imageAlt ?? "",
      imagePosition: "left",
      frameTone: "glow",
      glow: offer.glow,
      // A LITERAL on this route, not the offer's status: every waitlist hero
      // says "In development"; the status reaches the page through the badge.
      eyebrow: verbatim(c.heroEyebrow),
      eyebrowTracking: 0.18,
      title: offer.title,
      titleTracking: -0.03,
      lead: offer.sub,
      priceLabel: offer.price,
      statusLabel,
      statusReady: offer.status === "available" || offer.status === "founding-access",
      statusColor: `rgb(${data.tokens.TEAL})`,
      // Her plate is an in-page jump to the form below — carried now that the
      // hero is her hero, with the form section holding the anchor.
      ctas: [
        {
          label: verbatim(c.heroAction),
          href: "#waitlist",
          variant: "plate",
          arrow: true,
          color: `color-mix(in srgb, ${offer.accent} 48%, transparent)`,
        },
      ],
      maxWidth: 82,
      accent: offer.accent,
      muted: bone(data, 0.63),
    }),
    section(`sec-wait-head-${offer.slug}`, "rf-process-steps", "Stay in the loop", {
      anchorId: "waitlist",
      eyebrow: verbatim(c.sectionEyebrow),
      title: verbatim(c.sectionHeading),
      mode: "cards",
      steps: [],
      flowSteps: [],
      note: "",
      cardWash: "",
      maxWidth: 82,
      spacedTop: true,
      accent: offer.accent,
    }),
    // WaitlistForm.tsx, carried as --mf-* vars on the shared renderer: the
    // labels in her mono meta face (the ACCENT type role — Space Mono here),
    // uppercase at 0.65rem over bone-0.62 with no required asterisks (her
    // design marks nothing); square fields on rgba(0,0,0,0.28) with the teal
    // focus; the submit as her quiet teal plate — teal ink on teal-8%,
    // 0.68rem mono uppercase, teal-16% under the cursor — never the
    // platform's dark-on-accent pill. Her Form is a 28rem column with a
    // 0.9rem grid gap.
    section(`sec-wait-form-${offer.slug}`, "form-live", "Waitlist", {
      formId,
      accent: "",
      hideHeader: true,
      maxWidth: 448,
      // THE FRAME BROUGHT ITS OWN GUTTER AND THE PAGE'S CLOSE HAD NOWHERE TO
      // LIVE. Her `Form` is a `margin-top: 2rem` column inside `OfferMain`
      // (`width: min(100% - 3rem, 82rem)`, `padding: 9.5rem 0 7rem`), so at 390
      // it is 342 wide with 112px of ground under it. Ours sat on the `md`
      // rung — 32px 20px — which read the top right by accident, ran 350 wide,
      // and closed the page 80px early. Stated outright now, the same three
      // knobs her home contact card carries.
      padding: "none",
      marginTop: "2rem",
      sideInset: "1.5rem",
      padBottom: "7rem",
      vars: {
        "--mf-ink": `rgb(${data.tokens.BONE})`,
        "--mf-gap": "0.9rem",
        // Her form declares no line-height, so it sets at `normal`; ours
        // inherited the platform's 1.6 and every label ran a pixel tall.
        "--mf-lh": "normal",
        "--mf-field-gap": "0.45rem",
        "--mf-radius": "0",
        "--mf-label-font": "var(--tgv-fontAccent, inherit)",
        "--mf-label-size": "0.65rem",
        "--mf-label-tracking": "0.08em",
        "--mf-label-transform": "uppercase",
        "--mf-label-color": bone(data, 0.62),
        "--mf-req-display": "none",
        "--mf-field-pad": "0.75rem 0.85rem",
        "--mf-field-size": "0.95rem",
        "--mf-field-bg": "rgba(0, 0, 0, 0.28)",
        "--mf-field-edge": bone(data, 0.18),
        "--mf-field-focus": `rgb(${data.tokens.TEAL})`,
        // Her Submit is a plain grid child of a `display: grid` Form, so it
        // spans the column — 342 at 390. Ours is a flex child that sets
        // `align-self: flex-start`, so it shrank to its label: 165.
        "--mf-submit-align": "stretch",
        "--mf-submit-pad": "0.85rem 1.1rem",
        "--mf-submit-size": "0.68rem",
        "--mf-submit-tracking": "0.08em",
        "--mf-submit-transform": "uppercase",
        "--mf-submit-font": "var(--tgv-fontAccent, inherit)",
        "--mf-submit-ink": `rgb(${data.tokens.TEAL})`,
        "--mf-submit-bg": `rgba(${data.tokens.TEAL}, 0.08)`,
        "--mf-submit-bg-hover": `rgba(${data.tokens.TEAL}, 0.16)`,
        "--mf-submit-edge": `rgba(${data.tokens.TEAL}, 0.4)`,
      },
    }),
  ];

  const slug = `landing-star-preview/offer/${offer.slug}`;
  const title = `${offer.title} — Offer Preview`;
  return {
    slug,
    title,
    inNav: false,
    model: {
      id: `pm-rw-offer-${offer.slug}`,
      slug,
      title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: offer.sub,
          keywords: [],
          ogImage: asset(offer.image ?? "/images/landing-star-preview/GalacticSelf.jpg"),
          noindex: true,
        },
      },
      sections,
    },
  };
}

/** THE OFFERING LISTING — `experience/all-products`.
 *
 *  Every door on the hub ends in a "see all" CTA and this is where it lands, so
 *  until it exists three published pages point at a 404. It is also the only
 *  page on the site that shows the WHOLE catalog at once: nine tiles in three
 *  door-grouped grids, two across.
 *
 *  IT IS A LIST, WHICH IS WHY NOTHING HERE IS TRANSCRIBED. The page's own words
 *  are four lines — a back link, a header, three door labels, a closing callout
 *  — and they are imported from `AllProducts.content.ts` like the rest of her
 *  data. The tiles come from `offersByDoor`, HER filter, which drops the three
 *  `hidden` offers. That is a different rule from the offer PAGES, which ignore
 *  `hidden` because the route reads the catalog by slug: an offer can be off
 *  the list and still have a live page, and both facts travel.
 *
 *  NOINDEX, like every other page under `landing-star-preview/`. Her
 *  `metadata` sets `robots: { index: false, follow: false }` on this route
 *  today. It is her live commerce listing and she may well want it indexed
 *  after the move — but that is a switch in the studio, not a decision this
 *  generator gets to make on her behalf. */
function buildAllProducts(data) {
  const { header, doorSections, closing } = data.star_all;

  // ProductsBody's toned ground — same forensics as sec-star-tone above, this
  // page's OWN wash: teal high and centered, copper low and right. Without it
  // the pooled page wore the site orbs' BLUE wash (the star landing's colours)
  // pinned to the viewport — the wrong glow in the wrong box.
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/experience/all-products/AllProducts.styles.ts`,
    find: "radial-gradient(ellipse 66% 30% at 50% 4%, rgba(${TEAL}, 0.1), transparent 72%)",
  });
  guardOnly({
    file: `${HOME_DIR}/landing-star-preview/experience/all-products/AllProducts.styles.ts`,
    find: "radial-gradient(ellipse 44% 24% at 88% 76%, rgba(${COPPER}, 0.08), transparent 72%)",
  });
  const sections = [
    pageTone(
      "sec-all-tone",
      [
        `radial-gradient(ellipse 66% 30% at 50% 4%, rgba(${data.tokens.TEAL}, 0.1), transparent 72%)`,
        `radial-gradient(ellipse 44% 24% at 88% 76%, rgba(${data.tokens.COPPER}, 0.08), transparent 72%)`,
      ],
      // `ProductsBody` declares no rhythm, so the page reads at `normal`.
      { lineHeight: PAGE_RHYTHM_NONE },
    ),
    // "← Back to the three doors" — her href is `/{lang}/landing-star-preview/`,
    // which on both apps is a redirect to the site root. The doors ARE the home
    // page now, so the stored link goes straight there rather than through the
    // hop. Her ProductsMain runs the 86rem container.
    backLinkRow("sec-all-back", data.star_all.backLink, "/", 86, `rgb(${data.tokens.TEAL})`),
    // Her Header, on rf-section-head at h1 scale. The first cut authored this
    // as rf-media-copy and the differ measured the drift: h1 51.2px against
    // her 64.8, the eyebrow in Space Grotesk against her Space Mono. Every
    // geometry knob below is AllProducts.styles verbatim — Header's 0.62fr
    // column from 18rem, the 6rem gap, clamp(3rem, 6vw, 5rem) over the 11%
    // hairline — and the eyebrow rides the accent type role like the rest of
    // the family's mono runs.
    section("sec-all-head", "rf-section-head", "Header", {
      eyebrow: header.eyebrow,
      eyebrowTracking: 0.18,
      title: header.title,
      headingLevel: 1,
      titleSize: "clamp(2.65rem, 4.5vw, 4.4rem)",
      titleTracking: -0.03,
      titleLh: 1.04,
      titleMaxCh: 15,
      copy: header.copy,
      copyFraction: 0.62,
      copyMinRem: 18,
      gapRem: 6,
      padBottom: "clamp(3rem, 6vw, 5rem)",
      borderAlpha: 11,
      copySize: "clamp(1rem, 1.45vw, 1.16rem)",
      copyLh: 1.7,
      copyMaxRem: 0,
      stackAt: 760,
      maxWidth: 86,
      spacedTop: false,
      ink: `rgb(${data.tokens.BONE})`,
      accent: `rgb(${data.tokens.TEAL})`,
      muted: bone(data, 0.61),
    }),
  ];

  let firstDoor = true;
  for (const door of doorSections) {
    const offers = data.offersByDoor(door.id);
    if (!offers.length) continue;
    sections.push(
      // OfferingTile over ProductGrid, now rf-hud-cards' tile layout verbatim:
      // heading = her DoorHeading (small display h2 IN THE INK — the first
      // cut's 52px teal row heading was the loudest census row on this page),
      // contained artwork on the teal-glow well, the "01 · <sub>" index run,
      // and the foot pinned level — copper price left, copper 94% sliding-arrow
      // link right. DoorSection's own rhythm rides marginTop; the first
      // section sits closer under the page header, like hers.
      section(`sec-all-${door.id}`, "rf-hud-cards", door.label, {
        mode: "tile",
        columns: 2,
        heading: door.label,
        marginTop: firstDoor ? "clamp(3rem, 5vw, 4rem)" : "clamp(4rem, 7vw, 6rem)",
        cardWash: "rgba(18, 63, 82, 0.5)",
        cardWashFeatured: "rgba(18, 63, 82, 0.62)",
        imageGlow: `rgba(${data.tokens.TEAL}, 0.08)`,
        markerColor: `rgba(${data.tokens.TEAL}, 0.7)`,
        priceColor: `rgb(${data.tokens.COPPER})`,
        linkColor: `rgba(${data.tokens.COPPER}, 0.94)`,
        badgeColor: `rgb(${data.tokens.TEAL})`,
        maxWidth: 86,
        items: offers.map((offer, i) => ({
          // OfferingTile prints "01 · <sub>" as one line above the title, so the
          // index and the qualifier arrive joined the way she wrote them.
          marker: `0${i + 1} · ${offer.sub}`,
          title: offer.title,
          copy: offer.paragraphs[0] ?? offer.sub,
          imageUrl: offer.image ? asset(offer.image) : "",
          imageAlt: offer.imageAlt ?? "",
          price: offer.price,
          // The StatusBadge beside the price. A tile that says "Coming soon" on
          // her site must not arrive silently bookable here.
          ...hudStatus(offer.status),
          linkLabel: offer.hasDetailPage ? "Learn more" : "View offering",
          // resolveOffer already decided where the tile points; her component
          // only adds the language segment, which the pooled renderer supplies.
          href: offer.href,
          target: offer.external ? "_blank" : "",
          // AllProducts.tsx: `featured={index === 0}` — the first tile per door
          // floors taller under the brighter wash.
          featured: i === 0,
        })),
        muted: bone(data, 0.57),
      }),
    );
    firstDoor = false;
  }

  sections.push(
    // Her closing is a CalloutBar (variant "offerings") and the family already
    // derived that entry — the first cut authored rf-media-copy here and the
    // differ read the drift off the eyebrow face. Offerings values verbatim:
    // teal eyebrow and glow, 20ch title at the -0.025/1.04 metrics, and the
    // action as the bare copper monolink, not a plate.
    section("sec-all-close", "rf-callout-bar", "Closing", {
      eyebrow: closing.eyebrow,
      eyebrowTracking: 0.18,
      title: closing.title,
      titleMax: "20ch",
      titleTracking: -0.025,
      titleLineHeight: 1.04,
      copy: closing.copy,
      price: "",
      glow: `rgba(${data.tokens.TEAL}, 0.1)`,
      ctas: [
        {
          label: closing.actionLabel,
          href: "/#contact",
          variant: "monolink",
          arrow: true,
          color: `rgb(${data.tokens.COPPER})`,
        },
      ],
      maxWidth: 86,
      spacedTop: true,
      padBottom: "7rem",
      ink: `rgb(${data.tokens.BONE})`,
      accent: `rgb(${data.tokens.TEAL})`,
      muted: bone(data, 0.59),
    }),
  );

  const slug = "landing-star-preview/experience/all-products";
  const title = "All Experiences — Landing Preview";
  return {
    slug,
    title,
    inNav: false,
    model: {
      id: "pm-rw-all-products",
      slug,
      title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: header.copy,
          keywords: [],
          ogImage: asset("/images/landing-star-preview/GalacticSelf.jpg"),
          noindex: true,
        },
      },
      sections,
    },
  };
}

/** `/pearl-chamber` — the weekly intention holding, and her one live
 *  subscription. The offer catalog links here (`href: "/pearl-chamber"`) and so
 *  does the homepage offerings row, so this URL has been the funnel's one dead
 *  end on the pooled renderer: two published surfaces pointing at a 404.
 *
 *  ONE NESTED THING BECOMES TWO STACKED ONES. On her page the form lives INSIDE
 *  the offer card's detail panel — card head and artwork on the left, copy plus
 *  the form plus the price on the right. `rf-offer-card` cannot host a form in
 *  its panel, so the card and the form become siblings: the card carries the
 *  title, the artwork, the lead paragraph and the price, and the form follows
 *  it. Everything a visitor reads survives and in the same order; what changes
 *  is that the two sit one above the other rather than side by side.
 *
 *  INDEXED, unlike everything under `landing-star-preview/`. Her `page.tsx`
 *  sets a canonical and no robots directive — this is a page she sells from. */
function buildPearlChamber(data, formId) {
  const c = inlineCopy.pearl;
  const sections = [
    // Her serif, page-wide. This page renders `OnePage.styles`' Body with no
    // `data-font-preview` attribute at all — not "original" but ABSENT — so the
    // three landing variables are never declared and every run on it, including
    // the form's own labels, falls through to SERIF.
    pageType("sec-pearl-type", data),
    section("sec-pearl-card", "rf-offer-card", "The Pearl Chamber", {
      columns: 1,
      heading: "",
      bulletGlyph: "✦",
      padTop: 16,
      padBottom: 12,
      // Her `CardBody` again — this page renders the same card vocabulary as
      // the classic landing's offerings row, one card wide.
      muted: bone(data, 0.65),
      // THE 160px NOTHING ON THIS PAGE WAS CARRYING. Her page is
      // `Body > Main > GridSection > OfferingsStack > OfferingsRow > OfferCard`
      // and every rung above the card contributes: `Main`'s `padding: 8rem 0
      // 6rem` (128), `GridSection`'s `padding-top: 1rem` (16) and the row's own
      // `clamp(10px, 1.5vw, 16px)` (16) — which is the 160px band the census
      // read at 100%, present on her page and simply absent from ours. The
      // classic landing gets `Main`'s 8rem from its hero's `padAsMargin`; this
      // page has no hero, so it had nobody to get it from.
      // …and `Main`'s closing `padding-bottom: 6rem` below it. This was left
      // OFF for one window and the reason is worth keeping: her form lives
      // inside the card's `FeatureDetail`, so while ours was a separate band
      // underneath, a `marginBottom` here opened 96px in the MIDDLE of one card
      // and took the page from 39.12% to 43.70%. The form moved inside the card
      // in the same commit as this line; the 6rem now falls where hers falls,
      // which is under everything.
      marginTop: "8rem",
      marginBottom: "6rem",
      // …AND HER `Main` CARRIES TWO PADDINGS, NOT ONE. It closes on a
      // `@media (max-width: 767px)` that steps the whole shorthand to
      // `7rem 0 4.5rem`. The pair above took the wide half only, so at 390
      // every word on this page sat 16px lower than hers and the opening
      // 546px segment — which is most of the page above the fold — diffed
      // 20.33%. Her `GridSection` steps in the same query, 0.75rem → 2rem
      // below, which is `padBottom` 12 → 32.
      marginTopNarrow: LANDING_MAIN_PAD_NARROW.top,
      marginBottomNarrow: LANDING_MAIN_PAD_NARROW.bottom,
      padBottomNarrow: LANDING_GRID_PAD_BOTTOM_NARROW,
      items: [
        {
          anchorId: "pearl-chamber",
          title: verbatim(c.title),
          sub: verbatim(c.sub),
          // Three paragraphs since e01bb4c; rf-offer-card splits body on \n\n.
          body: [c.lead1, c.lead2, c.lead3].map(verbatim).join("\n\n"),
          listLabel: "",
          bullets: [],
          note: "",
          price: verbatim(c.price),
          // No CTA on the card. Her price sits alone in the foot while the
          // button that takes the money is behind the form — putting one here
          // would be the shortcut past the intention.
          ctaLabel: "",
          ctaHref: "",
          variant: "feature",
          leadImageUrl: asset("/images/ReikiBox.png"),
          leadImageAlt: verbatim(c.imageAlt),
          leadImageGlow: false,
          // THE FORM IS PART OF THE CARD, not a band under it — 2026-08-10.
          // Her `FeatureDetail` reads `CardBody` (three paragraphs, then the
          // `Form`) and only then `CardFoot` with the price. Carried as its own
          // `form-live` section this sat OUTSIDE the plate at the page gutter,
          // full-bleed, with the price stranded above it; it was the whole of
          // this page's remaining diff at every viewport and the only reason
          // 768 and 390 read `sections 4→2`. `rf-offer-card` hosts it now.
          formId,
          formShowHeader: false,
          // HER PEARL FORM IS NOT HER CONTACT FORM, and the two share nothing
          // but the ritual button. `PearlChamberSubscriptionPage.styles` gives
          // it its own `Form`/`Field`: the label is uppercase 0.86rem on
          // `--accent-dim` — the teal at 0.45, where the contact form's is bone
          // at 0.7 — and the inputs wear `var(--rule)` (the copper at 0.22)
          // over a 2.5% white wash at 8px, not the contact form's `#2f4f47` at
          // 12px. Authoring one from the other would have been the
          // duplicate-but-different trap in reverse.
          formVars: {
            "--mf-gap": "1rem",
            "--mf-field-gap": "0.4rem",
            "--mf-label-font": "var(--tgv-fontBody, inherit)",
            "--mf-label-size": "0.86rem",
            "--mf-label-weight": "400",
            "--mf-label-tracking": "0.08em",
            "--mf-label-transform": "uppercase",
            // `--accent-dim`, which is her teal at 0.45 and nothing else on the
            // page uses.
            "--mf-label-color": `rgba(${data.tokens.TEAL}, 0.45)`,
            // HER FORM MARKS NOTHING REQUIRED, and all three of its fields are.
            // `Field` is a bare label with the field's name in it; the browser's
            // own validation does the telling on submit. Ours printed a red `*`
            // beside every label on a page that has no red on it.
            "--mf-req-display": "none",
            "--mf-field-pad": "0.8rem 0.9rem",
            "--mf-field-size": "1rem",
            // HER INPUTS TAKE THE PAGE'S RHYTHM, not the form renderer's.
            // `Field`'s `input, textarea` opens on `font: inherit` before it
            // states a size, and the shorthand carries line-height with it — so
            // her inputs run at `Body`'s 1.5 (24px at 16px type) where ours ran
            // the renderer's 1.4 (22.4px). Two px per input, four across the
            // three fields, and the whole card measured 4px short of hers.
            "--mf-field-lh": LANDING_LINE_HEIGHT,
            "--mf-field-font": "var(--tgv-fontBody, inherit)",
            "--mf-radius": "8px",
            "--mf-field-bg": "rgba(255, 255, 255, 0.025)",
            // `var(--rule)`.
            "--mf-field-edge": `rgba(${data.tokens.COPPER}, 0.22)`,
            "--mf-ink": `rgb(${data.tokens.BONE})`,
            "--mf-field-focus": `rgba(${data.tokens.TEAL}, 0.45)`,
            "--mf-field-focus-ring": `0 0 0 1px rgba(${data.tokens.TEAL}, 0.12)`,
            "--mf-placeholder": "#b69fa1",
            "--mf-placeholder-opacity": "1",
            // Her `textarea { min-height: 9rem }`, not the contact form's 140px.
            "--mf-textarea-minh": "144px",
            // THE BUTTON STRETCHES, and it took a screenshot to see why. Her
            // `RitualButtonButton` is `display: inline-flex` — which reads as an
            // auto-width button and is how this was first authored — but it is a
            // direct child of `Form`, a `display: grid` with the default
            // `justify-items: stretch`, so it fills the column at every width.
            // An inline-* box in a grid is still a grid ITEM.
            "--mf-submit-width": "100%",
            "--mf-submit-align": "stretch",
            "--mf-submit-minh": "46px",
            "--mf-submit-pad": "0.76rem 1rem",
            "--mf-submit-size": "0.9rem",
            "--mf-submit-weight": "400",
            "--mf-submit-font": "var(--tgv-fontBody, inherit)",
            "--mf-submit-tracking": "0.08em",
            "--mf-submit-lh": "1",
            "--mf-submit-transform": "none",
            // `ritualButtonCss`'s `font-variant: small-caps` — the case every
            // button on her site is set in, and the one thing about it a host
            // could not reach until this run.
            "--mf-submit-variant": "small-caps",
            // …and its `@media (max-width: 767px)` step, which is why "continue
            // to payment" censused 13.44px against our 14.4px at 390.
            "--mf-submit-pad-narrow": "0.72rem 0.88rem",
            "--mf-submit-size-narrow": "0.84rem",
            "--mf-submit-ink": `rgb(${data.tokens.COPPER})`,
            "--mf-submit-bg": `linear-gradient(180deg, rgba(${data.tokens.COPPER}, 0.07) 0%, rgba(255, 255, 255, 0.018) 100%)`,
            "--mf-submit-edge": `rgba(${data.tokens.COPPER}, 0.22)`,
            "--mf-submit-shadow": `inset 0 1px 0 rgba(${data.tokens.BONE}, 0.06), 0 10px 30px rgba(0, 0, 0, 0.16)`,
          },
        },
      ],
    }),
  ];

  return {
    slug: "pearl-chamber",
    title: verbatim(c.title),
    inNav: false,
    model: {
      id: "pm-rw-pearl-chamber",
      slug: "pearl-chamber",
      title: verbatim(c.title),
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: verbatim(c.metaDescription),
          keywords: [],
          ogImage: asset("/images/ReikiBox.png"),
        },
      },
      sections,
    },
  };
}

/** `/starseed` — the Starwoven Journey sales page, and the last of bucket B.
 *
 *  THE ROUTE KEEPS THE OLD NAME ON PURPOSE. Her STATUS.md: "the stable internal
 *  route and component filenames still use starseed / StarseedOraclePage for
 *  now… avoids a premature routing rename while the product name is still
 *  settling." The page sells the Starwoven Journey; the URL says starseed. Both
 *  are carried as they are, because the URL is the one somebody has.
 *
 *  IT UNBLOCKS THREE LINKS. The two hidden gateways redirect here on her app
 *  and were held out of `siteRedirects.ts` because the target did not exist;
 *  the `starwoven-journey` tile on the offering listing points here too. All
 *  three are live the moment this row is.
 *
 *  WHAT DOES NOT COME ACROSS, named rather than quietly dropped:
 *    • the three method cards' inline SVG icons (a sky-glyph, a book, a globe).
 *      The copy travels; the icons are drawn in the page file and there is no
 *      per-item icon on `rf-offer-card`.
 *    • `Reveal`'s scroll-in animation, which is presentation, not content.
 *    • the hero's second CTA ("See what is inside") — her component declares it
 *      in `content.hero.secondary` and never renders it. Carrying a button she
 *      took out would add a link to her page, not preserve one. */
function buildStarseed(data) {
  const c = data.oracleContent;
  const s = inlineCopy.starseed;
  const sections = [];
  const T = data.tokens;

  // ── HER SEATS, transcribed and guarded ────────────────────────────────────
  // The row shipped in the first cut with the entry's PLATFORM defaults, and
  // the differ said so plainly: Space Mono absent from the page entirely (26
  // elements → 0), 66 size / 60 weight / 60 colour mismatches. The page has its
  // own ThemeProvider (`starseed/theme.ts`) and its bands borrow the star
  // landing's Intro type, so every value below is read off one of those two
  // files rather than guessed.
  const SS = `${HOME_DIR}/starseed`;
  const SSPAGE = `${SS}/StarseedOraclePage.tsx`;
  const LSP = `${HOME_DIR}/landing-star-preview/LandingStarPreview.styles.ts`;
  // The shared ritual plate every CTA on her site is cut from.
  const RITUAL = "src/app/[lang]/_allPageComponents/buttons/RitualButton.tsx";
  // The two SHARED components this page mounts. Three of its four grids were
  // authored as `rf-offer-card` in the first cut and none of them is one: the
  // stages and the method cards are her hudCardSurface material (rf-hud-cards),
  // the steps are the shared <TrainingStep> rail (rf-process-steps), and the
  // closing block is the shared <CalloutBar variant="gateway"> (rf-callout-bar).
  // Every one of those entries was already DERIVED from these two files during
  // the family pass — the mistake rf-hud-cards' own header records for her
  // gateway grids, made a second time here.
  const CARDS = "src/components/Cards.tsx";
  const CALLOUT = "src/components/CalloutBar.tsx";
  /** THIS PAGE'S ACCENT IS TEAL, AND HER SHARED COMPONENTS READ IT FROM THE
   *  PAGE, NOT FROM THE SITE.
   *
   *  `--page-accent` is declared once per page in her source and every shared
   *  band picks it up: `CalloutBar`'s gateway variant paints its eyebrow and
   *  its price `var(--page-accent)`, and `Cards.tsx` names the same variable in
   *  its own header. On the landing that variable is COPPER, on `/receive/` and
   *  here it is TEAL — one declaration, and the whole vocabulary follows it.
   *
   *  Ours has no page-level accent: a section's `accent` prop or the site's
   *  role, and these two bands stated neither, so six strings came out in the
   *  site's copper — the four "how it works" step numbers, the closing
   *  eyebrow and the price. Nothing else on the page was wrong: same y, same
   *  size, same weight, same Space Mono, same band heights. Colour only, and
   *  only where her shared components ask the PAGE.
   *
   *  Stated on the two bands rather than invented as a page-wide default,
   *  because that is the granularity her own file has: the hero already
   *  carries `accentInk` teal for the same reason, and the closing plate stays
   *  copper right beside a teal eyebrow — a page accent nobody can override
   *  would have been wrong within one band of itself. */
  const PAGE_ACCENT = (() => {
    guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "--page-accent: rgb(${TEAL});" });
    guardOnly({ file: CALLOUT, find: 'if ($variant === "gateway") return "var(--page-accent)";' });
    return `rgb(${T.TEAL})`;
  })();
  // Her three method-card glyphs, extracted (not transcribed) from CARD_ICONS.
  const methodGlyphs = jsxSvgDataUris({ file: SSPAGE, arrayName: "CARD_ICONS", expect: 3 });
  // The three facts that make them what they are: the pairing is POSITIONAL,
  // and the size/gap/paint live on her `Card svg` rule, not on the svg itself.
  guardOnly({ file: SSPAGE, find: "{cardIcons[index]}" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "svg { width: 30px; height: 30px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "color: ${({ theme }) => theme.teal}; margin-bottom: 16px;" });
  // Her Card's `p` rule restates size and colour and NOT line-height — the
  // copy keeps `P`'s own 1.72. Both halves are guarded so a change to either
  // fails the run rather than moving three cards quietly.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "p { margin: 0; font-size: 15px; color: ${({ theme }) => theme.muted}; }" });
  // theme.ts — the page's own tokens.
  guardOnly({ file: `${SS}/theme.ts`, find: 'h1Color: "#f5f9f8"' });
  guardOnly({ file: `${SS}/theme.ts`, find: 'copper: "#c79a86"' });
  guardOnly({ file: `${SS}/theme.ts`, find: "pullQuoteBorderRgba: `rgba(${COPPER}, 0.34)`" });
  // Her PullQuote, declaration by declaration — the band closes on it.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "max-width: 34rem; margin: 2.5rem auto 0; padding: 1.5rem 1.75rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: clamp(1.25rem, 2.35vw, 1.75rem); font-style: italic; line-height: 1.42; text-align: center;" });
  // Her hero's FinePrint and PrimaryButton — the line under the button and the
  // widening that makes the plate hers.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 18px; font-size: 11.5px; line-height: 1.65;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding-inline: 1.35rem;" });
  // …and that it extends the BARE anchor. The star is `RitualButtonStar`, a
  // sibling this page never mounts — if she ever wraps PrimaryButton around
  // the starred form, this guard fails rather than the button quietly staying
  // 43px narrow than her own.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "export const PrimaryButton = styled(RitualButtonAnchor)`" });
  // Her plate's TWO tones, one from each file. The rest is site-wide and the
  // hover is this button's alone — a single guard on either would let the
  // other drift silently, and they are what the CTA's `color`/`hoverColor`
  // carry. `--button-hover-rgb` is her own name for the second statement.
  guardOnly({ file: RITUAL, find: "color: rgb(${COPPER});" });
  guardOnly({ file: RITUAL, find: "color: rgb(var(--button-hover-rgb, ${TEAL}));" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "--button-hover-rgb: ${TEAL};" });
  // Her HeroGrid's stack point and the flat gap it opens to there.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "@media (max-width: 900px) { grid-template-columns: 1fr; gap: 40px; }" });
  // The page line-height her Eyebrow inherits and never restates.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "line-height: 1.68;" });
  // And her hero figure's own ceiling, stated inline on the <Image>. The whole
  // style is guarded, not just the ceiling, because what it does NOT say is
  // load-bearing: no `display`, so the image computes to `inline`, rides its
  // wrapper's baseline and holds 8.875px of descender under itself. That is
  // `mediaSpaceBelow` on the hero row. State a display here and this guard
  // fails, which is the point — the value would have to come out with it.
  guardOnly({
    file: SSPAGE,
    find: 'style={{ width: "100%", height: "auto", maxWidth: "31rem" }}',
  });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding-top: 116px; padding-bottom: 56px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "@media (max-width: 900px) { padding-top: 104px; min-height: auto;" });
  // The three stack widths, and her stage's second breakpoint. All four are
  // separate numbers in her file and a change to any one moves a whole band.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "@media (max-width: 720px) { grid-template-columns: 1fr;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "@media (max-width: 900px) { min-height: auto; padding: 1.75rem 0.5rem;" });
  // Her CtaRow, and the Copy whose 1.25rem is above the PROSE, not the column.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "export const CtaRow = styled.div` display: flex; flex-wrap: wrap; gap: 14px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "export const Copy = styled.div` max-width: 72ch; margin-top: 1.25rem;" });
  guardOnly({ file: `${SS}/theme.ts`, find: 'textDim: "#c4ccd0"' });
  guardOnly({ file: `${SS}/theme.ts`, find: 'muted: "#9aa4ab"' });
  guardOnly({ file: `${SS}/theme.ts`, find: 'serif: "var(--gfg-font-display), var(--gfg-font-tech), sans-serif"' });
  // StarseedOraclePage.styles.ts — the hero's own type.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 11.5px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "letter-spacing: 0.24em;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: clamp(2.65rem, 4.5vw, 4.4rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "line-height: 1.04;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: clamp(1.55rem, 2.6vw, 2.5rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin: 0.7rem 0 1.8rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "line-height: 1.72;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "grid-template-columns: 1.05fr 0.95fr;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "gap: clamp(2.5rem, 5vw, 3.5rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "max-width: 72ch;" });
  // LandingStarPreview.styles.ts — IntroEyebrow / IntroTitle, which her bands
  // import from the star landing rather than declaring again.
  guardOnly({ file: LSP, find: "font-size: 0.68rem;" });
  guardOnly({ file: LSP, find: "letter-spacing: 0.2em;" });
  guardOnly({ file: LSP, find: "font-size: clamp(1.75rem, 3.2vw, 2.65rem);" });
  guardOnly({ file: LSP, find: "font-weight: 520;" });
  guardOnly({ file: LSP, find: "line-height: 0.98;" });
  // Her Wrap — the column EVERY band on this page sits in. 1120 with
  // clamp(32px, 5vw, 64px) sides is a 992px content column at 1440, where the
  // frame's own default is 1100; the bands were 108px wider than hers before a
  // single type value was compared.
  guardOnly({ file: `${SS}/theme.ts`, find: 'maxw: "1120px"' });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 0 clamp(32px, 5vw, 64px);" });
  // Her page frame — Section, and Band which extends it. The clamp PAGE_PAD is
  // the single-value form of these two, since her step is at 900 and the shared
  // frame's media query is at 768.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 80px 0;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 60px 0;" });
  // The card material, shared by the stage grid and the method cards. Her
  // `hudSurface` is one parameterisation of `hudCardSurface`, and the entry
  // emits the same two-stop over the same drop.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: 'accentRgb: "18, 63, 82"' });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "accentAlpha: 0.5," });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "washAlpha: 0.06," });
  // BraidJourney — BraidGrid / BraidStages / BraidStage / BraidStageNumber.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 2.25rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "grid-template-columns: repeat(2, minmax(0, 1fr));" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "max-width: calc(50% - 0.625rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: clamp(1.35rem, 2.5vw, 1.85rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin: 0 0 0.8rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: clamp(1.3rem, 2.2vw, 1.8rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-weight: 480;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-bottom: 0.65rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 0.78rem;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "letter-spacing: 0.2em;" });
  // Her `P` and `H3` — the stage copy and the method-card headline.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin: 0 0 16px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: clamp(1.08rem, 1.8vw, 1.28rem);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "line-height: 1.25;" });
  guardOnly({ file: `${SS}/theme.ts`, find: 'h3Color: "#eef4f3"' });
  // The method cards — Cards / Card.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "grid-template-columns: repeat(3, 1fr);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "gap: 16px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 22px 22px 24px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 15px;" });
  // The eight currents — CurrentsGrid + CurrentRow/Dot/Name/Essence. The same
  // hudSurface the cards wear, laid on its side: her file's own comment says
  // these hold "the same values as the landing-star hub's shared card surface
  // … so every card on this page reads as one system".
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "grid-template-columns: repeat(2, 1fr);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "gap: 14px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 40px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 18px 20px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "gap: 15px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "align-items: flex-start;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "width: 13px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "box-shadow: 0 0 16px -1px" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 19px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "line-height: 1.15;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 13.5px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 3px;" });
  guardOnly({ file: `${SS}/theme.ts`, find: 'currentNameColor: "#eef4f3"' });
  // How it works — her `Steps` rail holding the SHARED <TrainingStep> rows.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 34px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: `border-left: 1px solid rgba(\${BONE}, 0.1);` });
  guardOnly({ file: CARDS, find: "linear-gradient(90deg, rgba(17, 40, 59, 0.2), transparent 62%)" });
  guardOnly({ file: CARDS, find: `color: rgba(\${BONE}, 0.56);` });
  // The closing block — the SHARED <CalloutBar variant="gateway">.
  guardOnly({ file: SSPAGE, find: '<CalloutBar' });
  guardOnly({ file: SSPAGE, find: 'variant="gateway"' });
  // Her gateway card's width rule is guarded where its VALUE is authored —
  // `sec-ss-begin`'s `sideInset`, through `verbatim` — so the two cannot be
  // edited apart.
  guardOnly({ file: CALLOUT, find: "letter-spacing: 0.18em;" });
  guardOnly({ file: CALLOUT, find: `color: rgba(\${BONE}, 0.59);` });

  /** Her BAND type: IntroEyebrow + IntroTitle + Prose. The eyebrow is
   *  `--preview-meta-font` (Space Mono → the ACCENT role, the family ruling)
   *  and the title `--preview-display-font` (Science Gothic → DISPLAY). */
  /** HER PAGE FRAME. Every Section and Band on this page is `padding: 80px 0`,
   *  60px under 900 — a rhythm no rung of the shared scale carries (`md` is 64,
   *  `lg` 88), which is why every band measured 8px tall on desktop and 8px
   *  short on a phone before this. One value cannot carry a step at a
   *  breakpoint the frame does not share (ours is 768, hers 900), so it is
   *  authored as the clamp that lands on HER number at all three measured
   *  widths: 1440 → 80, 768 → 60, 390 → 60. */
  const PAGE_PAD = "clamp(60px, 7.8vw, 80px)";
  /** A HEAD BAND WHOSE GRID IS A SECOND POOLED ROW closes at nothing. Her one
   *  Section holds the prose AND the grid, so its 80px sits BELOW the grid;
   *  split in two, the head's bottom pad lands in the middle where she has
   *  nothing at all and the close under the grid goes missing — 128px in the
   *  wrong place, on all four of this page's grids. The grid carries the close
   *  as its own bottom margin, which cannot collapse with the next band's
   *  padding, so her 80 + 80 between sections survives. */
  const HEAD_PAD = { padTop: PAGE_PAD, padBottom: "0" };

  /** HER `Band` — the same `Section` with a hairline at each edge over a 3%
   *  teal wash, worn by FOUR of this page's eleven bands (lineage, journey,
   *  method, audience; the other seven are the bare `Section`).
   *
   *  Those four were the only four measuring short, each by exactly 2px, which
   *  is the whole of the page's uniform −8px: a 1px border sits outside the
   *  padding, so her content opens at 81 where ours opened at 80. Nothing in
   *  the family could say "ruled at the edges" until now.
   *
   *  TWO OF THE FOUR ARE ONE `Band` OF HERS AND TWO POOLED ROWS OF OURS — the
   *  journey and the method each hold prose AND a grid inside one ruled
   *  Section. The head states the top rule, the grid states the bottom one,
   *  and the grid's close becomes `padBottom` so the line falls below its own
   *  80px rather than floating above it.
   *
   *  THE WASH RIDES THE HEAD ROW ALONE, for the same reason the rules are
   *  split: her gradient runs the length of the band and ours cannot span two
   *  boxes. Restarting it on the grid would put a 0.03 → 0 step at a boundary
   *  she has nothing at — an artifact of our split, which is the one thing
   *  this migration keeps refusing to reproduce. What is lost instead is the
   *  tail, where her alpha is already under 0.02 (≈1 level of RGB over this
   *  ground). On the two single-row bands the wash is exact. */
  const BAND_RULE = verbatim({
    file: `${SS}/theme.ts`,
    find: 'border: "rgba(255, 255, 255, 0.09)",',
    text: "1px solid rgba(255, 255, 255, 0.09)",
  });
  guardOnly({
    file: `${SS}/StarseedOraclePage.styles.ts`,
    find: "border-top: 1px solid ${({ theme }) => theme.border};",
  });
  guardOnly({
    file: `${SS}/StarseedOraclePage.styles.ts`,
    find: "border-bottom: 1px solid ${({ theme }) => theme.border};",
  });
  const BAND_WASH = verbatim({
    file: `${SS}/StarseedOraclePage.styles.ts`,
    find: "background: linear-gradient(180deg, rgba(72, 210, 185, 0.03), transparent);",
    text: "linear-gradient(180deg, rgba(72, 210, 185, 0.03), transparent)",
  });
  /* The two ELEMENTS the page states that the entries default away from. Both
     guards are the declaration itself: her stage number is a `styled.span` and
     her current's essence a `styled.div`, and each rule's own absence of a
     `font-weight` is why the stage runs 400 against the entry's 700. Nothing
     to transcribe — the element IS the value — so these are guards only, and
     if she ever reaches for a different tag the run says so. */
  guardOnly({
    file: `${SS}/StarseedOraclePage.styles.ts`,
    find: "export const BraidStageNumber = styled.span`",
  });
  guardOnly({
    file: `${SS}/StarseedOraclePage.styles.ts`,
    find: "export const CurrentEssence = styled.div`",
  });

  /** A whole band of hers, ruled top and bottom — the two that are one row. */
  const RULED = { ruleTop: BAND_RULE, ruleBottom: BAND_RULE, bg: BAND_WASH };
  /** …and the two halves of the two that are not. */
  const RULED_HEAD = { ...HEAD_PAD, ruleTop: BAND_RULE, bg: BAND_WASH };
  const RULED_CLOSE = { ruleBottom: BAND_RULE, padBottom: PAGE_PAD, marginBottom: "" };

  const bandType = {
    // Her Wrap's content column, which every band on the page shares.
    maxWidth: 992,
    padTop: PAGE_PAD,
    padBottom: PAGE_PAD,
    eyebrowRole: "accent",
    eyebrowSize: "0.68rem",
    eyebrowWeight: 700,
    eyebrowTracking: "0.2em",
    eyebrowGap: "1rem",
    eyebrowInk: `rgba(${T.TEAL}, 0.66)`,
    headingRole: "display",
    headingSize: "clamp(1.75rem, 3.2vw, 2.65rem)",
    headingWeight: 520,
    headingTracking: "-0.025em",
    headingLh: "0.98",
    headingGap: "0",
    headingInk: `rgb(${T.BONE})`,
    copyRole: "body",
    copyLh: "1.72",
    copyGap: "16px",
    copyMaxWidth: "72ch",
    // HER 1.25rem IS A GAP UNDER THE HEAD, NOT ABOVE THE COLUMN. `Copy` is a
    // wrapper round the PROSE — the eyebrow and the h2 are its siblings, not
    // its children — so the value transcribed onto the column put all 20px
    // above the eyebrow and left the words touching the h2. Measured: every
    // head on this page opened at its section's pad + 20 where hers opens at
    // the pad, and the two head-only bands (the journey intro, "How it works")
    // grew 20px of air she has never had. The hero's own comment had already
    // spotted half of this and drew the wrong conclusion — that the bands are
    // safe "because there the column IS the prose", which is only true of the
    // fine-print row that really has no head.
    copyTop: "",
    proseTop: "1.25rem",
    copyInk: "#c4ccd0",
  };

  // A section that is eyebrow + title + paragraphs and nothing else. Six of the
  // twelve are exactly this.
  const band = (id, label, block, extra = [], over = {}) =>
    section(id, "rf-media-copy", label, {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: block.eyebrow,
      eyebrowColor: "accent",
      heading: block.title,
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [...block.body, ...extra],
      chips: [],
      ctas: [],
      ...bandType,
      ...over,
    });

  // HER PAGE GUTTER — a starseed fact, not a site one. Every band on THIS page
  // is laid out by one `Wrap` (`padding: 0 clamp(32px, 5vw, 64px)`, 22px under
  // 640); her twelve detail pages and the landing hub use `min(100% - 3rem,
  // 86rem)`, which is exactly the literal the entries already carry — so this
  // is the only page of hers that states one, and it states it once. At 768 the
  // difference is 38.4px a side against our 24: every band laid out 29px wider
  // than hers with the text inside rewrapped, which is the whole of the currents
  // band's delta (her sixth row wraps to two lines at 608px of column; ours did
  // not at 637).
  //
  // It rides a tone row carrying NO tone — her page's own wash is the fixed
  // `Sky`, which the site backdrop already paints, so a ground here would cover
  // it. That is what the paint-half-conditional in rf-page-tone is for.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "padding: 0 clamp(32px, 5vw, 64px);" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "@media (max-width: 640px) { padding-inline: 22px; }" });
  guardOnly({ file: `${SS}/theme.ts`, find: 'maxw: "1120px",' });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 1.25rem;" });
  //
  // THE SAME ROW CARRIES HER READING RHYTHM, for the same reason. Her `Page`
  // declares `line-height: 1.68` at the root (guarded above, where the hero's
  // eyebrow reads it) and every run that states none inherits it; ours inherit
  // the platform's 1.60. A ratio sweep of the whole page against hers found six
  // classes of small type a pixel short EACH — the band eyebrows, the braid's
  // stage numbers, the "how it works" step markers, the closing eyebrow, a
  // price and a CTA arrow — which is one fact of hers and six knobs if we
  // answer it per entry. Declared once on the body it is +19px over the page,
  // the braid grid landing on her 2026px exactly, with the fixed nav and the
  // footer unmoved because both state their own.
  sections.push(
    section("sec-ss-gutter", "rf-page-tone", "Page gutter + rhythm", {
      layers: [],
      ground: "",
      gutter: "clamp(32px, 5vw, 64px)",
      gutterNarrow: "22px",
      gutterAt: 640,
      lineHeight: "1.68",
    }),
  );

  sections.push(
    section("sec-ss-hero", "rf-media-copy", "Hero", {
      imageUrl: asset("/images/StarBot.png"),
      imageAlt: verbatim(s.heroImageAlt),
      imagePosition: "right",
      // Her HeroGrid — the wheel is the SECOND child on a desktop (WheelWrap
      // takes order:-1 only under 900px), so the copy holds the 1.05fr.
      mediaSplit: "0.95fr 1.05fr",
      mediaGap: "clamp(2.5rem, 5vw, 3.5rem)",
      // Her HeroGrid stacks at 900 and opens to a FLAT 40px there — the clamp
      // is the desktop value only, and the entry's own 22px had been taking
      // the stated gap back on every phone.
      stackAt: 900,
      mediaGapNarrow: "40px",
      maxWidth: 992,
      // Her Hero is its own frame and not a rung of any scale: 116px above
      // (the fixed SiteNav's clearance, which her own comment names) and 56px
      // below. The `lg` rung's 88/88 was 28px short at the top and 32px long
      // at the bottom, which is most of what the hero band still measured.
      // Her ≤900 step to 104px is not carried: a stated pad holds at every
      // width, her break is 900 and the shared frame's is 768, so honouring it
      // would need a second knob for 12px at one viewport.
      padTop: "116px",
      padBottom: "56px",
      // …and her ≤900 step, now that a frame can carry one. Her break is 900,
      // not the shared frame's 768, so the band reaches it at her width.
      padTopNarrow: "104px",
      narrowAt: 900,
      eyebrow: c.hero.eyebrow,
      eyebrowColor: "accent",
      heading: c.hero.titleBefore,
      headingLevel: 1,
      // Her H1 and the teal italic line under it are two elements on purpose —
      // "separated the hero heading from its teal italic accent line", per her
      // own change log. `headingAccent` is that second line, and `accentAsLine`
      // is what keeps it a SIBLING <p> rather than a phrase inside the h1.
      headingAccent: c.hero.titleEmphasis,
      accentAsLine: true,
      // The hero declares its own type (page-local Eyebrow / H1 / HeroAccent /
      // Prose), not the star landing's Intro type the bands borrow.
      eyebrowRole: "accent",
      eyebrowSize: "11.5px",
      eyebrowWeight: 500,
      eyebrowTracking: "0.24em",
      // Her Eyebrow declares no line-height and inherits her Page's 1.68; ours
      // inherited the platform's 1.6. Stated, because the value is the page's
      // and there is nothing on our side for it to inherit from.
      eyebrowLh: "1.68",
      eyebrowGap: "14px",
      eyebrowInk: "#c79a86",
      headingRole: "display",
      headingSize: "clamp(2.65rem, 4.5vw, 4.4rem)",
      headingWeight: 540,
      headingTracking: "-0.02em",
      headingLh: "1.04",
      headingGap: "0",
      headingInk: "#f5f9f8",
      accentRole: "display",
      accentSize: "clamp(1.55rem, 2.6vw, 2.5rem)",
      accentWeight: 440,
      accentTracking: "-0.012em",
      accentLh: "1.08",
      accentItalic: true,
      accentMargin: "0.7rem 0 1.8rem",
      accentInk: `rgb(${T.TEAL})`,
      copyRole: "body",
      copyLh: "1.72",
      copyGap: "16px",
      copyMaxWidth: "72ch",
      // NO column-level top space. Her `Copy`'s 1.25rem sits above the PROSE,
      // not above the eyebrow, and it collapses into the accent line's own
      // 1.8rem bottom margin at every width — so the 20px this knob was adding
      // above the whole column is 20px her hero has never had. The bands still
      // state it because there the column IS the prose.
      copyTop: "",
      copyInk: "#c4ccd0",
      // Her CtaRow — 14px between, and nothing above it: the last paragraph's
      // own 16px bottom is the gap, and the shared row's 22px is 6px more.
      ctaTop: "0",
      ctaGap: "14px",
      paragraphs: c.hero.lead,
      // NOT chips. It is her `FinePrint` — ONE 11.5px mono line UNDER the
      // button, in the muted grey. The first cut split it on the interpuncts
      // into three chips ABOVE it: a different sentence, in a different place,
      // in a different face. Her separator is part of the sentence.
      chips: [],
      finePrint: verbatim({ file: `${SS}/content.ts`, text: c.hero.finePrint }),
      finePrintRole: "accent",
      finePrintSize: "11.5px",
      finePrintLh: "1.65",
      finePrintTop: "18px",
      finePrintColor: "#9aa4ab",
      // Her figure is a cut-out PNG on the sky: 31rem, centered, no frame.
      // Uncapped it only shows once the grid has stacked — at 768 it ran 709px
      // against her 496 and pushed the hero down 277px.
      mediaMaxWidth: "31rem",
      imageRadius: "0",
      imageBorder: "none",
      // The last of the hero's geometry, and it was never geometry. Her figure
      // is a next/image whose style names width, height and a ceiling and NOT
      // display — so it computes to `inline`, rides its wrapper's baseline and
      // holds the strut's descender under it: 8.875px, identical at 1440, 768
      // and 390 (her page's 1.68 at 16px, in Space Grotesk). Ours is a block
      // img and held nothing. Stacked, the copy column began 8.8px high and the
      // whole band ran 8.8px short at both narrow widths; side by side,
      // `align-items: center` split it and her figure sat 4.5px lower than
      // ours. The guard below is the `display`-less style: if she ever states
      // one, this value comes out with it.
      mediaSpaceBelow: "8.875px",
      // Her PrimaryButton is the ritual plate in her mono, widened.
      ctas: [
        {
          label: c.hero.primary,
          href: "#begin",
          variant: "ritual",
          // Her PrimaryButton names `theme.mono`, which on THIS page resolves
          // to Space Mono — the accent role, not the `mono` role her nav wears.
          // Measured on her live button, not read off the name.
          font: "var(--tgv-fontAccent, inherit)",
          padX: "1.35rem",
          // Her PrimaryButton extends `RitualButtonAnchor`, the bare plate —
          // the four-point star is `RitualButtonStar`, a sibling component her
          // callers mount when they want it, and this one does not. Ours drew
          // two unasked: 220px of button against her 177.
          sparks: "none",
          // HER PLATE RESTS COPPER AND ONLY HOVERS TEAL, and ours had the two
          // exactly swapped on this page. `ritualButtonCss` hardcodes
          // `color: rgb(COPPER)` at rest for every ritual button on her site
          // and moves to `--button-hover-rgb` on hover — which this button,
          // and only this button, sets to TEAL. Our plate rested on the
          // section's accent (teal here) and hovered to its amber, which
          // coincides with hers on the copper-accented offer pages and is
          // backwards here. Two statements in her source, so two here.
          color: `rgb(${T.COPPER})`,
          hoverColor: `rgb(${T.TEAL})`,
        },
      ],
    }),
  );

  // The pull quote is one line of her own words set large and italic. It rides
  // with the section it belongs to as an emphasised final paragraph rather than
  // becoming a testimonial — nobody said it about her.
  sections.push(
    // Her PullQuote is its own <blockquote> closing the band — ruled top and
    // bottom, copper, serif italic, 34rem centered. It was authored as two
    // emphasised paragraphs in the first cut, which is why this band still ran
    // 113px short of hers with every word in place.
    band("sec-ss-lineage", "The Stellar Braid", c.lineage, [], {
      ...RULED,
      quote: c.lineage.quote.join("\n\n"),
      quoteRole: "display",
      quoteSize: "clamp(1.25rem, 2.35vw, 1.75rem)",
      quoteLh: "1.42",
      quoteItalic: true,
      // TWO coppers, and they are not the same one: the words wear her
      // theme's own `copper` literal (#c79a86, guarded above), the rules wear
      // `pullQuoteBorderRgba` — the COPPER token at 0.34 (#b78a77). Collapsing
      // them onto one value would be a quiet recolour of either the type or
      // the hairlines.
      quoteColor: "#c79a86",
      quoteRule: `rgba(${T.COPPER}, 0.34)`,
      quoteMaxWidth: "34rem",
      quoteMargin: "2.5rem auto 0",
      quotePad: "1.5rem 1.75rem",
    }),
  );
  sections.push(band("sec-ss-responsive", "A responsive sky", c.responsive));
  sections.push(band("sec-ss-recognition", "Recognition", c.recognition));

  sections.push(
    section("sec-ss-journey-head", "rf-media-copy", "The journey — intro", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: c.journey.eyebrow,
      eyebrowColor: "accent",
      heading: c.journey.title,
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [],
      chips: [],
      ctas: [],
      ...bandType,
      ...RULED_HEAD,
    }),
  );
  /** Her `hudSurface` — one parameterisation of the shared `hudCardSurface`,
   *  and the same two-stop the entry emits. Both grids on this page wear it. */
  const CARD_WASH = "rgba(18, 63, 82, 0.5)";

  sections.push(
    // Her BraidJourney: BraidGrid → BraidStages → BraidStage, each stage a
    // number, an h3 and its paragraphs on the shared card material. Seven of
    // them, so the last one is the odd child her grid centers on one track.
    section("sec-ss-journey", "rf-hud-cards", "The journey", {
      mode: "door",
      columns: 2,
      heading: "",
      marginTop: "2.25rem",
      // This grid CLOSES her ruled journey Band, so its 80px is padding and
      // the hairline falls under it. See RULED_CLOSE.
      ...RULED_CLOSE,
      maxWidth: 62,
      gap: "1rem",
      cardPad: "clamp(1.35rem, 2.5vw, 1.85rem)",
      // Her BraidStages hold two columns down to 720 — not the door mode's
      // 800. At 768 that one number was the whole band: hers still two-up,
      // ours already stacked, 2246px against 2603.
      stackAt: 720,
      // And her stage swaps its padding at 900, which is NOT where its grid
      // stacks. A stage on a phone gives the words the full column and takes
      // its air vertically instead.
      cardPadNarrow: "1.75rem 0.5rem",
      cardPadAt: 900,
      cardMinHeight: "0",
      lastOddWidth: "calc(50% - 0.625rem)",
      cardWash: CARD_WASH,
      cardWashFeatured: "",
      imageGlow: "",
      // BraidStageNumber: her copper, in the mono face, 0.65rem above the head
      // rather than the gateway card's float.
      markerColor: "#c79a86",
      markerSize: "0.78rem",
      markerTracking: "0.2em",
      markerGap: "0.65rem",
      // …and it is a SPAN that declares no weight, so it runs 400. The entry's
      // 700 comes from her own `OfferingIndex` and `CardIndex`, which are both
      // `<p>` — right for those two families and wrong for this one. Seven
      // markers rendered bold against her regular; the pixel bands could not
      // say so (this one is dominated by the structural sibling), the text
      // census could. Both guards are absence-shaped: the declaration IS the
      // span, and the weight is what her rule does not contain.
      markerTag: "span",
      markerWeight: 400,
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      // Her h3 declares family, size, weight and colour and nothing else, so
      // the tracking is `normal` and the line-height is the page's own 1.68 —
      // both stated, because the entry's cardHeadline defaults are neither.
      titleSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
      titleWeight: 480,
      titleTracking: "normal",
      titleLh: "1.68",
      titleGap: "0.8rem",
      titleColor: `rgb(${T.TEAL})`,
      copySize: "",
      copyLh: "1.72",
      copyColor: "#c4ccd0",
      copyGap: "16px",
      items: c.journey.items.map((item, i) => ({
        marker: `0${i + 1}`,
        title: item.title,
        copy: item.body.join("\n\n"),
      })),
    }),
  );

  sections.push(band("sec-ss-stars-head", "The eight currents — intro", c.stars, [], HEAD_PAD));
  sections.push(
    // Her CurrentsGrid — eight hudSurface rows, two across. It was authored as
    // a flat `rf-list` in the first cut, which is the same finding the four
    // grids above carried: a list is not the material she wrote, and no amount
    // of type levers on a list turns it into a card. The dot's colour is the
    // band's whole point (the same WCAG-checked accent the starseed package
    // paints that family in), so it rides the ITEM.
    section("sec-ss-currents", "rf-hud-cards", "The eight currents", {
      mode: "row",
      columns: 2,
      // Her CurrentsGrid's own 900, stated rather than inherited from the row
      // mode's default — the default is where it came FROM, not a guarantee.
      stackAt: 900,
      heading: "",
      marginTop: "40px",
      marginBottom: PAGE_PAD,
      maxWidth: 62,
      gap: "14px",
      // The row's own padding IS hers — the mode is derived from CurrentRow —
      // so a stated value here would only be a second place to keep it.
      cardPad: "",
      cardMinHeight: "",
      lastOddWidth: "",
      cardWash: CARD_WASH,
      cardWashFeatured: "",
      imageGlow: "",
      markerColor: "",
      markerSize: "",
      markerTracking: "",
      markerGap: "",
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      // Her CurrentEssence is a bare div too — the entry renders a paragraph,
      // which is the better element and stays the default everywhere else.
      // Eight rows of the page's text census, no pixels either way.
      copyTag: "div",
      // Her CurrentName is a bare div in the display face — no weight and no
      // tracking of its own, so both are the page's, and both are stated
      // because the shared cardHeadline's are neither.
      titleSize: "19px",
      titleWeight: 400,
      titleTracking: "normal",
      titleLh: "1.15",
      titleGap: "0",
      titleColor: "#eef4f3",
      copySize: "13.5px",
      copyLh: "1.68",
      copyColor: "#9aa4ab",
      copyGap: "",
      items: c.stars.currents.map((cur) => ({
        title: cur.family,
        copy: cur.essence,
        dotColor: cur.color,
      })),
    }),
  );

  sections.push(band("sec-ss-method", "The method", c.method, [], RULED_HEAD));
  sections.push(
    // Her Cards / Card — the same material, three across, no marker. The three
    // inline SVG glyphs are drawn in the page file and stay behind, as noted
    // at the top of this builder.
    section("sec-ss-method-cards", "rf-hud-cards", "The method — cards", {
      mode: "door",
      columns: 3,
      heading: "",
      marginTop: "34px",
      // …and this one closes her ruled method Band, the same way.
      ...RULED_CLOSE,
      maxWidth: 62,
      gap: "16px",
      cardPad: "22px 22px 24px",
      // Her Cards stack at 900, not the door mode's 800. Invisible at the
      // three widths the rig shoots and wrong for every width between them.
      stackAt: 900,
      cardMinHeight: "0",
      lastOddWidth: "",
      cardWash: CARD_WASH,
      cardWashFeatured: "",
      imageGlow: "",
      markerColor: "",
      markerSize: "",
      markerTracking: "",
      markerGap: "",
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      // Her `H3`, not the shared cardHeadline — this one card types its own.
      titleSize: "clamp(1.08rem, 1.8vw, 1.28rem)",
      titleWeight: 520,
      titleTracking: "-0.01em",
      titleLh: "1.25",
      titleGap: "9px",
      titleColor: "#eef4f3",
      copySize: "15px",
      // Her Card rule restates the p's size and colour and NOT its
      // line-height, so the copy keeps `P`'s own 1.72 — not the 1.68 the
      // stages run.
      copyLh: "1.72",
      copyColor: "#9aa4ab",
      copyGap: "0",
      // Her three card glyphs — `Card svg { 30px, teal, 16px under }`, drawn
      // inline in her page file and left behind by the first cut, which is 46px
      // of the band's remaining delta. Masked, so the teal stays a knob.
      iconSize: "30px",
      iconGap: "16px",
      iconColor: `rgb(${data.tokens.TEAL})`,
      items: c.cards.map((card, i) => ({
        title: card.title,
        copy: card.body,
        // `cardIcons[index]` — her pairing is positional, so ours is too.
        iconUrl: methodGlyphs[i] || "",
      })),
    }),
  );

  sections.push(
    section("sec-ss-how-head", "rf-media-copy", "How it works — intro", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: c.how.eyebrow,
      eyebrowColor: "accent",
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [],
      chips: [],
      ctas: [],
      ...bandType,
      ...HEAD_PAD,

    }),
  );
  sections.push(
    // Her `Steps` rail holding the SHARED <TrainingStep> rows — a left rule
    // with each row's own right/bottom border forming the cells. It is not a
    // card grid, which is what the first cut authored: rf-process-steps' rail
    // mode was derived from this exact pair.
    section("sec-ss-how", "rf-process-steps", "How it works", {
      eyebrow: "",
      title: "",
      mode: "rail",
      steps: c.how.steps.map((step, i) => ({
        marker: `0${i + 1}`,
        title: step.title,
        copy: step.body,
      })),
      flowSteps: [],
      note: "",
      // The rail's `01`–`04` are her `--page-accent`, which is teal here.
      accent: PAGE_ACCENT,
      // TrainingStepRoot's own wash — a literal in her file, not accent-derived.
      cardWash: "rgba(17, 40, 59, 0.2)",
      maxWidth: 62,
      spacedTop: false,
      // The rail follows an eyebrow band of its own, so neither of the entry's
      // two derived gaps applies.
      stepsTop: "34px",
      // Her how-it-works Section closes BELOW the rail; the eyebrow band above
      // it closes at 0, so this carries the whole 80.
      marginBottom: PAGE_PAD,
      // TrainingStepBody's copy — rgba over her ground, not a flattened hex,
      // because a section's muted role takes a complete CSS colour.
      muted: `rgba(${T.BONE}, 0.56)`,
    }),
  );

  sections.push(band("sec-ss-audience", "Who it is for", c.audience, [], RULED));

  // The closing callout, which the hero's button jumps to — so the anchor is
  // load-bearing, not decoration.
  sections.push(
    // The SHARED <CalloutBar variant="gateway"> — the entry rf-callout-bar was
    // derived from, seat for seat. Her lead joins with a SPACE here (one
    // sentence, not a stack of paragraphs), which is what her page passes.
    section("sec-ss-begin", "rf-callout-bar", "Begin", {
      anchorId: "begin",
      eyebrow: c.begin.eyebrow,
      eyebrowTracking: 0.18,
      title: c.begin.title,
      // The gateway variant is the one that lets the title run full width.
      titleMax: "",
      titleTracking: -0.035,
      titleLineHeight: 0.98,
      copy: c.begin.lead.join(" "),
      price: c.begin.price,
      // The gateway variant's eyebrow AND its price are `var(--page-accent)`.
      // The glow below is stated outright, so this moves the two type runs and
      // nothing else.
      accent: PAGE_ACCENT,
      // `--page-glow`, declared on her Page.
      glow: `rgba(${T.TEAL}, 0.14)`,
      // HER CARD IS 24px IN FROM EACH EDGE, not one page gutter. Her CalloutBar
      // writes `width: min(100% - 3rem, 70rem)` as a literal, in a component
      // shared across her pages — so the inset is the same whatever the page's
      // reading gutter says. Once rf-page-tone could state a gutter this band
      // started following it, and starseed's `clamp(32px, 5vw, 64px)` made the
      // card 705 → 676px at 768. Stated outright, which is what `sideInset`
      // is for.
      sideInset: verbatim({
        file: CALLOUT,
        find: "width: min(100% - 3rem, 70rem);",
        text: "1.5rem",
      }),
      ctas: [
        {
          label: c.begin.cta,
          href: verbatim(s.beginUrl),
          variant: "plate",
          target: "_blank",
          arrow: true,
          // Her gateway plate borders copper even on a teal-accented page.
          color: `rgba(${T.COPPER}, 0.38)`,
        },
      ],
      maxWidth: 70,
      spacedTop: true,
      padBottom: "",
      muted: `rgba(${T.BONE}, 0.59)`,
    }),
  );
  // HER `Or` AND HER `Footnote` — two lines inside the #begin div under the
  // callout, and they were one band in the wrong order. Her link line comes
  // FIRST and is a SENTENCE (`<Or><a …>{direct}</a></Or>` — 13.5px, centred,
  // muted, the whole run a mailto in her teal with the underline off). Ours
  // rendered it as a `RfCtaDef`, which is a plate: 51px of button where she has
  // 23px of prose, and under the disclaimer rather than above it. `parseInline`
  // now has a link grammar, so each line is the paragraph it is, in her order,
  // with its own size and colour — which is why this is two rows and not one:
  // a single `paragraphs` array cannot carry two type treatments.
  const beginMail = `mailto:${verbatim(s.contactEmail)}?subject=${encodeURIComponent(
    verbatim(s.contactTopic),
  )}`;
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "font-size: 13.5px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "text-decoration: none;" });
  sections.push(
    section("sec-ss-direct", "rf-media-copy", "Direct line", {
      // HER GUTTER, AND NO VERTICAL FRAME AT ALL. These two lines live in her
      // `Wrap` — `padding: 0 var(--gutter)` — inside a `div` that states no
      // padding of its own, so they are inset by the page's reading gutter and
      // by nothing else. `framePad: "none"` says the band asks the frame for
      // NOTHING, gutter included (a full-bleed band has to stay full-bleed
      // however the page is laid out), so these ran edge to edge: the
      // disclaimer's own 720px cap became the wrap width instead of the page's
      // 676px, and it set in three lines where hers sets in four. 21px short at
      // 768 and at 390 alike.
      //
      // A rung with both vertical pads zeroed IS her Wrap: `padCss` emits
      // `0 var(--rf-gutter, h) 0 var(--rf-gutter, h)`, and the rung's own `h`
      // is only the fallback for a page that states no gutter. `md`'s 32px is
      // her clamp's own floor, so even that fallback is hers.
      framePad: "md",
      padTop: "0",
      padBottom: "0",
      marginTop: "20px",
      centered: true,
      maxWidth: 992,
      copySize: "13.5px",
      // theme.muted, not theme.faint — the two closing lines are different
      // greys and collapsing them would be a quiet recolour of one of them.
      copyInk: verbatim({ file: `${SS}/theme.ts`, find: 'muted: "#9aa4ab",', text: "#9aa4ab" }),
      // Neither line declares a line-height, so both read at her page's 1.68;
      // the entry's own default is 1.65, which is what made the disclaimer run
      // long even before the column was too narrow.
      copyLh: "1.68",
      copyGap: "0",
      copyMaxWidth: "none",
      linkColor: `rgb(${T.TEAL})`,
      linkDecoration: "none",
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: "",
      eyebrowColor: "accent",
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [`[${c.begin.direct}](${beginMail})`],
      chips: [],
      ctas: [],
    }),
  );
  sections.push(
    // Her Footnote, with the inline style its caller gives it: a 720px box
    // CENTRED in the 992 column (`margin: 2rem auto 0`), not a 62ch box parked
    // at the column's left — which is what ours was, five lines against her
    // three.
    section("sec-ss-disclaimer", "rf-media-copy", "Disclaimer", {
      // Her Wrap's gutter, and no vertical frame — see sec-ss-direct above.
      framePad: "md",
      padTop: "0",
      padBottom: "0",
      marginTop: "2rem",
      centered: true,
      maxWidth: 992,
      copySize: "12.5px",
      copyInk: verbatim({ file: `${SS}/theme.ts`, find: 'faint: "#6b7980",', text: "#6b7980" }),
      copyLh: "1.68",
      copyGap: "0",
      copyMaxWidth: "720px",
      proseCenter: true,
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: "",
      eyebrowColor: "accent",
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [c.begin.disclaimer],
      chips: [],
      ctas: [],
    }),
  );

  return {
    slug: "starseed",
    title: c.meta.title,
    inNav: false,
    model: {
      id: "pm-rw-starseed",
      slug: "starseed",
      title: c.meta.title,
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: c.meta.description,
          keywords: [],
          ogImage: asset("/images/StarBot.png"),
        },
      },
      sections,
    },
  };
}

function buildWriting(data) {
  const w = inlineCopy.writing;
  const WRITING_STYLES = `${HOME_DIR}/writing/WritingPage.styles.ts`;
  const WRITING_PAGE = `${HOME_DIR}/writing/WritingPage.tsx`;
  const { COPPER, TEAL, BONE, PHTHALO } = data.tokens;

  // Her PageShell's four-layer wash — the copper crown, two phthalo blooms and
  // the deep-blue radial ground. The whole page is set in her SERIF; the head
  // and the cards are the rf-serif-head / rf-cover-cards entries this page was
  // derived into, seat for seat.
  guardOnly({ file: WRITING_STYLES, find: "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(${COPPER}, 0.08) 0%, transparent 65%)" });
  guardOnly({ file: WRITING_STYLES, find: "radial-gradient(ellipse 62% 50% at 100% 100%, rgba(${PHTHALO}, 0.18) 0%, transparent 62%)" });
  guardOnly({ file: WRITING_STYLES, find: "radial-gradient(ellipse 46% 38% at 10% 18%, rgba(${PHTHALO}, 0.1) 0%, transparent 58%)" });
  guardOnly({ file: WRITING_STYLES, find: "radial-gradient(circle at 50% 0%, hsl(235, 72%, 16%), hsl(228, 58%, 9%) 56%, hsl(220, 28%, 4%) 100%)" });
  guardOnly({ file: WRITING_STYLES, find: "text-shadow: 0 0 22px rgba(${PHTHALO}, 0.16)" });
  guardOnly({ file: WRITING_STYLES, find: "text-shadow: 0 0 28px rgba(${PHTHALO}, 0.12)" });
  guardOnly({ file: WRITING_STYLES, find: "color: rgba(166, 203, 255, 0.16)" });
  guardOnly({ file: WRITING_STYLES, find: "inset 0 1px 0 rgba(${COPPER}, 0.1)" });
  guardOnly({ file: WRITING_STYLES, find: "0 18px 48px rgba(0, 0, 0, 0.16)" });
  guardOnly({ file: WRITING_STYLES, find: "outline: 2px solid rgba(${TEAL}, 0.72)" });
  guardOnly({ file: WRITING_STYLES, find: "color: rgba(248, 244, 238, 0.96)" });
  guardOnly({ file: WRITING_STYLES, find: "grid-template-columns: repeat(auto-fit, minmax(260px, 320px))" });
  guardOnly({ file: WRITING_PAGE, find: '<TitleAmpersand aria-hidden="true">&</TitleAmpersand>' });
  guardOnly({ file: WRITING_PAGE, find: 'aria-label="Resonant Weaver"' });

  const scrim = [
    "linear-gradient(180deg, rgba(5, 8, 18, 0.2) 0%, rgba(5, 8, 18, 0.48) 44%, rgba(4, 6, 14, 0.82) 100%)",
    "linear-gradient(90deg, rgba(4, 7, 18, 0.44) 0%, rgba(4, 7, 18, 0.08) 52%, rgba(4, 7, 18, 0.22) 100%)",
  ];
  scrim.forEach((layer) => guardOnly({ file: WRITING_STYLES, find: layer }));
  const coverFallback = [
    "radial-gradient(circle at 18% 16%, rgba(${TEAL}, 0.2) 0%, transparent 14%)",
    "radial-gradient(circle at 72% 28%, rgba(${COPPER}, 0.16) 0%, transparent 18%)",
    "radial-gradient(circle at 64% 78%, rgba(166, 203, 255, 0.12) 0%, transparent 22%)",
    "linear-gradient(145deg, rgba(12, 23, 80, 0.95) 0%, rgba(8, 14, 34, 0.92) 42%, rgba(4, 8, 16, 0.96) 100%)",
  ];
  coverFallback.forEach((layer) => guardOnly({ file: WRITING_STYLES, find: layer }));
  const fill = (s) =>
    s
      .replaceAll("${COPPER}", COPPER)
      .replaceAll("${TEAL}", TEAL)
      .replaceAll("${PHTHALO}", PHTHALO);

  const sections = [
    // No flat ground: her fourth layer IS the ground, a radial that bottoms
    // out at hsl(220, 28%, 4%).
    section("sec-writing-tone", "rf-page-tone", "Page tone", {
      layers: [
        fill("radial-gradient(ellipse 80% 55% at 50% -10%, rgba(${COPPER}, 0.08) 0%, transparent 65%)"),
        fill("radial-gradient(ellipse 62% 50% at 100% 100%, rgba(${PHTHALO}, 0.18) 0%, transparent 62%)"),
        fill("radial-gradient(ellipse 46% 38% at 10% 18%, rgba(${PHTHALO}, 0.1) 0%, transparent 58%)"),
        "radial-gradient(circle at 50% 0%, hsl(235, 72%, 16%), hsl(228, 58%, 9%) 56%, hsl(220, 28%, 4%) 100%)",
      ],
      ground: "",
      // `PageShell` is inside her `<main>` like every other page ground of
      // hers, and this is the page where it showed worst: the blue wash ran
      // under the footer and the band drifted from Δ5 at the left hand to Δ29
      // at the right, against a footer of hers that is one flat colour.
      ...SITE_GROUND,
      // `PageShell` declares no rhythm, so the page reads at `normal`.
      lineHeight: PAGE_RHYTHM_NONE,
      // AND IT IS THE ONE ROOT ON THE SITE THAT ASKS FOR NO SMOOTHING EITHER.
      // Ten of her page roots declare `-webkit-font-smoothing: antialiased`
      // (see SMOOTHED_ROOTS, which reads all ten); `PageShell` declares
      // neither that nor a line-height, so /writing/ is the single route of
      // hers that renders at the browser default on both counts. Stating the
      // site-wide rule without this escape moved 51 captures towards her and
      // pushed writing 3.85 points away at 390. Guarded below.
      smoothing: PAGE_SMOOTHING_NONE,
    }),
    section("sec-writing-head", "rf-serif-head", "Writing", {
      eyebrow: verbatim(w.eyebrow),
      eyebrowTracking: 0.22,
      eyebrowAlpha: 45,
      title: verbatim(w.titleLine1),
      titleEm: verbatim(w.titleLine2),
      titleAlpha: 96,
      titleShadow: fill("0 0 22px rgba(${PHTHALO}, 0.16)"),
      titleSize: "clamp(3rem, 7vw, 5.15rem)",
      headingLevel: 1,
      ghost: "&",
      ghostColor: "rgba(166, 203, 255, 0.16)",
      ghostShadow: fill("0 0 28px rgba(${PHTHALO}, 0.12)"),
      ghostSize: "clamp(4.8rem, 12vw, 7.5rem)",
      intro: verbatim(w.intro),
      introAlpha: 68,
      introMaxWidth: 42,
      rule: true,
      ruleAlpha: 22,
      maxWidth: 76,
      headMaxWidth: 48,
      padTop: "4.5rem",
      gapBelow: "4rem",
      accent: `rgb(${COPPER})`,
      ink: `rgb(${BONE})`,
    }),
    // Her cards, on the entry derived from them. The second card's cover is
    // deliberately empty: her `/images/LeafOscilator-Logo4.png` does not exist
    // in her repo (broken on the live site today, see copy.mjs), so the pooled
    // card wears the CoverFallback ground instead of carrying a 404 across.
    section("sec-writing-entries", "rf-cover-cards", "Entries", {
      items: data.writingEntries.map((e) => ({
        anchorId: e.slug,
        title: e.title,
        excerpt: e.excerpt,
        eyebrow: e.eyebrow,
        metaA: e.publishedAt ?? "",
        metaB: e.readingTime ?? "",
        href: e.href ?? "",
        imageUrl: asset(e.imageSrc, { optional: true }),
        imageAlt: e.imageAlt ?? "",
      })),
      byline: "Resonant Weaver",
      bookmark: true,
      colMin: 260,
      colMax: 320,
      gap: 25,
      aspect: "4 / 5",
      radius: 14,
      insetAlpha: 10,
      dropShadow: "0 18px 48px rgba(0, 0, 0, 0.16)",
      coverFallback: coverFallback.map(fill).join(", "),
      scrim: scrim.join(", "),
      focusAlpha: 72,
      titleColor: "rgba(248, 244, 238, 0.96)",
      maxWidth: 76,
      padBottom: "5rem",
      accent: `rgb(${COPPER})`,
      amber: `rgb(${TEAL})`,
      ink: `rgb(${BONE})`,
    }),
  ];

  const meta = data.en.writing.meta;
  return {
    slug: "writing",
    title: "Writing",
    inNav: true,
    model: {
      id: "pm-rw-writing",
      slug: "writing",
      title: "Writing",
      chrome: {
        navEnabled: true,
        footerEnabled: true,
        meta: {
          description: meta.description,
          keywords: meta.keywords,
          ogImage: asset(data.en.writing.twitter.images[0].url),
        },
      },
      sections,
    },
  };
}

/* -------------------------------------------------------------------- form --- */

/** A stable id so the page row can name the form the same file creates, and a
 *  re-run points at the same row instead of orphaning the last one. Derived
 *  from the site + slug, not random. */
function stableUuid(seed) {
  const h = createHash("sha256").update(seed).digest("hex");
  const v = h.slice(0, 32).split("");
  v[12] = "4"; // version nibble — a valid v4 shape, deterministically produced
  v[16] = ((parseInt(v[16], 16) & 0x3) | 0x8).toString(16);
  const s = v.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

function buildForm(data) {
  const f = data.en.contact.contentAboveFold.form;
  const d = f.fields.dropdown;
  const options = ["option1", "option2", "option3", "option4", "option5"]
    .map((k) => d[k])
    .filter(Boolean)
    .map((label) => ({ ref: toSlug(label), label }));
  return {
    id: stableUuid(`${SITE}:contact`),
    slug: "contact",
    title: f.title,
    definition: {
      title: f.title,
      version: 1,
      fields: [
        { ref: "name", type: "short_text", title: f.fields.name, required: true },
        { ref: "email", type: "email", title: f.fields.email, required: true },
        {
          ref: "topic",
          type: "dropdown",
          title: f.fields.topic,
          required: true,
          properties: { options, allowOther: true, otherPrompt: d.variableOption },
        },
        { ref: "message", type: "long_text", title: f.fields.message, required: true },
      ],
      settings: { submitLabel: f.button },
      thankyou: { title: f.statusMessage.success, description: "" },
    },
  };
}

/** THE PEARL CHAMBER'S OWN FORM, and the reason the page needed one.
 *
 *  Her page collects a name, an email and an intention, posts them to
 *  `/api/contact/` under the topic "Pearl Chamber", and only THEN reveals the
 *  two PayPal links. The order is the whole design: the intention has to be in
 *  hand before the money is, because the intention is what goes in the box.
 *
 *  So it is a form whose thank-you screen hands the person on — which is what
 *  `thankyou.ctas` was added to the forms module for. Putting the two payment
 *  buttons on the page beside the form instead would have made them reachable
 *  without answering, and she would be taking $11 a week to hold nothing. */
function buildPearlForm() {
  const c = inlineCopy.pearl;
  const title = verbatim(c.title);
  return {
    id: stableUuid(`${SITE}:pearl-chamber`),
    slug: "pearl-chamber",
    title,
    definition: {
      title,
      version: 1,
      fields: [
        { ref: "name", type: "short_text", title: verbatim(c.fieldName), required: true },
        { ref: "email", type: "email", title: verbatim(c.fieldEmail), required: true },
        { ref: "intention", type: "long_text", title: verbatim(c.fieldIntention), required: true },
      ],
      settings: { submitLabel: verbatim(c.submitLabel) },
      thankyou: {
        title: verbatim(c.thanksTitle),
        description: `${verbatim(c.thanksLine1)} ${verbatim(c.thanksLine2)} ${verbatim(c.thanksLine3)}`,
        ctas: [
          { label: verbatim(c.onceLabel), href: verbatim(c.onceUrl), target: "_blank" },
          { label: verbatim(c.subscribeLabel), href: verbatim(c.subscribeUrl), target: "_blank" },
        ],
      },
    },
  };
}

/* --------------------------------------------------------------------- sql --- */

const TAG = "$rwjson$";
function json(value) {
  const s = JSON.stringify(value, null, 2);
  if (s.includes("$rwjson$")) die("generated JSON collides with the dollar-quote tag");
  return `${TAG}${s}${TAG}::jsonb`;
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

const BANNER = (name, why) => `-- ${name} — GENERATED by sql/resonantweaver-migration/generate.mjs.
-- DO NOT HAND-EDIT: the next run overwrites it. Change her source, or copy.mjs,
-- and re-run. \`--check\` fails if this file is stale, so a drifting edit is
-- caught rather than merged.
--
${why}
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/${name}

\\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-${name.replace(/\.sql$/, "")}', true);
`;

function themeSql(data) {
  const t = data.tokens;
  const copper = parseTriplet(t.COPPER);
  const teal = parseTriplet(t.TEAL);
  const bone = parseTriplet(t.BONE);

  guardOnly(ground);
  const bg = hexToRgb(ground.hex);

  guardOnly(panel);
  const [pr, pg, pb, pa] = panel.rgba;
  const surface = over([pr, pg, pb], bg, pa);

  // `--text-muted: rgba(BONE, 0.65)` over the ground. Phase 1 deferred this
  // because the theme's colour roles are hex-only; the flattened value is what
  // a browser paints for those pixels anyway.
  const textMuted = over(bone, bg, 0.65);

  for (const r of Object.values(radii)) guardOnly(r);
  for (const o of orbs) for (const g of o.guards) guardOnly(g);
  for (const g of themeFonts.guards) guardOnly(g);

  const theme = {
    colors: {
      background: toHex(bg),
      surface: toHex(surface),
      text: toHex(bone),
      textMuted: toHex(textMuted),
      // HER PRIMARY IS COPPER, AND accent1 IS THE ROLE THAT MEANS PRIMARY.
      // Read the other way round for a day and a half: accent1 was named for
      // her `--accent` (the teal her links and kickers run on) because the
      // names line up, and accent3 — the gold family — was given copper
      // because `amber` is what the rf-* entries call their second colour.
      // But a pooled entry's OWN primary resolves through `--tgv-cyan`, so
      // that mapping paints every title on the site teal, and her `--primary`
      // is copper on every one of them (`OnePage.styles#Body` declares the
      // palette once, with no attribute keying — unlike the type, the three
      // landings share it exactly). The hero row had already been hand-swapped
      // to `accent: var(--tgv-gold)` / `amber: var(--tgv-cyan)` on 2026-08-08
      // to undo it, which is the measurement that proves the direction: a
      // workaround that has to invert both roles is a role map read backwards.
      // Swapped here, so the hero needs no swap and the nineteen rows behind
      // it that have no colour prop at all come along.
      accent1: toHex(copper), // her `--primary` — every title, wordmark, rule
      accent2: toHex(copper), // the magenta family; she has no third colour
      accent3: toHex(teal), // the gold family, i.e. every entry's `amber` role
    },
    // Every role themeFonts declares, `guards` excepted — so adding a role
    // there is the whole edit, and the SQL assertion below reads the same list.
    fonts: Object.fromEntries(
      Object.entries(themeFonts).filter(([k]) => k !== "guards" && k !== "unbacked"),
    ),
    radius: { card: radii.card.value, button: radii.button.value, small: radii.small.value },
  };

  // Her `html` reserves the classic scrollbar's width on every page. It is one
  // line of her GlobalStyles and it is worth 15px of content width at every
  // viewport — which on a phone is where a paragraph decides whether to wrap.
  // Measured 2026-08-09: /writing/ at 390, her body box 375 and the pooled one
  // 390, so her intro ran four lines and ours three (−30px of page).
  guardOnly({ file: "src/styles/GlobalStyles.ts", find: "scrollbar-gutter: stable;" });

  /** AND EVERY PAGE ROOT SHE HAS ASKS FOR THIN GLYPHS.
   *
   *  `-webkit-font-smoothing: antialiased` appears TEN times in her source and
   *  every one of them is a page root: `OnePage#Body`, the five star-preview
   *  roots (`ProductsBody`, `ProductBody`, `CourseBody`, `OfferBody`,
   *  `GatewayBody`), starseed, open-your-journey, sun-walk's `Page` and the
   *  field guide's own GlobalStyles. Ten declarations of one thing is not a
   *  per-page choice, it is the site — which is why it is a `siteBackground`
   *  field beside the gutter and not a prop on fourteen tone rows, and why
   *  neither would have reached the six surfaces that are CODE.
   *
   *  IT CHANGES NO BOX, WHICH IS WHY IT SURVIVED EVERY PASS SO FAR. Measured
   *  on `/pearl-chamber/` at 390 on 2026-08-10: her paragraph and ours agreed
   *  to two decimals on x, y, width, height, family, size, line-height,
   *  weight, tracking and colour — and the band still diffed 13.34%, with the
   *  diff image showing every glyph lit and nothing around them. `auto` is
   *  subpixel-antialiased and heavier; hers is greyscale and thinner, and on
   *  Cormorant Garamond at weight 300 that is the whole texture of her page.
   *
   *  The list is READ, not transcribed, so a root she stops smoothing fails
   *  the generator rather than leaving the site claiming a rule she dropped. */
  const SMOOTHED_ROOTS = [
    "src/app/[lang]/(public)/(home)/OnePage.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/experience/all-products/AllProducts.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/experience/[product]/ProductPreview.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/course/Course.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/offer/[slug]/OfferDetail.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/[gateway]/GatewayPage.styles.ts",
    "src/app/[lang]/(public)/(home)/starseed/StarseedOraclePage.styles.ts",
    "src/app/[lang]/(public)/(home)/open-your-journey/OpenJourney.styles.ts",
    "src/app/[lang]/sun-walk/SunWalk.tsx",
    "src/components/galacticfieldguide/GlobalStyles.tsx",
  ];
  for (const file of SMOOTHED_ROOTS) {
    guardOnly({ file, find: "-webkit-font-smoothing: antialiased;" });
  }

  /** AND HER SHELL NEVER LETS A PAGE BE SHORTER THAN THE SCREEN.
   *
   *  `SiteShell` — the wrapper in `layout.client.tsx` that every page of hers
   *  renders inside — opens with `min-height: 100vh`, and nine of her page
   *  roots restate it on their own. So it is the site, by the same count and
   *  the same argument as the smoothing above, and it goes in the same row.
   *
   *  IT BITES ONLY WHERE A PAGE IS SHORT, which is why nothing found it until
   *  now. Swept across her 25 routes at 390/768/1440 on 2026-08-11: exactly ONE
   *  capture moves, `/writing/` at 768, where her content region is padded out
   *  to the viewport's 900 and the pooled one stopped at its natural 843 —
   *  her footer 57px below ours, and the whole of that page's worst segment.
   *  The other 74 captures are byte-identical with the rule on.
   *
   *  `/open-your-journey/` is read separately because she wrote `100dvh` there
   *  — the dynamic viewport unit, which on a phone excludes the browser's own
   *  chrome. It is the same intent and it is NOT the same string, so reading it
   *  with the others would let her change one into the other unnoticed.
   *
   *  Her field guide and her starseed page declare neither: the field guide
   *  sails out of flow entirely (`position: fixed; inset: 0`, which is why the
   *  pooled surface carries `data-fixed-surface`), and starseed is far taller
   *  than any screen. Absence is read here as deliberately as presence. */
  const VIEWPORT_FILLING_ROOTS = [
    "src/app/[lang]/layout.client.tsx",
    "src/app/[lang]/(public)/(home)/OnePage.styles.ts",
    "src/app/[lang]/(public)/(home)/writing/WritingPage.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/experience/all-products/AllProducts.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/experience/[product]/ProductPreview.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/course/Course.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/offer/[slug]/OfferDetail.styles.ts",
    "src/app/[lang]/(public)/(home)/landing-star-preview/[gateway]/GatewayPage.styles.ts",
    "src/app/[lang]/sun-walk/SunWalk.tsx",
  ];
  for (const file of VIEWPORT_FILLING_ROOTS) {
    guardOnly({ file, find: "min-height: 100vh;" });
  }
  guardOnly({
    file: "src/app/[lang]/(public)/(home)/open-your-journey/OpenJourney.styles.ts",
    find: "min-height: 100dvh;",
  });

  const background = {
    orbs: orbs.map(({ guards, ...o }) => o),
    color: toHex(bg),
    scrollbarGutter: true,
    fontSmoothing: true,
    fillsViewport: true,
  };

  // The downloaded faces, then the metric-matched aliases every stack above
  // now names. Two lists because the asset check below asserts a FILE for each
  // face it is given, and an alias has none to assert — it points at Arial.
  const fonts = { faces: [...webfonts, ...webfontAliases] };

  const rows = [
    ["theme", theme],
    ["siteBackground", background],
    ["siteFonts", fonts],
  ];

  return (
    BANNER(
      "01-theme.sql",
      `-- Her identity as three site-scoped rows: the palette and type (\`theme\`),
-- the sky behind every page (\`siteBackground\`), and the faces that make the
-- type real (\`siteFonts\`).
--
-- WHOSE LOOK THIS IS. The star landing's, not OnePage's — Gio's ruling of
-- 2026-08-06, after the parity pass showed a site that had changed colour and
-- typeface. Phase 1 read the ground and the type off \`OnePage.styles.ts\` and
-- \`tokens.ts\`; both are genuinely hers, but they belong to the one-pager she
-- retired, and the pooled home IS the star landing. That page declares
-- \`#06111c\` and Science Gothic over Space Grotesk; \`SERIF\` (Cormorant) appears
-- there only under \`&[data-font-preview="original"]\`, the alternative she was
-- previewing through her own FontPreviewSwitch. Her live home and /starseed/
-- wear the gothic; only /journey/ wears the serif, and one theme row cannot
-- name both.
--
-- WHY THE FONT ROW EXISTS AT ALL. A theme has always been able to NAME a family;
-- nothing loaded one. On her own app the faces arrive through \`next/font\` and a
-- stylesheet \`@import\`, neither of which travels with her pages — so without
-- this row her site would come up in a system sans with every colour, size and
-- word correct.
--
-- SIX ROLES SINCE 2026-08-07, and Cormorant is no longer among the unnamed.
-- The theme could hold \`heading\` and \`body\`; her DOM carries five families,
-- so the pooled render collapsed four of them into one and 145 elements on the
-- home page alone wore the wrong face — invisible to a colour check, invisible
-- to a word check, and the largest single delta the parity harness measured.
-- \`display\`, \`serif\`, \`mono\` and \`accent\` are the other four levers; every
-- one of them is asserted below against a face that actually loads, because a
-- role naming a family nothing serves is a role that silently means Arial.
--
-- The muted text and the surface are FLATTENED alphas: \`rgba(BONE, .65)\` and
-- \`rgba(4, 20, 19, .9)\` over her ground. The colour roles are hex-only by
-- design, and the flattened value is what a browser paints for those pixels.
--
-- RE-RUNNABLE, AND IT UPDATES. The first version only inserted where nothing
-- existed, which made a correction impossible to apply — the rows were already
-- there, so a re-run was a silent no-op and the wrong identity stayed live.
-- It now writes the migrated identity whether or not a row exists. That means
-- re-running it DISCARDS studio edits to these three keys; the plan-17 capture
-- trigger records every change to \`content_overrides\`, so a clobber is visible
-- in Client Versions and revertible, but do not re-run this after Marthe starts
-- editing her theme.`,
    ) +
    rows
      .map(
        ([key, value]) => `
-- ── ${key} ────────────────────────────────────────────────────────────────
INSERT INTO public.content_overrides (key, lang, mode, user_id, data, updated_at, site)
SELECT ${lit(key)}, 'en', 'published', NULL, ${json(value)}, now(), ${lit(SITE)}
 WHERE NOT EXISTS (
   SELECT 1 FROM public.content_overrides
    WHERE site = ${lit(SITE)} AND key = ${lit(key)}
      AND lang = 'en' AND mode = 'published'
      AND user_id IS NOT DISTINCT FROM NULL
 );

UPDATE public.content_overrides
   SET data = ${json(value)}, updated_at = now()
 WHERE site = ${lit(SITE)} AND key = ${lit(key)}
   AND lang = 'en' AND mode = 'published'
   AND user_id IS NOT DISTINCT FROM NULL
   AND data IS DISTINCT FROM ${json(value)};
`,
      )
      .join("") +
    `
-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int; role text;
BEGIN
  SELECT count(*) INTO n FROM public.content_overrides
   WHERE site = ${lit(SITE)} AND mode = 'published' AND user_id IS NULL
     AND key IN ('theme', 'siteBackground', 'siteFonts');
  IF n <> 3 THEN
    RAISE EXCEPTION 'assert: expected 3 identity rows, found %', n;
  END IF;

  -- A face that points at a path HQ does not serve loads nothing and falls back
  -- in silence — the exact failure this row exists to prevent.
  SELECT count(*) INTO n FROM public.content_overrides c,
       LATERAL jsonb_array_elements(c.data->'faces') f
   WHERE c.site = ${lit(SITE)} AND c.key = 'siteFonts'
     AND f->>'src' NOT LIKE '/fonts/tenants/${SITE}/%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % font face(s) point outside the tenant font dir', n;
  END IF;

  -- The theme names families; siteFonts must actually carry them. EVERY role
  -- she declares, not a sample: each one here is a different family, and
  -- checking a subset is how the unchecked one falls back to a system sans in
  -- silence — correct colours, correct words, wrong site. The list is generated
  -- from the same \`themeFonts\` the row above is built from, so a role added
  -- there cannot arrive unasserted.
  FOR role IN SELECT unnest(ARRAY[${Object.keys(themeFonts)
    .filter((k) => k !== "guards" && k !== "unbacked" && !themeFonts.unbacked.includes(k))
    .map((k) => lit(k))
    .join(", ")}]) LOOP
    SELECT count(*) INTO n FROM public.content_overrides t
     WHERE t.site = ${lit(SITE)} AND t.key = 'theme'
       AND NOT EXISTS (
         SELECT 1 FROM public.content_overrides c,
              LATERAL jsonb_array_elements(c.data->'faces') f
          WHERE c.site = t.site AND c.key = 'siteFonts'
            AND split_part(t.data->'fonts'->>role, ',', 1) = (f->>'family')
       );
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: the theme''s % font is a family no face loads', role;
    END IF;
  END LOOP;

  -- AND THE OTHER WAY, for the roles named unbacked in \`themeFonts.unbacked\`.
  -- \`serif\` reads \`'Cormorant Garamond', Georgia, serif\` because that is her
  -- token verbatim, and NO Cormorant face ships, because her live pages resolve
  -- it to Georgia — 293 elements on home-classic, 28 on pearl-chamber, 24 on
  -- writing, and Marthe's own account of what she uses (2026-08-09). Asserting
  -- the ABSENCE is what keeps that a decision rather than an omission: ship the
  -- face again and this fails, which is precisely when the ruling should be
  -- re-read. It also insists the stack still names a real fallback, since an
  -- unbacked first rung with nothing behind it is a page in the browser's
  -- default and not a design.
  FOR role IN SELECT unnest(ARRAY[${themeFonts.unbacked
    .map((k) => lit(k))
    .join(", ")}]) LOOP
    SELECT count(*) INTO n FROM public.content_overrides t
     WHERE t.site = ${lit(SITE)} AND t.key = 'theme'
       AND EXISTS (
         SELECT 1 FROM public.content_overrides c,
              LATERAL jsonb_array_elements(c.data->'faces') f
          WHERE c.site = t.site AND c.key = 'siteFonts'
            AND split_part(t.data->'fonts'->>role, ',', 1) = (f->>'family')
       );
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % is declared unbacked but a face now loads it', role;
    END IF;

    SELECT count(*) INTO n FROM public.content_overrides t
     WHERE t.site = ${lit(SITE)} AND t.key = 'theme'
       AND t.data->'fonts'->>role !~ ',';
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % is unbacked and names no fallback', role;
    END IF;
  END LOOP;

  -- The sky is the star landing's, not the retired one-pager's. A wrong ground
  -- here is the difference between a blue night and a green one, and it is the
  -- defect the 2026-08-06 parity pass found.
  SELECT count(*) INTO n FROM public.content_overrides
   WHERE site = ${lit(SITE)} AND key = 'siteBackground'
     AND data->>'color' = ${lit(ground.hex)};
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: siteBackground.color is not %', ${lit(ground.hex)};
  END IF;

  -- The reserved scrollbar gutter. Silent when wrong: every page simply lays
  -- out 15px wider than it does on her app, and only a narrow viewport shows it.
  SELECT count(*) INTO n FROM public.content_overrides
   WHERE site = ${lit(SITE)} AND key = 'siteBackground'
     AND data->>'scrollbarGutter' = 'true';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: siteBackground.scrollbarGutter is not reserved';
  END IF;

  -- Her glyph rendering. Silent when wrong in the strongest sense of the word:
  -- it moves no box on any page, so every height, width and wrap stays right
  -- and only the weight of the type is hers or is not.
  SELECT count(*) INTO n FROM public.content_overrides
   WHERE site = ${lit(SITE)} AND key = 'siteBackground'
     AND data->>'fontSmoothing' = 'true';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: siteBackground.fontSmoothing is not set';
  END IF;

  -- Her shell's viewport floor. Silent when wrong in a third way again: it is
  -- invisible on every page long enough to fill a screen, and shows up only as
  -- a short page's footer riding up with bare ground beneath it.
  SELECT count(*) INTO n FROM public.content_overrides
   WHERE site = ${lit(SITE)} AND key = 'siteBackground'
     AND data->>'fillsViewport' = 'true';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: siteBackground.fillsViewport is not set';
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT key, jsonb_pretty(data) FROM public.content_overrides
 WHERE site = ${lit(SITE)} AND mode = 'published' AND user_id IS NULL
 ORDER BY key;

COMMIT;
`
  );
}

function pagesSql(pages, forms, ownerNote) {
  const types = [...new Set(pages.flatMap((p) => p.model.sections.map((s) => s.type)))];
  return (
    BANNER(
      "02-pages.sql",
      `-- Her pages as \`page_models\` rows — bucket A's marketing content (the
-- one-pager, its hero, intro, journey gateway, offerings stack with the
-- testimonial bands, FAQ, contact form and about panel; /writing) and, since
-- 2026-08-06, bucket B's commerce funnel: the three doors, the offer detail
-- pages, the offering listing and /pearl-chamber.
--
-- ${ownerNote}
--
-- NOT AUTHORED HERE, and each for a stated reason:
--   • the journey (\`/journey\` and its blocks) and the starseed surfaces move
--     as PACKAGES in Phase 4 — canvas and scroll-driven motion is not catalog
--     material and re-authoring it would lose it. The gateway's words and its
--     link travel now; its seven chakra dots come with the package.
--   • \`experience/[product]\` — three pages her own STATUS.md calls the "old
--     safety-net route", superseded by \`offer/[slug]\`. Their copy is the
--     catalog's \`detail\` blocks nearly verbatim, so authoring them would be
--     two editable copies of the same three offers to keep in step forever.
--     The URLs are preserved as redirects instead.
--   • \`landing-star-preview/course\` — an interactive mockup, not content: four
--     tabs of text inputs and selects whose own copy says "nothing on this page
--     saves". Same class as giocoelho's \`/playlists\` and \`/fitnesstools/timer\`
--     and it needs the same ruling.
--
-- Every section leaves its colour roles EMPTY on purpose. They resolve through
-- \`--tgv-*\`, which 01-theme.sql rewrites to her palette — which is the whole
-- "strip the colours, backfill them as data" instruction: the same rows on an
-- unthemed site render in the platform's colours instead of hers.`,
    ) +
    `
-- ── her forms ──────────────────────────────────────────────────────────────
-- Every form section below is a \`form-live\`, which is reference-by-id: the
-- definition lives in \`public.forms\` and submissions land in her Forms inbox
-- with the anti-abuse engine in front of them. Porting ContactForm.tsx would
-- have been a second form doing the same job — the duplicate-but-different pair
-- that starts drift. Fields, labels, options and the thank-you line are
-- generated from her own source, so the form a visitor meets is the one she
-- wrote.
--
-- Each id is DERIVED from the site and the slug, not random, so this file names
-- the same rows every time it runs.
--
--   contact       — the one on both landings, from her i18n dictionary.
--   pearl-chamber — name, email, intention, and a thank-you screen carrying the
--                   two PayPal links. Her page reveals them only after the
--                   intention is in hand, because the intention is what goes in
--                   the box; the links live on the thank-you rather than on the
--                   page so that order survives the move.
${forms
  .map(
    (form) => `INSERT INTO public.forms (id, site_id, owner_member_id, slug, title, purpose, status, definition, definition_version)
SELECT ${lit(form.id)}::uuid, v.id, o.member_id, ${lit(form.slug)}, ${lit(form.title)},
       'general', 'published', ${json(form.definition)}, 1
  FROM public.villager_sites v
  JOIN LATERAL (
    SELECT member_id FROM public.villager WHERE site_id = v.id ORDER BY member_id LIMIT 1
  ) o ON true
 WHERE v.subdomain = ${lit(SITE)}
   AND NOT EXISTS (SELECT 1 FROM public.forms WHERE id = ${lit(form.id)}::uuid);
`,
  )
  .join("\n")}
CREATE TEMP TABLE _rw_pages (slug text, title text, in_nav boolean, mode text, model jsonb)
  ON COMMIT DROP;

` +
    pages
      .map(
        (p) => `INSERT INTO _rw_pages VALUES (${lit(p.slug)}, ${lit(p.title)}, ${p.inNav}, ${lit(p.mode ?? "published")}, ${json(p.model)});
`,
      )
      .join("\n") +
    `
-- ── insert ─────────────────────────────────────────────────────────────────
-- Null-safe NOT EXISTS on the same tuple the unique index names — the index
-- cannot do this job because a published row carries user_id NULL and NULL is
-- distinct from NULL.
--
-- MODE IS PER ROW. Most are 'published'; a page she BUILT but does not currently
-- serve arrives as 'draft' — publicly inert (readPublishedPageWithFlags filters
-- on mode) and visible in the studio, which is where she decides whether it goes
-- live. That is the platform's own idiom for "kept, not deleted", and it beats
-- leaving the content as unreachable code in her repo.
WITH ins AS (
  INSERT INTO public.page_models
    (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
  SELECT r.slug, 'en', r.mode, NULL, NULL, r.title, true, r.in_nav, r.model, now(), ${lit(SITE)}
    FROM _rw_pages r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.page_models p
      WHERE p.site = ${lit(SITE)} AND p.slug = r.slug AND p.lang = 'en'
        AND p.mode = r.mode AND p.user_id IS NOT DISTINCT FROM NULL
   )
  RETURNING 1
)
SELECT 'pages authored: ' || count(*) FROM ins;

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n int;
  expected constant text[] := ARRAY[${pages.filter((p) => (p.mode ?? "published") === "published").map((p) => lit(p.slug)).join(", ")}];
  expected_drafts constant text[] := ARRAY[${pages.filter((p) => p.mode === "draft").map((p) => lit(p.slug)).join(", ")}]::text[];
BEGIN
  SELECT count(*) INTO n FROM public.page_models
   WHERE site = ${lit(SITE)} AND lang = 'en' AND mode = 'published'
     AND user_id IS NULL AND deleted_at IS NULL AND is_public
     AND slug = ANY(expected);
  IF n <> array_length(expected, 1) THEN
    RAISE EXCEPTION 'assert: expected % pages readable, found %', array_length(expected, 1), n;
  END IF;

  -- The drafts are present AND still drafts. A draft that quietly became a
  -- published row is a page she never chose to serve, live on her domain.
  IF array_length(expected_drafts, 1) IS NOT NULL THEN
    SELECT count(*) INTO n FROM public.page_models
     WHERE site = ${lit(SITE)} AND lang = 'en' AND mode = 'draft'
       AND user_id IS NULL AND deleted_at IS NULL
       AND slug = ANY(expected_drafts);
    IF n <> array_length(expected_drafts, 1) THEN
      RAISE EXCEPTION 'assert: expected % draft page(s), found %', array_length(expected_drafts, 1), n;
    END IF;

    SELECT count(*) INTO n FROM public.page_models
     WHERE site = ${lit(SITE)} AND mode = 'published' AND deleted_at IS NULL
       AND slug = ANY(expected_drafts);
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % draft page(s) also exist published', n;
    END IF;
  END IF;

  -- THE SIBLING ROWS THIS FILE DOES NOT AUTHOR ARE STILL HERE.
  --
  -- This assertion exists because the trap fired. The re-author recipe in
  -- README.md deletes the slugs THIS file writes and re-runs it; a session
  -- deleting \`site = 'resonantweaver' AND user_id IS NULL\` instead — every
  -- pooled row, not the eighteen — and re-running only this file leaves the
  -- site looking complete and \`/journey/\` answering 404. It did, for most of
  -- 2026-08-09, and nothing said so: the page count was right, every assertion
  -- in this block passed, and the differ reported \`aligned n/a\` for a page
  -- that had measured 2.7% that morning. A 404 is not a parity finding, so the
  -- board simply stopped mentioning it.
  --
  -- A file asserts about its own output — but it can NOTICE when a sibling's
  -- output has gone missing under it, and that costs one query. The journey row
  -- is authored by 03-journey-preview.sql, renamed by 04 and re-chromed by 09;
  -- replay all three, in that order, to restore it.
  SELECT count(*) INTO n FROM public.page_models
   WHERE site = ${lit(SITE)} AND lang = 'en' AND mode = 'published'
     AND user_id IS NULL AND deleted_at IS NULL AND is_public
     AND slug = 'journey';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: the journey row is gone — replay 03, then 04, then 09 (found %)', n;
  END IF;

  -- Every section names a type the shared catalog renders. A typo is invisible
  -- in SQL and shows up as a blank band — how the homeHero gap presented on
  -- giocoelho.
  --
  -- SCOPED TO THE SLUGS THIS FILE AUTHORS. It used to sweep every published row
  -- of hers while listing only the types THIS file emits, which was true right
  -- up until a sibling migration in this directory authored one more: the
  -- \`journey\` row (04-journey-row.sql) is \`rf-journey\`, and this assertion
  -- failed the whole transaction over a row it had not written and had no
  -- opinion about. A file asserts about its own output.
  -- Drafts are checked too: a draft is a page she is expected to OPEN, and a
  -- section type the catalog cannot render is a blank band whether or not the
  -- row is live.
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = ${lit(SITE)}
     AND p.slug = ANY(expected || expected_drafts)
     AND s->>'type' NOT IN (${types.map(lit).join(", ")});
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % section(s) name an unexpected type', n;
  END IF;

  -- No path that would resolve against HER app. Only ever caught by a browser
  -- or by this line.
  SELECT count(*) INTO n FROM public.page_models
   WHERE site = ${lit(SITE)} AND model_json::text ~ '"/images/(?!tenants/)';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) carry an app-relative asset path', n;
  END IF;

  -- The contact section points at a form that exists and belongs to her site.
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = ${lit(SITE)} AND s->>'type' = 'form-live'
     AND NOT EXISTS (
       SELECT 1 FROM public.forms f JOIN public.villager_sites v ON v.id = f.site_id
        WHERE f.id = (s->'config'->'props'->>'formId')::uuid
          AND v.subdomain = ${lit(SITE)} AND f.status = 'published'
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % form section(s) point at no published form of hers', n;
  END IF;

  -- Copy the migration made untrue must not come back. Each of these named a
  -- file in her repo as the way to edit this page; the studio is that way now.
${rewrites
  .map(
    (r) => `  SELECT count(*) INTO n FROM public.page_models
   WHERE site = ${lit(SITE)} AND strpos(model_json::text, ${lit(r.find)}) > 0;
  IF n <> 0 THEN
    RAISE EXCEPTION ${lit(`assert: superseded copy is back — ${r.why}`)};
  END IF;
`,
  )
  .join("\n")}
  RAISE NOTICE 'assertions passed';
END $$;

SELECT slug, mode, title, is_public, in_nav,
       jsonb_array_length(model_json->'sections') AS sections
  FROM public.page_models
 WHERE site = ${lit(SITE)} AND user_id IS NULL AND deleted_at IS NULL
 ORDER BY mode DESC, slug;

COMMIT;
`
  );
}

/* -------------------------------------------------------------------- main --- */

const data = await loadData();

// One waitlist form per waitlist offer, built first so each page can name the
// row the same file creates. Zipped rather than looked up by index: an offer
// added to her catalog must not be able to hand its page somebody else's form.
const waitlistOffers = offersWithWaitlist(data);
const waitlistForms = waitlistOffers.map((e) => buildWaitlistForm(data.resolveOffer(e)));

const forms = [buildForm(data), buildPearlForm(), ...waitlistForms];
const [contactForm, pearlForm] = forms;
guardRoutes();
const pages = [
  buildStarLanding(data, contactForm.id),
  buildHomeClassic(data, contactForm.id),
  buildWriting(data),
  ...ALL_GATEWAYS.map((id) => buildGatewayPage(data, id)),
  buildAllProducts(data),
  buildPearlChamber(data, pearlForm.id),
  buildStarseed(data),
  ...offersWithDetailPages(data).map((e) => buildOfferPage(data, e)),
  ...waitlistOffers.map((e, i) => buildWaitlistPage(data, e, waitlistForms[i].id)),
];

/** Applied to every string leaf of every model, so a rewrite cannot be missed
 *  by having been declared in the wrong builder. */
function rewriteStrings(node) {
  if (typeof node === "string") {
    return rewrites.reduce((s, r) => s.split(r.find).join(r.replace), node);
  }
  if (Array.isArray(node)) return node.map(rewriteStrings);
  if (node && typeof node === "object") {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, rewriteStrings(v)]));
  }
  return node;
}
for (const p of pages) p.model = rewriteStrings(p.model);
for (const r of rewrites) {
  if (JSON.stringify(pages).includes(r.find)) {
    die(`rewrite did not take: ${JSON.stringify(r.find.slice(0, 60))}`);
  }
}

// Both bodies are BUILT before the drift gate, not after: half the guards
// (the orbs, the radii, the ground) only run inside themeSql, and a gate that
// fires before they have spoken is a gate with a hole in it — which is exactly
// what the first negative test of this file found.
const outputs = [
  ["01-theme.sql", themeSql(data)],
  [
    "02-pages.sql",
    pagesSql(
      pages,
      forms,
      `Forms (public.forms, owned by whoever owns her villager_sites row): ` +
        forms.map((f) => `${f.slug} ${f.id}`).join(", ") + `.`,
    ),
  ],
];

if (drift.length) {
  console.error("generate: her source has moved under these transcriptions:\n");
  for (const d of drift) console.error(`  ${d}`);
  console.error(
    "\nUpdate copy.mjs to match her repo (that is the point of the guard), then re-run.",
  );
  process.exit(1);
}

// Every asset the rows name must be a file HQ can actually serve. The SQL
// asserts the PREFIX; this asserts the file.
const missing = [];
for (const p of pages) {
  for (const m of JSON.stringify(p.model).matchAll(/"(\/(?:images|fonts)\/tenants\/[^"]+)"/g)) {
    if (!fs.existsSync(path.join(HQ, "public", m[1]))) missing.push(m[1]);
  }
}
for (const f of webfonts) {
  if (!fs.existsSync(path.join(HQ, "public", f.src))) missing.push(f.src);
}
if (missing.length) {
  console.error(`generate: ${missing.length} asset(s) named but not in HQ's public/:`);
  for (const m of new Set(missing)) console.error(`  ${m}`);
  process.exit(1);
}

let stale = 0;
for (const [name, body] of outputs) {
  const file = path.join(HERE, name);
  const prev = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (prev === body) {
    console.log(`  = ${name} (unchanged)`);
    continue;
  }
  stale += 1;
  if (CHECK) {
    console.error(`generate --check: ${name} is stale`);
    continue;
  }
  fs.writeFileSync(file, body);
  console.log(`  → ${name} (${body.split("\n").length} lines)`);
}

if (CHECK && stale) process.exit(1);

const sectionCount = pages.reduce((n, p) => n + p.model.sections.length, 0);
console.log(
  `generate: ${pages.length} page(s), ${sectionCount} sections, ${forms.length} forms, ` +
    `${orbs.length} orbs, ${webfonts.length} faces + ${webfontAliases.length} aliases — ` +
      `assets under ${ASSET_BASE}`,
);
