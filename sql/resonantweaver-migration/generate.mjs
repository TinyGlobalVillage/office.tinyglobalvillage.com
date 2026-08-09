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
 *  The colours are the ROW's, deliberately swapped off the theme fan-out: this
 *  hero's primary is her COPPER (the wordmark, the mark's halo and near
 *  drop-shadow, the rule — `var(--primary)` / `FadeLineV` in her source) and
 *  its second accent is the TEAL her eyebrow and tagline wear at 0.68/0.64.
 *  Left to the fallbacks the entry paints the wordmark `--tgv-cyan` and the
 *  eyebrow `--tgv-gold` — the exact copper↔teal inversion the 2026-08-08
 *  differ measured on every wordmark letter. `markRight` was the other row
 *  bug: `SymbolWrap` is the FIRST grid child in `HeroSection.tsx`, mark LEFT.
 *
 *  `size` fits the STAR landing, whose `PreviewBody h1` upsizes every h1 on
 *  the page (4.5vw at 1440 = 64.8px base, ×1.22 initials = the 79.056px the
 *  differ measured); the classic landing has no such override, so it keeps
 *  the entry's default clamp — which IS `H1`'s in `OnePage.styles.ts`. */
function heroSection(data, { size } = {}) {
  const copper = toHex(parseTriplet(data.tokens.COPPER));
  const teal = toHex(parseTriplet(data.tokens.TEAL));
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
    accent: `var(--tgv-gold, ${copper})`,
    amber: `var(--tgv-cyan, ${teal})`,
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

  // The SAME hero the star landing renders — heroSection() is the one place it
  // is built, matching how her `HeroSection.tsx` is imported by both pages.
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
    }),
  );

  sections.push(
    section("sec-journey-gateway", "rf-media-copy", "Journey gateway", {
      imageUrl: "",
      imageAlt: "",
      imagePosition: "left",
      eyebrow: verbatim(inlineCopy.gateway.eyebrow),
      eyebrowColor: "amber",
      // No heading, deliberately. Her gateway has none: `Question` is a
      // centred italic <p> in muted text, not an <h2>, and authoring it as a
      // heading put an 800-weight line on a page that has no bold on it.
      // Rendering it as the paragraph it is, is both closer and simpler — and
      // is only possible now that an empty heading emits no element.
      heading: "",
      headingLevel: 2,
      headingAccent: "",
      paragraphs: [verbatim(inlineCopy.gateway.question), verbatim(inlineCopy.gateway.note)],
      chips: [],
      ctas: [
        {
          label: verbatim(inlineCopy.gateway.ctaLabel),
          href: verbatim(inlineCopy.gateway.ctaHref),
          variant: "ritual",
        },
      ],
    }),
  );

  // The offerings stack: a row, then that row's testimonials, repeating. The
  // heading rides on the first row so it cannot drift away from the stack.
  const rows = visibleRows(data.offeringRows);
  rows.forEach((row, i) => {
    sections.push(
      section(`sec-offer-${i + 1}`, "rf-offer-card", `Offerings ${i + 1}`, {
        columns: row.columns,
        heading: i === 0 ? verbatim(inlineCopy.offeringsHeading) : "",
        bulletGlyph: "✦",
        padTop: 0,
        padBottom: 25,
        items: row.items.map(offeringToItem),
      }),
    );
    const quotes = row.items.flatMap((o) => data.testimonialsByOffering[o.title] ?? []);
    if (quotes.length) {
      sections.push(
        section(`sec-quotes-${i + 1}`, "rf-testimonials", `Testimonials — ${row.items[0].title}`, {
          kicker: "Testimonials",
          quoteMark: '"',
          ruleBelow: true,
          items: quotes.map((t) => ({ quote: t.quote, attribution: t.attribution ?? "" })),
        }),
      );
    }
  });

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
      items: data.faqItems.map((f) => ({ name: f.q, body: f.a })),
    }),
  );

  sections.push(
    section("sec-contact", "form-live", "Contact", {
      formId,
      accent: "",
      hideHeader: false,
      maxWidth: 640,
    }),
  );

  // AboutSection.tsx is literally an offerings row holding one compact-media
  // card — no price, no CTA, a portrait beside the copy. Same component.
  sections.push(
    section("sec-about", "rf-offer-card", "About", {
      columns: 1,
      heading: "",
      bulletGlyph: "✦",
      padTop: 0,
      padBottom: 25,
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
  const sections = [
    pageTone("sec-star-tone", [
      "radial-gradient(ellipse 66% 36% at 50% 12%, rgba(35, 82, 121, 0.2), transparent 72%)",
      `radial-gradient(ellipse 50% 34% at 82% 80%, rgba(${data.tokens.TEAL}, 0.035), transparent 70%)`,
    ]),
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
    }),
  );
  // Her FieldGuideTile is the hud material in its SMALL form — 1.4rem pad,
  // 0.62rem eyebrow at 0.16em over a 1.15rem display title, nothing else.
  sections.push(
    section("sec-star-fieldguide", "rf-hud-cards", "Field Guide — tiles", {
      mode: "tile",
      columns: 3,
      heading: "",
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
      muted: `rgba(${data.tokens.BONE}, 0.63)`,
      ctas: [
        {
          label: star.fieldGuide.notify.buttonLabel,
          href: star.fieldGuide.notify.href,
          variant: "ritual",
          // NotifyButton renders "Ask about access →" — the arrow is hers.
          arrow: true,
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
      itemEdge: "rgba(255, 255, 255, 0.08)",
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
      markerColor: `rgba(${data.tokens.TEAL}, 0.8)`,
      priceColor: "",
      linkColor: "",
      badgeColor: "",
      maxWidth: 46,
      cardPad: "clamp(1.6rem, 5vw, 2.6rem)",
      markerSize: "0.64rem",
      markerTracking: "0.22em",
      markerGap: "0.6rem",
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
 *  is a FLATTENED hex (roles are hex-only), so per-section alphas live here. */
const bone = (data, a) => `rgba(${data.tokens.BONE}, ${a})`;

/** OfferBody/GatewayBody's toned ground, as the leading section. */
const pageTone = (id, layers) =>
  section(id, "rf-page-tone", "Page tone", { layers, ground: "#06111c" });

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
    pageTone(`sec-offer-tone-${offer.slug}`, [
      `radial-gradient(ellipse 62% 28% at 28% 8%, ${offer.glow}, transparent 72%)`,
      "radial-gradient(ellipse 44% 25% at 88% 68%, rgba(39, 78, 112, 0.12), transparent 72%)",
    ]),
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
    pageTone(`sec-gw-tone-${id}`, [
      `radial-gradient(ellipse 74% 34% at 70% 6%, ${toneGlow}, transparent 72%)`,
      "radial-gradient(ellipse 50% 30% at 12% 75%, rgba(30, 67, 96, 0.11), transparent 72%)",
    ]),
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
        { ref: "note", type: "long_text", title: verbatim(c.fieldNote), required: false },
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
  const statusLabel = (offer.status ? STATUS_LABEL[offer.status] : "") ?? "";
  if (offer.status && !statusLabel) {
    die(`no transcribed badge label for offer status ${JSON.stringify(offer.status)} (${offer.slug})`);
  }

  const sections = [
    // OfferBody's toned ground — the waitlist shares the detail page's shell.
    pageTone(`sec-wait-tone-${offer.slug}`, [
      `radial-gradient(ellipse 62% 28% at 28% 8%, ${offer.glow}, transparent 72%)`,
      "radial-gradient(ellipse 44% 25% at 88% 68%, rgba(39, 78, 112, 0.12), transparent 72%)",
    ]),
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
      vars: {
        "--mf-ink": `rgb(${data.tokens.BONE})`,
        "--mf-gap": "0.9rem",
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
    pageTone("sec-all-tone", [
      `radial-gradient(ellipse 66% 30% at 50% 4%, rgba(${data.tokens.TEAL}, 0.1), transparent 72%)`,
      `radial-gradient(ellipse 44% 24% at 88% 76%, rgba(${data.tokens.COPPER}, 0.08), transparent 72%)`,
    ]),
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
    section("sec-pearl-card", "rf-offer-card", "The Pearl Chamber", {
      columns: 1,
      heading: "",
      bulletGlyph: "✦",
      padTop: 0,
      padBottom: 25,
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
        },
      ],
    }),
    section("sec-pearl-form", "form-live", "Set your intention", {
      formId,
      accent: "",
      hideHeader: true,
      maxWidth: 640,
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
  // theme.ts — the page's own tokens.
  guardOnly({ file: `${SS}/theme.ts`, find: 'h1Color: "#f5f9f8"' });
  guardOnly({ file: `${SS}/theme.ts`, find: 'copper: "#c79a86"' });
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
  // How it works — her `Steps` rail holding the SHARED <TrainingStep> rows.
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: "margin-top: 34px;" });
  guardOnly({ file: `${SS}/StarseedOraclePage.styles.ts`, find: `border-left: 1px solid rgba(\${BONE}, 0.1);` });
  guardOnly({ file: CARDS, find: "linear-gradient(90deg, rgba(17, 40, 59, 0.2), transparent 62%)" });
  guardOnly({ file: CARDS, find: `color: rgba(\${BONE}, 0.56);` });
  // The closing block — the SHARED <CalloutBar variant="gateway">.
  guardOnly({ file: SSPAGE, find: '<CalloutBar' });
  guardOnly({ file: SSPAGE, find: 'variant="gateway"' });
  guardOnly({ file: CALLOUT, find: "width: min(100% - 3rem, 70rem);" });
  guardOnly({ file: CALLOUT, find: "letter-spacing: 0.18em;" });
  guardOnly({ file: CALLOUT, find: `color: rgba(\${BONE}, 0.59);` });

  /** Her BAND type: IntroEyebrow + IntroTitle + Prose. The eyebrow is
   *  `--preview-meta-font` (Space Mono → the ACCENT role, the family ruling)
   *  and the title `--preview-display-font` (Science Gothic → DISPLAY). */
  const bandType = {
    // Her Wrap's content column, which every band on the page shares.
    maxWidth: 992,
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
    copyTop: "1.25rem",
    copyInk: "#c4ccd0",
  };

  // A section that is eyebrow + title + paragraphs and nothing else. Six of the
  // twelve are exactly this.
  const band = (id, label, block, extra = []) =>
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
    });

  sections.push(
    section("sec-ss-hero", "rf-media-copy", "Hero", {
      imageUrl: asset("/images/StarBot.png"),
      imageAlt: verbatim(s.heroImageAlt),
      imagePosition: "right",
      maxWidth: 992,
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
      copyTop: "1.25rem",
      copyInk: "#c4ccd0",
      paragraphs: c.hero.lead,
      // "64 fixed stars · Your exact birth sky · A guided personal reading" is a
      // row of small caps under the button, which is what a chip row is.
      chips: c.hero.finePrint.split("·").map((t) => t.trim()).filter(Boolean),
      ctas: [{ label: c.hero.primary, href: "#begin", variant: "ritual" }],
    }),
  );

  // The pull quote is one line of her own words set large and italic. It rides
  // with the section it belongs to as an emphasised final paragraph rather than
  // becoming a testimonial — nobody said it about her.
  sections.push(
    band("sec-ss-lineage", "The Stellar Braid", c.lineage, c.lineage.quote.map((l) => `*${l}*`)),
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
      marginBottom: "",
      maxWidth: 62,
      gap: "1rem",
      cardPad: "clamp(1.35rem, 2.5vw, 1.85rem)",
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

  sections.push(band("sec-ss-stars-head", "The eight currents — intro", c.stars));
  sections.push(
    // Each current is a coloured dot, a family name in that colour and an
    // essence line. The colour is the section's whole point — it is the same
    // WCAG-checked accent the product itself paints that family in — so it
    // travels as the row's own colour rather than being flattened away.
    section("sec-ss-currents", "rf-list", "The eight currents", {
      heading: "",
      intro: "",
      items: c.stars.currents.map((cur) => ({
        lead: cur.family,
        text: "",
        sub: cur.essence,
        color: cur.color,
      })),
      notesHeading: "",
      notes: [],
    }),
  );

  sections.push(band("sec-ss-method", "The method", c.method));
  sections.push(
    // Her Cards / Card — the same material, three across, no marker. The three
    // inline SVG glyphs are drawn in the page file and stay behind, as noted
    // at the top of this builder.
    section("sec-ss-method-cards", "rf-hud-cards", "The method — cards", {
      mode: "door",
      columns: 3,
      heading: "",
      marginTop: "34px",
      marginBottom: "",
      maxWidth: 62,
      gap: "16px",
      cardPad: "22px 22px 24px",
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
      copyLh: "1.68",
      copyColor: "#9aa4ab",
      copyGap: "0",
      items: c.cards.map((card) => ({ title: card.title, copy: card.body })),
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
      // TrainingStepRoot's own wash — a literal in her file, not accent-derived.
      cardWash: "rgba(17, 40, 59, 0.2)",
      maxWidth: 62,
      spacedTop: false,
      // The rail follows an eyebrow band of its own, so neither of the entry's
      // two derived gaps applies.
      stepsTop: "34px",
      // TrainingStepBody's copy — rgba over her ground, not a flattened hex,
      // because a section's muted role takes a complete CSS colour.
      muted: `rgba(${T.BONE}, 0.56)`,
    }),
  );

  sections.push(band("sec-ss-audience", "Who it is for", c.audience));

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
      // `--page-glow`, declared on her Page.
      glow: `rgba(${T.TEAL}, 0.14)`,
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
  sections.push(
    section("sec-ss-fineprint", "rf-media-copy", "Direct line + disclaimer", {
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
      ctas: [
        {
          label: c.begin.direct,
          href: `mailto:${verbatim(s.contactEmail)}?subject=${encodeURIComponent(
            verbatim(s.contactTopic),
          )}`,
          variant: "ghost",
        },
      ],
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
      accent1: toHex(teal), // the teal her links, rules and kickers run on
      accent2: toHex(copper), // copper, her primary
      // accent3 is the gold family every rf-* section's `amber` role resolves
      // through. She has no third colour, so it is copper again — anything else
      // would put TGV's amber on her page.
      accent3: toHex(copper),
    },
    // Every role themeFonts declares, `guards` excepted — so adding a role
    // there is the whole edit, and the SQL assertion below reads the same list.
    fonts: Object.fromEntries(
      Object.entries(themeFonts).filter(([k]) => k !== "guards"),
    ),
    radius: { card: radii.card.value, button: radii.button.value, small: radii.small.value },
  };

  // Her `html` reserves the classic scrollbar's width on every page. It is one
  // line of her GlobalStyles and it is worth 15px of content width at every
  // viewport — which on a phone is where a paragraph decides whether to wrap.
  // Measured 2026-08-09: /writing/ at 390, her body box 375 and the pooled one
  // 390, so her intro ran four lines and ours three (−30px of page).
  guardOnly({ file: "src/styles/GlobalStyles.ts", find: "scrollbar-gutter: stable;" });
  const background = {
    orbs: orbs.map(({ guards, ...o }) => o),
    color: toHex(bg),
    scrollbarGutter: true,
  };

  const fonts = { faces: webfonts };

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
    .filter((k) => k !== "guards")
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
    `${orbs.length} orbs, ${webfonts.length} faces — assets under ${ASSET_BASE}`,
);
