// copy.mjs — the prose on resonantweaver.com that is NOT in `src/data/*`.
//
// Phase 3's rule is that her pages are GENERATED from her own source, because
// generated is what makes the first render identical by construction. Most of
// her content obeys that already: offerings, testimonials, the FAQ, the writing
// entries and the contact dictionary are typed objects the generator imports and
// uses verbatim. The rest — a hero eyebrow, a tagline, two intro paragraphs, an
// about panel, a few headings — is written inline in her JSX, where there is no
// object to import.
//
// SO EVERY STRING HERE IS TRANSCRIBED AND THEN CHECKED BACK AGAINST HER SOURCE.
// `generate.mjs` reads the named file, normalises it the way JSX does (collapse
// whitespace, unescape entities) and REFUSES TO EMIT if the string is not found.
// That is the difference between a transcription and a copy: if Marthe edits the
// tagline in her repo, this file stops being true and the generator says so,
// instead of quietly shipping last month's words.
//
// `find` overrides what to look for when the rendered text and the source text
// genuinely differ (a template literal's backticks, a `<br />` inside a heading).

const HOME = "src/app/[lang]/(public)/(home)";

/** Everything below is `{ file, text, find? }`. `file` is relative to the
 *  resonantweaver.com checkout. */
export const inlineCopy = {
  hero: {
    eyebrow: {
      file: `${HOME}/components/HeroSection.tsx`,
      text: "Galactic Bridge ✦ Energy Guide",
    },
    tagline: {
      file: `${HOME}/components/HeroSection.tsx`,
      text: "A return to yourself",
    },
    // The wordmark is split across spans so the initial can be enlarged and the
    // words can break onto two lines; rf-split-hero takes it as words + a label.
    words: ["RESONANT", "WEAVER"],
    ariaLabel: {
      file: `${HOME}/components/HeroSection.tsx`,
      text: "Resonant Weaver",
      find: 'aria-label="Resonant Weaver"',
    },
    markUrl: {
      file: `${HOME}/components/HeroSection.tsx`,
      text: "/images/Logo-RW-2026.svg",
    },
  },

  intro: [
    {
      file: `${HOME}/components/IntroSection.tsx`,
      text: "Most people have never truly felt themselves. Life moves fast, and the subtle layers of your own system are easy to lose track of. Through field readings and Human Design informed somatic practice, I help you get genuinely familiar with how your energy moves, what it carries, and what it feels like when it's actually yours.",
    },
    {
      file: `${HOME}/components/IntroSection.tsx`,
      text: "This work supports deeper awareness, wider perception, and the quiet internal coherence of knowing what is actually true for you.",
    },
  ],

  // The journey gateway. Its CTA points into bucket C, which moves as a package
  // in Phase 4 — the words and the link are content and travel now.
  gateway: {
    eyebrow: {
      file: `${HOME}/JourneyGateway.tsx`,
      text: "Before you choose a service",
    },
    question: {
      file: `${HOME}/JourneyGateway.tsx`,
      text: "Where are you in your energetic field right now?",
    },
    ctaLabel: { file: `${HOME}/JourneyGateway.tsx`, text: "Enter the field" },
    ctaHref: { file: `${HOME}/JourneyGateway.tsx`, text: "/journey", find: 'href="/journey"' },
    note: {
      file: `${HOME}/JourneyGateway.tsx`,
      text: "A short self-guided journey through the seven energy centers",
    },
  },

  offeringsHeading: { file: `${HOME}/onePage.tsx`, text: "Work with me" },

  faq: {
    heading: {
      file: `${HOME}/components/FAQAccordion.tsx`,
      text: "Frequently Asked Questions",
    },
    lede: {
      file: `${HOME}/components/FAQAccordion.tsx`,
      text: "Common queries about the nature of this work.",
    },
  },

  contactHeading: {
    file: `${HOME}/components/ContactSection.tsx`,
    text: "Get in touch",
  },

  about: {
    title: { file: `${HOME}/components/AboutSection.tsx`, text: "Background" },
    sub: {
      file: `${HOME}/components/AboutSection.tsx`,
      text: "Practice, training, and orientation",
    },
    mediaUrl: {
      file: `${HOME}/components/AboutSection.tsx`,
      text: "/images/About-Portrait.png",
    },
    mediaAlt: {
      file: `${HOME}/components/AboutSection.tsx`,
      text: "Portrait of Marthe",
    },
    paragraphs: [
      {
        file: `${HOME}/components/AboutSection.tsx`,
        text: "I live in a small forest in Sweden, on a homestead we're slowly learning to run. Most things here have been figured out the hard way. Carrying water from a neighbour's well, making firewood, learning to grow food from scratch. It has been a good teacher in paying attention to what's actually there rather than what you expect to find.",
      },
      {
        file: `${HOME}/components/AboutSection.tsx`,
        text: "I've been drawn to what moves beneath the surface since I was a child. That curiosity became a practice, and the practice became this work. I hold certifications in mediumship, Usui Reiki Master/Teacher, and soul guide work, and I've spent years developing a way of reading energetic fields that is closer to structural mapping than interpretation.",
      },
      {
        file: `${HOME}/components/AboutSection.tsx`,
        text: "I receive through clairsentience and claircognizance. I feel what is happening in a field directly, in my own system, and translate that into something grounded and usable. I also work with light language, spoken and through movement, when a field needs direct intervention rather than reflection.",
      },
    ],
  },

  writing: {
    eyebrow: { file: `${HOME}/writing/WritingPage.tsx`, text: "Writing" },
    // The title is one heading broken by a <br /> with the second half in <em>.
    titleLine1: {
      file: `${HOME}/writing/WritingPage.tsx`,
      text: "Field notes, essays,",
    },
    titleLine2: {
      file: `${HOME}/writing/WritingPage.tsx`,
      text: "& reflections.",
    },
    intro: {
      file: `${HOME}/writing/WritingPage.tsx`,
      text: "A small library for longer pieces from Resonant Weaver. Each entry can hold a short introduction here and open the full article on Substack.",
    },
  },
};

/** Strings the MIGRATION ITSELF makes untrue, and what they become.
 *
 *  Her two writing entries are scaffolding — placeholders that tell the reader
 *  how to add a real one, and the instructions name a file in her repo. Once
 *  the page is a `page_models` row, editing `articles.ts` changes nothing: the
 *  studio is where the cards live. Carrying the sentence across verbatim would
 *  publish directions that lead nowhere.
 *
 *  Same call Gio made on refusionist's `/humandesign`, where pointing the CTA
 *  at the real booker made three dictionary strings false and they were
 *  rewritten with an assertion that fails if the old phrasing returns. The
 *  generator refuses to emit while `find` is still anywhere in the output, and
 *  02-pages.sql asserts the same thing against the row. */
export const rewrites = [
  {
    find: "Open `src/data/writing/articles.ts`, duplicate an entry, paste in the article title, excerpt, date, and full Substack URL in `href`.",
    replace:
      "Open this page in the studio, duplicate a card, and paste in the article title, excerpt, date, and the full Substack URL.",
    why: "the file it names stops being the source of this page at cutover",
  },
  {
    find: "Edit locally",
    replace: "Edit in the studio",
    why: "the same instruction in the card's meta line",
  },
];

/** The two ambient orbs behind the whole page.
 *
 *  These are CSS, not data, so they are transcribed like the prose above and
 *  guarded the same way — `find` is the distinctive fragment of the rule each
 *  number came out of, so a change to the blur, the drift or the duration in
 *  her stylesheet fails the generator instead of silently diverging.
 *
 *  Percentages are of the viewport, matching SiteBackdropOrb's contract, which
 *  is also what her `position: fixed; width: 80%` rules mean. */
export const orbs = [
  {
    // OrbA — copper, top-left, the warmer of the two.
    color: "#b78a77",
    top: -20,
    left: -20,
    size: 80,
    blur: 90,
    alpha: 0.07,
    from: 0.5,
    to: 0.85,
    driftX: 10,
    driftY: 10,
    duration: 22,
    guards: [
      { file: `${HOME}/OnePage.styles.ts`, find: "rgba(${COPPER}, 0.07) 0%, transparent 60%" },
      { file: `${HOME}/OnePage.styles.ts`, find: "animation: ${floatA} 22s infinite alternate ease-in-out" },
      { file: `${HOME}/OnePage.styles.ts`, find: "0% { transform: translate(0, 0); opacity: 0.5; }" },
      { file: `${HOME}/OnePage.styles.ts`, find: "100% { transform: translate(10%, 10%); opacity: 0.85; }" },
    ],
  },
  {
    // OrbB — teal, bottom-right, cooler and slower.
    color: "#48d2b9",
    bottom: -20,
    right: -20,
    size: 80,
    blur: 90,
    alpha: 0.06,
    from: 0.35,
    to: 0.65,
    driftX: -10,
    driftY: -6,
    duration: 28,
    guards: [
      { file: `${HOME}/OnePage.styles.ts`, find: "rgba(${TEAL}, 0.06) 0%, transparent 60%" },
      { file: `${HOME}/OnePage.styles.ts`, find: "animation: ${floatB} 28s infinite alternate ease-in-out" },
      { file: `${HOME}/OnePage.styles.ts`, find: "0% { transform: translate(0, 0); opacity: 0.35; }" },
      { file: `${HOME}/OnePage.styles.ts`, find: "100% { transform: translate(-10%, -6%); opacity: 0.65; }" },
    ],
  },
];

/** Her radii, read off the three rules that set one on a real surface. */
export const radii = {
  card: { value: "14px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 14px" },
  button: { value: "8px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 8px" },
  small: { value: "4px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 4px" },
};

/** The ground her palette sits on. `tokens.ts` has no background — it is the
 *  first declaration in `Body`, which is why Phase 1 could not find it. */
export const ground = {
  hsl: "hsl(165, 60%, 6%)",
  file: `${HOME}/OnePage.styles.ts`,
  find: "--background:    hsl(165, 60%, 6%)",
};

/** The one flat panel colour in the file — the fixed font-preview pill. Every
 *  other surface she has is a translucent gradient over the ground, so this is
 *  the only literal there is to give the theme's `surface` role. */
export const panel = {
  rgba: [4, 20, 19, 0.9],
  file: `${HOME}/OnePage.styles.ts`,
  find: "background: rgba(4, 20, 19, 0.9)",
};

/** ASSETS. Her `/images/*` paths resolve against HER app; on the shared
 *  renderer they resolve against nothing, which is giocoelho's broken-image
 *  trap. Every path the generator emits goes through this map, and a path with
 *  no entry is an error rather than a 404 discovered in a browser. */
export const ASSET_BASE = "/images/tenants/resonantweaver";
export const assetMap = {
  "/images/Logo-RW-2026.svg": `${ASSET_BASE}/Logo-RW-2026.svg`,
  "/images/energybody.png": `${ASSET_BASE}/energybody.png`,
  "/images/ReikiBox.png": `${ASSET_BASE}/ReikiBox.png`,
  "/images/About-Portrait.png": `${ASSET_BASE}/About-Portrait.png`,
  "/images/RW-OG-logo.jpg": `${ASSET_BASE}/RW-OG-logo.jpg`,
  // The one door still on the hub. Her other two door images (learn.png,
  // experience.png) belong to `retiredDoors` and are deliberately NOT mapped —
  // an unmapped path is an error, which is what should happen if a retired door
  // ever comes back through here without someone looking at it.
  "/images/landing-star-preview/GalacticSelf.jpg": `${ASSET_BASE}/GalacticSelf.jpg`,
  // `/images/LeafOscilator-Logo4.png` is deliberately ABSENT. It is referenced
  // by the second writing entry and THERE IS NO SUCH FILE in her repo — that
  // card's cover is broken on the live site today. Leaving it unmapped makes
  // the generator drop the src rather than carry a 404 onto the platform, and
  // the SQL header records it so it can be filled in the studio.
};

/** The webfont her whole site is set in. Named in `src/styles/tokens.ts` as a
 *  family and loaded by a Google Fonts `@import` in `src/styles/journey.css` —
 *  which does not travel with her pages, so the face is re-hosted under HQ's
 *  own origin and declared as a `siteFonts` row. Cormorant Garamond is SIL OFL,
 *  which is what makes re-hosting it ours to do.
 *
 *  ONE FILE PER STYLE, not per weight: it is a variable font, and Google serves
 *  the identical woff2 for 300 and 400. `300 700` is the range that file
 *  actually covers. */
export const FONT_BASE = "/fonts/tenants/resonantweaver";
export const webfonts = [
  {
    family: "Cormorant Garamond",
    src: `${FONT_BASE}/cormorant-garamond-latin.woff2`,
    weight: "300 700",
    style: "normal",
    display: "swap",
  },
  {
    family: "Cormorant Garamond",
    src: `${FONT_BASE}/cormorant-garamond-latin-italic.woff2`,
    weight: "300 700",
    style: "italic",
    display: "swap",
  },
];
