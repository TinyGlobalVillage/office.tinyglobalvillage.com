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

  // The offer detail template's own furniture — the five headings and the
  // placeholder warning are written inline in OfferDetail.tsx, not in the offer
  // catalog, because they are the same on every offer.
  offer: {
    workEyebrow: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferDetail.tsx`,
      text: "The work",
      find: 'eyebrow="The work"',
    },
    // DetailSection's default when an offer's `detail` names no listLabel.
    includesLabel: {
      file: "src/components/DetailSection.tsx",
      text: "You'll receive",
      find: 'listLabel = "You\'ll receive"',
    },
    processEyebrow: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferDetail.tsx`,
      text: "The movement",
    },
    processHeading: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferDetail.tsx`,
      text: "How it unfolds",
    },
    closeEyebrow: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferDetail.tsx`,
      text: "When you are ready",
      find: 'eyebrow="When you are ready"',
    },
    placeholderNote: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferDetail.tsx`,
      text: "This page uses placeholder copy — final wording is still being written and hasn't been approved yet.",
    },
  },

  /** THE TWO WAITLIST-ONLY OFFERS — `offer/[slug]` renders `OfferWaitlist` for
   *  an entry with a `waitlistTopic` and no `detail`. A much smaller page than
   *  its detail sibling: a back link, a hero, one heading and a form.
   *
   *  WHAT DOES NOT TRAVEL, and it is the important half. Both entries carry a
   *  `[[placeholder — …]]` paragraph, and both hold notes she wrote to herself
   *  ("Not ready to sell until the profile system and delivery format are
   *  stable"). `OfferWaitlist` never renders `offer.paragraphs` — only the
   *  detail page does — so those words are not on her live site today and must
   *  not arrive on it via the migration. Dropping them is exact parity, not a
   *  judgment call.
   *
   *  The eyebrow is a LITERAL on this route, not the offer's status: every
   *  waitlist hero says "In development" regardless of whether the entry says
   *  `coming-soon`. The status reaches the page separately, through
   *  ProductHero's badge beside the price. */
  waitlist: {
    heroEyebrow: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferWaitlist.tsx`,
      text: "In development",
      find: 'eyebrow="In development"',
    },
    heroAction: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferWaitlist.tsx`,
      text: "Join the waitlist",
      find: 'actionLabel="Join the waitlist"',
    },
    sectionEyebrow: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferWaitlist.tsx`,
      text: "Stay in the loop",
    },
    sectionHeading: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferWaitlist.tsx`,
      text: "Be first to know when this opens",
    },
    // The form itself. Her three labels, her submit and her success line — the
    // component's own defaults, which `OfferWaitlist` never overrides.
    fieldName: { file: "src/components/WaitlistForm.tsx", text: "Your name" },
    fieldEmail: { file: "src/components/WaitlistForm.tsx", text: "Email" },
    fieldNote: {
      file: "src/components/WaitlistForm.tsx",
      text: "Anything you'd like to add (optional)",
      // Split across a <span> in her markup so the "(optional)" can be dimmed.
      find: "Anything you'd like to add <span>(optional)</span>",
    },
    submitLabel: {
      file: "src/components/WaitlistForm.tsx",
      text: "Join the waitlist",
      find: 'submitLabel = "Join the waitlist"',
    },
    successMessage: {
      file: "src/components/WaitlistForm.tsx",
      text: "You're on the list — thank you.",
      find: 'successMessage = "You\'re on the list — thank you."',
    },
    backLabel: {
      file: `${HOME}/landing-star-preview/offer/[slug]/OfferWaitlist.tsx`,
      text: "← Back",
    },
  },

  /** Her StatusBadge's five words — the only thing on a card or a waitlist hero
   *  that says WHEN, so a "Coming soon" offer does not arrive on the platform
   *  silently bookable.
   *
   *  These lived as an unguarded literal map inside generate.mjs until the
   *  waitlist pages needed them too. They are strings transcribed out of her
   *  source like every other string in this file, so they belong here and get
   *  the same guard: rename a label in `Cards.tsx` and the run fails instead of
   *  emitting last month's word. `available` is written unquoted in her map,
   *  hence the different `find`. */
  offerStatus: {
    available: {
      file: "src/components/Cards.tsx",
      text: "Available now",
      find: 'available: "Available now"',
    },
    "founding-access": {
      file: "src/components/Cards.tsx",
      text: "Founding access",
      find: '"founding-access": "Founding access"',
    },
    "coming-soon": {
      file: "src/components/Cards.tsx",
      text: "Coming soon",
      find: '"coming-soon": "Coming soon"',
    },
    "in-development": {
      file: "src/components/Cards.tsx",
      text: "In development",
      find: '"in-development": "In development"',
    },
    waitlist: {
      file: "src/components/Cards.tsx",
      text: "Waitlist",
      find: 'waitlist: "Waitlist"',
    },
  },

  /** `/pearl-chamber` — the subscription page. Every string on it is inline JSX
   *  or a module constant; there is no content module to import, so the whole
   *  page is transcribed and guarded.
   *
   *  The two PayPal URLs are guarded too. They are the only strings here that
   *  are not words, and they are the two that MUST NOT drift: a stale payment
   *  link takes money to the wrong plan, or to none, and looks exactly like a
   *  working one. */
  pearl: {
    file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
    title: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "The Pearl Chamber",
      find: "<H3>The Pearl Chamber</H3>",
    },
    sub: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Set your intention",
      find: "<Sub>Set your intention</Sub>",
    },
    lead: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Share your name, email, and the intention you want held in the Pearl Chamber. Once it is received, you can complete your payment.",
    },
    price: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "$11 / week",
      find: "<Price>$11 / week</Price>",
    },
    imageAlt: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Pearl Chamber subscription artwork",
    },
    fieldName: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Name",
      find: "<Field> Name <input",
    },
    fieldEmail: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Email",
      find: "<Field> Email <input",
    },
    fieldIntention: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Intention",
      find: "<Field> Intention <textarea",
    },
    submitLabel: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Continue to Payment",
      find: '? "Sending..." : "Continue to Payment"',
    },
    // The three lines her `ReadyContent` shows once the intention is in — which
    // is exactly what a thank-you screen is, so they become one.
    thanksTitle: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Intention received.",
      find: "<ConfirmationText>Intention received.</ConfirmationText>",
    },
    thanksLine1: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "$11 for one week of daily tending, or as a weekly subscription for continued support.",
    },
    thanksLine2: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "You can cancel any time.",
    },
    onceLabel: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "One Week · $11",
    },
    onceUrl: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "https://www.paypal.com/ncp/payment/DJPQ2RD3V8QAC",
    },
    subscribeLabel: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "Subscribe · $11 / week",
    },
    subscribeUrl: {
      file: `${HOME}/pearl-chamber/PearlChamberSubscriptionPage.tsx`,
      text: "https://www.paypal.com/webapps/billing/plans/subscribe?plan_id=P-92Y41769K2021445TNIKJDZA",
    },
    metaTitle: {
      file: `${HOME}/pearl-chamber/page.tsx`,
      text: "The Pearl Chamber | Resonant Weaver",
    },
    metaDescription: {
      file: `${HOME}/pearl-chamber/page.tsx`,
      text: "Set your intention and subscribe to the weekly Pearl Chamber container.",
    },
  },

  /** `/starseed` — the Starwoven Journey sales page. Nearly all of it lives in
   *  `starseed/content.ts` and is imported; these are the handful of strings
   *  written into `StarseedOraclePage.tsx` itself.
   *
   *  BEGIN_URL is guarded for the same reason the Pearl Chamber's two are: it
   *  is the checkout, and a stale one looks exactly like a working one. */
  starseed: {
    heroImageAlt: {
      file: `${HOME}/starseed/StarseedOraclePage.tsx`,
      text: "A cosmic starseed figure",
    },
    beginUrl: {
      file: `${HOME}/starseed/StarseedOraclePage.tsx`,
      text: "https://www.paypal.com/ncp/payment/BFWAM3BB5NHBW",
    },
    contactEmail: {
      file: `${HOME}/starseed/StarseedOraclePage.tsx`,
      text: "marthe@tinyglobalvillage.com",
    },
    contactTopic: {
      file: `${HOME}/starseed/StarseedOraclePage.tsx`,
      text: "Starwoven Journey",
      find: 'topic: "Starwoven Journey"',
    },
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
    // The blue wash across the top — `ellipse 66% 36% at 50% 12%`. Wide and
    // shallow, which is why SiteBackdropOrb learned width/height: rounding it to
    // a circle is a visibly different sky.
    //
    // `at 50% 12%` is the CENTRE, and an orb is positioned by its EDGE, so the
    // offsets are centre minus half the size: left 50 − 33 = 17, top 12 − 18 = −6.
    color: "#235279",
    top: -6,
    left: 17,
    width: 66,
    height: 36,
    size: 66,
    // Hers is a gradient stop, not a filter — the softness is already in the
    // `transparent 72%` falloff, so a blur on top would double it.
    blur: 0,
    alpha: 0.2,
    from: 1,
    to: 1,
    // Static. The star landing's sky does not drift; OnePage's did.
    duration: 0,
    guards: [
      {
        file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
        find: "radial-gradient(ellipse 66% 36% at 50% 12%, rgba(35, 82, 121, 0.2), transparent 72%)",
      },
    ],
  },
  {
    // The teal glow low and right — `ellipse 50% 34% at 82% 80%`.
    // right 100 − 82 − 25 = −7; bottom 100 − 80 − 17 = 3.
    color: "#48d2b9",
    bottom: 3,
    right: -7,
    width: 50,
    height: 34,
    size: 50,
    blur: 0,
    alpha: 0.035,
    from: 1,
    to: 1,
    duration: 0,
    guards: [
      {
        file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
        find: "radial-gradient(ellipse 50% 34% at 82% 80%, rgba(${TEAL}, 0.035), transparent 70%)",
      },
    ],
  },
];

/** Her radii, read off the three rules that set one on a real surface. */
export const radii = {
  card: { value: "14px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 14px" },
  button: { value: "8px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 8px" },
  small: { value: "4px", file: `${HOME}/OnePage.styles.ts`, find: "border-radius: 4px" },
};

/** The ground her palette sits on — the STAR LANDING's, not OnePage's.
 *
 *  Phase 1 read `--background: hsl(165, 60%, 6%)` out of `OnePage.styles.ts`,
 *  which is real and is the ground her retired one-pager sits on. But the pooled
 *  home IS the star landing (Gio's choice), and that page declares its own:
 *  `#06111c`, a blue night rather than a green one. The parity pass caught the
 *  mismatch as a site that had changed colour, and Gio ruled for the star
 *  landing's look on 2026-08-06.
 *
 *  Kept as hex rather than hsl because that is how she writes it. */
export const ground = {
  hex: "#06111c",
  file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
  find: "#06111c",
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
  // The door images. GalacticSelf is the one door still on the hub AND the
  // offer pages' hero fallback — `ProductHero` uses it for any offer with no
  // `leadImageSrc`, which is four of the six.
  //
  // learn / experience were the two doors she RETIRED from the hub, but they are
  // still the hero artwork of the `develop` and `receive` GATEWAY pages, which
  // answer 200 today. Retired from one surface is not retired from the site.
  //
  // Both re-encoded PNG → JPEG (2.2MB → 383KB, 2.1MB → 324KB) at the same
  // 1024×1536. They are photographs; PNG was costing 6× for nothing.
  // The Starwoven Journey's hero wheel. It STAYS A PNG: the artwork is a disc
  // with a mirrored reflection under it on a transparent ground, and a JPEG
  // flattens that onto white — a white box and a white ghost, on her void
  // backdrop. Resized 1152 → 1024, which is still 2× the ~496px it renders at.
  "/images/StarBot.png": `${ASSET_BASE}/StarBot.png`,
  "/images/landing-star-preview/GalacticSelf.jpg": `${ASSET_BASE}/GalacticSelf.jpg`,
  "/images/landing-star-preview/galactic-pendulum.svg": `${ASSET_BASE}/galactic-pendulum.svg`,
  "/images/landing-star-preview/learn.png": `${ASSET_BASE}/learn.jpg`,
  "/images/landing-star-preview/experience.png": `${ASSET_BASE}/experience.jpg`,
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

/** The unicode-ranges Google serves these subsets under, copied verbatim from
 *  the `@font-face` block her own build emits. They are here rather than
 *  omitted because a face with no range claims EVERY glyph: the Greek Ubuntu
 *  Mono would then answer for latin text before Space Mono got the chance,
 *  which is the exact bug her `fonts.ts` documents fighting in the other
 *  direction (`adjustFontFallback: false`). */
const SUBSET_LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const SUBSET_GREEK =
  "U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF";
export const webfonts = [
  // The star landing's own two, self-hosted under her tenant directory. Science
  // Gothic is the same variable WOFF2 HQ already serves the field guide from;
  // Space Grotesk is the latin subset Google serves for `wght@300..700`.
  {
    family: "Science Gothic",
    src: `${FONT_BASE}/science-gothic-variable.woff2`,
    weight: "400 800",
    style: "normal",
    display: "swap",
  },
  {
    family: "Space Grotesk",
    src: `${FONT_BASE}/space-grotesk-latin.woff2`,
    weight: "300 700",
    style: "normal",
    display: "swap",
  },
  // Cormorant is what `/journey/` wears on her own app. It rode along here
  // unnamed for two days — loaded but unreachable, because the theme had no
  // role that could hold a serif. It has one now (`themeFonts.serif`), so the
  // face and the name arrived at the same place; naming it still puts it on no
  // page by itself, which is what makes per-page typography a row rather than
  // a re-run of this migration.
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
  // ── The two mono faces, added 2026-08-07 with the type-role work ──────────
  // Measured, not guessed: at 1440 her home wears Space Mono on 31 elements and
  // Ubuntu Mono on 8, and the pooled render had ZERO of either because the
  // theme could name two families and she uses five. Space Mono is a
  // two-weight family (Google ships 400 and 700 only, so her DOM's w500/w600
  // are the browser rounding down to 400) — hence one file per weight rather
  // than the variable range the other three use.
  {
    family: "Space Mono",
    src: `${FONT_BASE}/space-mono-latin.woff2`,
    weight: "400",
    style: "normal",
    display: "swap",
    unicodeRange: SUBSET_LATIN,
  },
  {
    family: "Space Mono",
    src: `${FONT_BASE}/space-mono-latin-bold.woff2`,
    weight: "700",
    style: "normal",
    display: "swap",
    unicodeRange: SUBSET_LATIN,
  },
  // Ubuntu Mono ships BOTH subsets on purpose. Latin is the nav and the footer
  // — "starseed", "sun walk", "contact", "login" and her copyright line all
  // compute to it, which is four of the strings Phase 0 reported missing. Greek
  // is load-bearing separately: it is what draws the Bayer designations
  // (α Lyrae, β Geminorum) on the field guide, where Space Mono has no Greek
  // subset at all. Each face declares its own range so neither claims the
  // other's glyphs — the failure her own fonts.ts documents having hit.
  {
    family: "Ubuntu Mono",
    src: `${FONT_BASE}/ubuntu-mono-latin.woff2`,
    weight: "400",
    style: "normal",
    display: "swap",
    unicodeRange: SUBSET_LATIN,
  },
  {
    family: "Ubuntu Mono",
    src: `${FONT_BASE}/ubuntu-mono-greek.woff2`,
    weight: "400",
    style: "normal",
    display: "swap",
    unicodeRange: SUBSET_GREEK,
  },
];

/** The two families the theme NAMES, read off the star landing's own custom
 *  properties rather than off `tokens.ts`.
 *
 *  This is the distinction the first pass missed. `tokens.ts` exports
 *  `SERIF = 'Cormorant Garamond'`, and the generator made it the whole site's
 *  type — but on the star landing that face appears only under
 *  `&[data-font-preview="original"]`, i.e. the ALTERNATIVE Marthe was previewing
 *  through her FontPreviewSwitch. The page's default, and what her live home and
 *  /starseed/ actually wear, is Science Gothic over Space Grotesk.
 *
 *  A theme has one heading and one body; her site has two typographic families
 *  across different pages. Gio ruled for the star landing's on 2026-08-06. */
export const themeFonts = {
  // `display` and `heading` are the same family TODAY and are separate roles
  // anyway: her wordmark and her h2 both wear Science Gothic, but they are
  // different levers, and collapsing them is what made the wordmark
  // unfixable-without-moving-the-headings during the parity pass.
  display: "Science Gothic, Space Grotesk, sans-serif",
  heading: "Science Gothic, Space Grotesk, sans-serif",
  body: "Space Grotesk, ui-sans-serif, system-ui, sans-serif",
  // `SERIF` from her own tokens.ts. It is what `/journey/` wears; naming it
  // here does not put it on any page, it makes it NAMEABLE by one — which is
  // the whole difference between a loaded face and a usable one.
  serif: "Cormorant Garamond, Georgia, serif",
  // Her site-wide `--font-mono` (GlobalStyles.ts), which is Ubuntu Mono — the
  // nav and the footer. NOT the landing's `--gfg-font-mono`; that one is the
  // meta/kicker face and lands on `accent` below. Reading the two the other way
  // round would have put Space Mono in her nav and Ubuntu Mono on her kickers,
  // and both would have looked deliberate.
  mono: "Ubuntu Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
  // The star landing's `--preview-meta-font`, 762 elements across her site —
  // the single largest family the two-role model could not express.
  accent: "Space Mono, Ubuntu Mono, ui-monospace, monospace",
  guards: [
    {
      file: "src/styles/GlobalStyles.ts",
      find: "--font-mono: var(--gfg-font-read), ui-monospace, SFMono-Regular, Menlo, monospace;",
    },
    {
      file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
      find: "--preview-meta-font: var(--gfg-font-mono), var(--gfg-font-read), ui-monospace, monospace;",
    },
    {
      file: "src/styles/tokens.ts",
      find: `export const SERIF = "'Cormorant Garamond', Georgia, serif";`,
    },
    {
      file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
      find: "--preview-display-font: var(--gfg-font-display), var(--gfg-font-tech), sans-serif",
    },
    {
      file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
      find: "--preview-body-font: var(--gfg-font-tech), ui-sans-serif, system-ui, sans-serif",
    },
    // The switch that makes the serif an alternative rather than the default.
    // If this line ever goes away, the reasoning above needs re-checking.
    {
      file: `${HOME}/landing-star-preview/LandingStarPreview.styles.ts`,
      find: '&[data-font-preview="original"]',
    },
  ],
};
