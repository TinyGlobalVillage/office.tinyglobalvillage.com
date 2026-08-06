# resonantweaver.com → the platform — Phase 0 inventory

> Gio's brief, 2026-08-05: migrate her content pages fully and **pixel-perfect**;
> cross-reference what atoms and components already exist against what has to be
> built; strip colour choices so components default to the TGV theme, and backfill
> her colours, fonts and sizings as data so her site renders unchanged; end state
> is that she can open the editor on pages she already designed. **What we
> implement here is the same thing we implement for demo-fliring.**

This file is the artefact Phase 1–4 work from. It is an inventory, not a plan of
record — the plan lives in `~/.claude/plans/generic-popping-sunset.md`.

## The three findings that shape everything

**1. Her identity is six lines.** `src/styles/tokens.ts` is the whole palette:

```
COPPER  = 183, 138, 119   # b78a77, primary
TEAL    =  72, 210, 185   # 48D2B9, accent
BONE    = 232, 229, 218   # text
PHTHALO =   0,  15, 137   # deep blue, the writing page only
SERIF   = 'Cormorant Garamond', Georgia, serif
```

Plus `breakpoints.ts` (7 stops), `surfaces.ts` (`accentRgb` / `background` /
`margin`), `dividers.ts`, `animations.ts`. That is the entire backfill payload.
Strip-and-backfill is therefore cheap: the components ship referencing
`var(--site-*)`, and one row per site restores the look.

**2. Her content is already data.** `src/data/{home,journey,offers,writing}` holds
typed objects — `faq.ts`, `offerings.ts`, `testimonials.ts`, `chakraSections.ts`,
`recommendations.ts`, `offers.ts`, `articles.ts`. These map to `page_models`
section config nearly one-to-one. She separated content from presentation years
ago, which is why this is tractable at all.

**3. All of her marketing styling is in ONE file.** `OnePage.styles.ts` — 1,061
lines, **64 exported styled parts** — and her section components are pure
composition over it (`HeroSection.tsx` is 42 lines of JSX importing `Hero`,
`SymbolWrap`, `H1`, `Tagline`). So the cross-reference below is a read of one
file, not of 39.

> Worth knowing: `onePage.tsx` already ships a `FontPreviewSwitch` that toggles
> `data-font-preview="shared" | "original"`. Somebody has already been comparing
> her fonts against the platform's. That switch is a ready-made parity harness.

## Four buckets, and only one of them is "content pages"

| Bucket | What | Lines | How it migrates |
|---|---|---|---|
| **A — marketing content** | home (hero, intro, offerings, testimonials, FAQ, about, contact), writing | ~1,400 | **Catalog sections + `page_models` rows.** This is the pixel-perfect work. |
| **B — commerce funnel** | `landing-star-preview` tree (gateway, course, product, all-products, offer, waitlist), pearl-chamber | ~1,150 | Mostly **app routes** → `SITE_SURFACES` grants. `offers.ts` is data; the shells are commerce. |
| **C — the journey experience** | `journey/*` + `journey/blocks/*` (ParticleCanvas 306, ToroidalFieldCanvas 250, BreathOrb, ResonanceNodes, WatercolorLayer, ClosingSection 408, JourneyNav 260, JourneySection 289) | ~2,300 | **Move as a package, not as rows.** Canvas and scroll-driven motion is not catalog material; re-authoring it loses it. |
| **D — starseed surfaces** | `sun-walk` (797 + CalendarModal 422), `galacticfieldguide/*` (~1,270), `starseed/*` (657) | ~3,150 | **Already engine-adjacent** — `@tgv/module-starseed` shipped 2026-08-04. These are its UI → package + `SITE_SURFACES` grants, the pattern proven twice for refusionist. |

Platform surfaces (`dashboard/*`, `editor/*`, `login/*`, `cart`, `meet/*`) are
already shared and need nothing.

**The consequence for "pixel-perfect":** you get it on C and D by MOVING the
components, and on A by mapping to catalog entries and backfilling tokens. Only
bucket A is re-expressed as data; the rest travels as code.

## Bucket A cross-reference — the 64 parts against the 12 catalog types

The renderer knows `rf-accordion`, `rf-chev`, `rf-embed`, `rf-hero`,
`rf-hotspots`, `rf-linkbar`, `rf-list`, `rf-mc-copy`, `rf-mc-media`,
`rf-media-copy`, `rf-schedule`, `rf-steps`.

| Her section | Her parts | Existing? | Gap |
|---|---|---|---|
| **Hero** | Hero, HeroText, HeroRule, SymbolWrap, SymbolGlow, SymbolImage, HeroEyebrow, H1, Tagline | `rf-hero` | eyebrow, a rule divider, and a glowing SVG symbol behind the wordmark. Props, probably — plus the split-wordmark `H1` (`wordmark-initial` / `wordmark-break`), which is a **new atom**. |
| **Intro** | IntroSection, Intro | `rf-mc-copy` | none expected |
| **Offerings** | GridSection, OfferingsStack, OfferingsRow, OfferCard, FeatureCardInner, CompactMediaFeatureCardInner, FeatureLead(+ImageWrap/Image), FeatureDetail, FeatureContent, OfferMedia(+Image), CardHead, Sub, CardBody, P, Best, BestLabel, BestList, CardFoot, Price | `rf-media-copy` / `rf-mc-media` | **the biggest gap.** Two card variants (full + compact-media), a "best for" list, and a price foot. Likely one new catalog entry (`rf-offer-card`) rather than stretching `rf-media-copy`. |
| **Testimonials** | TestimonialsBand, TestimonialKicker, TestimonialGrid, TestimonialCard, TestimonialQuoteMark, TestimonialText, TestimonialAttribution | — | **NEW.** Check `@tgv/module-reviews` first: it owns testimonials data and may already have a display section worth reusing rather than duplicating. |
| **FAQ** | FAQSection, FAQHead, FAQIntro, FAQPanel, FAQItemRow, FAQDetails, FAQSummaryButton, Chevron, FAQContentOuter, FAQContentInner | `rf-accordion` + `rf-chev` | animated outer/inner height transition. Probably a prop on the existing entry. |
| **About** | AboutSection, AboutInner, AboutPhotoWrap, AboutPhoto, AboutText | `rf-media-copy` | none expected |
| **Contact** | ContactSection + `ContactForm.tsx` (219) | forms module | wire to `@tgv/module-forms`, don't port the form |
| **Page decor** | Body, Main, Container, OrbA, OrbB | — | **NEW.** Two blurred colour orbs behind the page. Same class as giocoelho's `siteBackground` — a site-scoped backdrop, not a section. |
| **Writing** | `WritingPage.tsx` (107) + `articles.ts` | `rf-list` | none expected |

**Atoms to check before building any of it** (the component-icon rule): the
split-wordmark `H1`, `Chevron`, `RitualButton` (131 lines — her CTA), `Price`,
`BestList`. Each may already exist in the Atom Library; each that does not is an
`AtomSpec` entry, not a bespoke file.

**Score:** of nine section families, **five map onto existing catalog entries**
(hero, intro, about, FAQ, writing) with prop extensions, **two are genuinely new**
(offer card, testimonials band), **one is a backdrop** (orbs), and **one is the
forms module**. That is a small list.

## The one thing Phase 1 has to build

A **per-site design-token row**. Today HQ has exactly one site-scoped visual
override — `siteBackground`, built for giocoelho — and nothing general. Phase 1
generalises it: colours, font stacks and a size scale stored per site, emitted as
CSS custom properties on the tenant root, so a catalog component can say
`var(--site-accent)` and never a hex. Her four colours and one serif are the first
row; demo-fliring's neon is the second.

## The conversion track — "bespoke" is a starting position, not a category

Gio, 2026-08-05: *"can we fold onto the checklist to convert all of that code into
captured canon?"* Yes, and it corrects the framing above. Saying a component
"travels as code" reads as permanent, and it should not be. Every bespoke
component has a **level**, and the level is expected to climb.

| Level | What it means | What she can do |
|---|---|---|
| **L0 · Ported** | Lives in a package, mounted on her host. Renders identically. | Nothing new. |
| **L1 · Content freed** | Its words, images and ordering are a `page_models` section config instead of a source file. | Rewrite copy, reorder stops, swap images. |
| **L2 · Parameters declared** | The component declares its editable surface — name, type, range — the way an `AtomSpec` does. | Tune it, within bounds that cannot break a frame. |
| **L3 · Choreography wired** | Its drivers and targets are config: scrubbable, previewable. | Rewire what drives what. |
| **L4 · Canon** | A catalog entry any tenant can drop on a page, theme-neutral, in the Sandbox. | Not hers any more — the platform's. |

A component climbs one rung at a time; nothing has to convert all at once. L3 → L4
is a real gap and not automatic: a thing can be fully editable *for her* long
before it is general enough for anyone else.

**Starting levels from this inventory.** Bucket A lands at **L1 on arrival** —
her content is already typed data — and targets L4. Bucket C (journey) starts at
**L0**, reaches L1 cheaply via `chakraSections.ts`, and L2/L3 are exactly the
Canvas Mode work in `docs/artifacts/canvas-mode-parameters-and-choreography.html`.
Bucket D (starseed) starts **L0**; L4 is questionable for an engine UI and should
not be assumed. Bucket B is routes plus `offers.ts`, so **L0/L1**.

Record the level per component when each moves, so the queue is visible rather
than remembered.

## The ordered moves

1. **Set the routing key** — `villager_sites.subdomain = 'resonantweaver'`. It is
   NULL today, exactly as refusionist's was, and the custom-domain branch is gated
   on it. Nothing routes until this is set, and setting it is what makes the rest
   testable.
2. **Phase 1 — per-site design tokens.** Generalise the one site-scoped override we
   have (`siteBackground`) into colours, font stacks and a size scale, emitted as
   CSS custom properties on the tenant root. Her four colours and one serif are row
   one; demo-fliring's neon is row two.
3. **Phase 2 — the catalog gap.** Two new entries (her offer card with its price
   and "best for" list; the testimonials band) plus the orbs backdrop. Extend
   `rf-hero` and `rf-accordion` where the difference is decoration. Check the Atom
   Library first for the split wordmark, chevron, price and CTA button.
4. **Phase 3 — author bucket A as rows**, GENERATED from `src/data/*` rather than
   retyped. Generated is what makes the first render identical by construction.
5. **Phase 4 — move buckets C and D** as packages plus `SITE_SURFACES` grants, the
   pattern proven twice for refusionist.
6. **Phase 5 — parity.** Screenshot every page standalone vs pooled at three
   viewports and diff. Her existing `FontPreviewSwitch` is a ready-made harness.
7. **Cutover** — nginx and pm2, same shape as refusionist's.
8. **Then the conversion track** — each component's level onto the checklist, and
   climb.

## Phase 2 — built 2026-08-05, and what it corrected

Three new catalog entries, one shared CTA variant, one site-level backdrop
feature, and five additive props on `rf-accordion`. Everything is colour-neutral:
each section derives every value from its four surface roles with `color-mix`, so
an unthemed drop keeps the platform's tokens and her palette arrives as data.
Type follows the same rule — `headingFont` / `bodyFont` default to
`--tgv-fontHeading` / `--tgv-fontBody`.

| Built | Where | Covers |
|---|---|---|
| `rf-split-hero` | `sections/banners/RfSplitHero/` | her hero |
| `rf-offer-card` | `sections/storytelling/RfOfferCard/` | offerings **and** about |
| `rf-testimonials` | `sections/storytelling/RfTestimonials/` | the band between rows |
| `RfCta` variant `ritual` | `shared/refusion.tsx` | her CTA, in every card foot |
| `siteBackground.orbs` | `overrideTypes` + `SiteBackdrop` + `readSiteBackground` | the page's ambient orbs |
| 5 props on `rf-accordion` | `look` · `centeredHead` · `ruleUnderHead` · `animate` · `exclusive` | her FAQ |

**Four corrections to the cross-reference above.**

1. **Her hero does NOT map onto `rf-hero`.** `rf-hero` *is* its background image
   — a full-bleed cover, a scrim, copy in the lower-left. Hers has no background
   image at all: it is a two-column grid with a mark on one side and a rule-led
   text column on the other, and every element is positioned by that grid. A
   `layout` switch would share the prop names and none of the CSS. So it is a
   sibling entry, not a mode. Five families mapping onto existing entries was
   four.
2. **About and Offerings are the same component.** `AboutSection.tsx` is
   literally an offerings row holding one compact-media feature card. So the
   about panel is a `rf-offer-card` item with no price, not an `rf-media-copy` —
   one entry fewer than the table above expects, and one variant more.
3. **The `RitualButton` was the atom in the pile.** Checked against the Atom
   Library first, per the rule: her chevron, price and "best for" list are
   internals of the two new sections, not free-standing atoms, but her CTA is a
   real button variant — a quiet plate with a four-point spark either side that
   turns once on hover. It became `RfCta`'s fourth variant so every rf-* section
   gains it. The spark matches the Atom Library's own built-in glyph in intent;
   it is re-declared in `shared/refusion.tsx` because that one lives in Office's
   source, which a package cannot import.
4. **`story-testimonials` was checked and is a different shape.** Heading-led,
   left-aligned, fixed three-column. Hers carries no heading and sits *between*
   sections. Reasoning is recorded in `RfTestimonials/schema.ts` so the next
   person does not re-litigate it.

**And her background colour is not missing after all.** Phase 1 deferred writing
her theme row because `tokens.ts` has no background or surface value. It is in
`OnePage.styles.ts` instead — `--background: hsl(165, 60%, 6%)`, i.e. `#061814`.
Her muted text is `rgba(BONE, 0.65)` over that ground, which the theme's
hex-only validator cannot take as-is; both get settled against real pages in
Phase 3 rather than guessed here.

**Verified by rendering, not by typechecking.**
`packages/@tgv/module-core/module-page-editor/scripts/render-check.sh` —
69 assertions, server-rendering every new section and the backdrop and reading
the emitted HTML and CSS. It exists because `tsc` proves a section compiles and
proves nothing about whether it renders; styled-components fails at runtime. It
earned its keep immediately: a split hero with no mark put its words in the
220px lane meant for the artwork, which no typecheck could see. It also holds
the line on `rf-accordion` — that the default is still native
`<details>`/`<summary>`, adds no button, and adds no wrapper around the head —
so the pages already using it cannot drift.

The browser pass against her live site is Phase 5's job and needs Phase 3's rows
to have something to look at.

## Phase 3 — built, applied and rendered 2026-08-05

Bucket A is rows. `home` (12 sections) and `writing` (2), her palette, type,
radii and orbs as three `content_overrides` rows, and her contact form as a
real `public.forms` row — all **generated** by `generate.mjs`, which imports her
`src/data/*` instead of retyping it. Runbook and the full rationale live in this
directory's `README.md`.

**The generator is the deliverable, not the SQL.** Three things it does that a
transcription cannot: it reproduces `onePage.tsx`'s runtime filter (hidden
offerings, a two-up row collapsing to one, a row dropping out — two of her five
rows are affected, so the stack is what a visitor sees rather than what the data
file contains); it checks every string transcribed out of her JSX back against
the file it came from and refuses to emit on a mismatch; and it refuses an asset
path with no mapping, which is how it found that
`/images/LeafOscilator-Logo4.png` **does not exist in her repo** — that writing
card's cover is broken on her live site today.

**Testing the guard found a hole in the guard.** Half the checks (the orbs, the
radii, the ground colour) run inside the theme builder, which ran *after* the
drift gate. A tampered orb duration sailed through. Both bodies are built before
the gate now.

**Four defects the browser found, three of them fleet-wide and live.**

1. **Naming a font never loaded one.** `SiteTheme.fonts` could always say
   `'Cormorant Garamond', Georgia, serif`; nothing on the shared renderer had
   ever loaded a tenant's face. Her site would have come up in Georgia with
   every colour, size and word correct. New `siteFonts` override + reader +
   emitter, sibling to `siteBackground` including the no-platform-rung rule;
   faces self-hosted under `public/fonts/tenants/<site>/` (SIL OFL).
2. **And declaring the family is not applying it.** `--tgv-fontHeading` /
   `--tgv-fontBody` were emitted and only the blocks that explicitly read them
   obeyed — so her wordmark came up in Cormorant and every heading under it in
   Inter. `themeToFontCss(theme, scope)` applies them, scoped, and only when a
   theme names a family. One site names one today.
3. **`amber` was the one surface role a theme could not reach.** Its fallback
   was a bare `#ffb454` where its three siblings are tokens. It resolves through
   `--tgv-gold` now.
4. **A customer's submit button was TGV's brand cyan.** The form renderer's
   accent fallback was a literal too, and a form has three ways to be coloured,
   none of which consulted the site theme. It reads `--tgv-cyan` first now.

Plus one that is only ever visible as a gap: **rf-media-copy rendered an empty
`<h2>` for an empty heading** — a heading-sized box with 16px of margin. Three
published rows carry a blank heading today and each had been showing it. Fixing
it is what let her journey gateway be authored as what it actually is: an
eyebrow and two paragraphs, not a heading, because her `Question` is a centred
italic `<p>` and rendering it as an 800-weight `<h2>` put the only bold text on
the page there.

**Verified by rendering, twice.** `render-check.sh` is 95 assertions (was 69);
the pages were then driven in a real browser behind a Host-rewriting proxy
against the deployed HQ, with resonantweaver.com untouched on its own app. Both
Cormorant faces report `loaded`, the ground is `#061814`, both orbs drift, all
four images resolve, every CTA is her teal on a quiet plate, zero console
messages. giocoelho, guardians, nevlo, refusionist and the apex re-shot green on
the same pass and carry **no** font rule and **no** `@font-face`, which is the
whole point of the no-platform-rung rule.

**Deployed** — `cca86f92` → `81cfc8b3` (mono) and `71a1fe67` (HQ), RCS did zero
app builds. **Not cut over**: nginx still sends resonantweaver.com to her own
app, so rollback is nothing at all.

**Two things seen while verifying, neither caused by this phase.** Her tenant nav
carries only `HOME` (the nav dict is a separate row, and giocoelho had the same
gap at cutover), and the writing card's cover is cropped by the media column
where her own page ran it full-bleed behind a scrim. Both are studio-editable and
belong to Phase 5's parity pass.

## Phase 4 — the packages, built and mounted 2026-08-05

Bucket C became `@tgv/module-journey`; bucket D's public surfaces joined
`@tgv/module-starseed`; three thin HQ routes mount them behind
`SITE_SURFACES`. Commits `726fae63` + `119f591e` + `8a1f161b` (mono),
`ce0e6248` + `fccdbf56` (HQ). Deployed and driven in a browser.

| Surface | Package | Route |
|---|---|---|
| The Starwoven Journey | `@tgv/module-journey/experience` | `/journey` |
| The Sun Walk perpetual calendar | `@tgv/module-starseed/sunwalk` | `/sun-walk` |
| The Galactic Field Guide | `@tgv/module-starseed/fieldguide` | `/galactic-field-guide` |

Both packages land at **L0** and every file that had to bake something in says
so — `journey/tokens.ts` and `starseed/ui/tokens.ts` are byte copies of her
palette rather than `var(--site-*)`, because the components interpolate them
into `rgba()` a few hundred times and `rgba()` takes three numbers. Turning that
into `color-mix` is the L1→L2 work, and it has to be done against screenshots
rather than in the same commit as a file move.

**Three seams the move had to cut, each because a package cannot own what an app
owns.**

1. **The fonts.** The field guide's four families came across as a `next/font`
   module, and `next/font` is a build-time transform Next applies to the code IT
   compiles — a prebuilt `dist/` calling `Space_Grotesk({...})` throws. The font
   module stays in the host (`src/lib/fonts/galactic-field-guide/`) and the class
   string arrives as one prop. The components already read `--gfg-font-*` rather
   than family names, so that string is the whole seam.
2. **The price.** The oracle content read the Starwoven Journey's price live out
   of her offer catalogue, which is bucket B. `withPrice()` takes it from the
   host instead.
3. **The signups.** Raw `sql` on an injected executor with a BARE table name,
   the shape `@tgv/module-cospro` proved: it resolves through the caller's
   `search_path`, so one reader serves `resonantweaver.journey_signups` on her
   standalone app and `public.journey_signups` on the platform.

**A correction to the bucket table above.** `/starseed` — the Starseed Oracle
page — is listed under bucket D and is not: `StarseedOraclePage.styles.ts` is
built on `landing-star-preview/LandingStarPreview.styles`, which is built on
`OnePage.styles`. Moving it now would drag ~1,600 lines of bucket B and of the
marketing stylesheet Phase 3 replaced into a package to serve one page. **It
moves with bucket B.**

**Verified in a browser** behind the Host proxy against the live deploy: the
journey renders The Seven Gates with its particle field and the seven chakra
dots; the sun walk renders the perpetual calendar on the correct current week;
the field guide renders the stellar registry and the constellation chart, and
selecting Lyra folds the chart to Vega and opens the dossier with both plates.
Zero console messages. The gate holds on the live domains — all three 404 on the
apex, giocoelho, guardianstuffies and refusionist. Full fleet green.

**The plates were a browser-only find**, like every asset defect in this
migration: the field guide rendered perfectly and threw two 404s, because the six
dossier photographs live in her app's `public/` and a package does not carry
them. They sit at the fleet-wide `/images/galacticfieldguide/` rather than under
`/images/tenants/` — they are the codex's own illustrations, identical for anyone
ever granted the surface, not a customer's photographs — and were re-encoded from
20 MB of PNG to 2.9 MB of JPEG at 1400px.

**Still ahead in Phase 4.** `/open-your-journey` and the `journey_signups` table
(2 rows, in her own schema, needing a `site` key in `public`); rewiring HER app
onto the two packages, which is what proves the extraction from the other side;
and `/starseed` with bucket B.

**Worth recording: the fleet went down mid-phase and it was not this work.**
Every app restarted at once, load hit 66, and the public sites 502'd for about a
minute while ~15 Next processes booted together. Nothing had been deployed for
twenty minutes at that point. Two things made it hard to see: the Mac's mesh
route to RCS dropped at the same moment, and the Secretive SSH agent refused to
sign — so `ssh rcs` failed while `ssh rcs-direct` (the public IP, plain key)
worked. `mac-deploy` takes `RCS_HOST=rcs-direct`, which is the way through.

## Open question for Gio

When a section is CLOSE to an existing catalog entry but not identical — her FAQ
against `rf-accordion`, her offer card against `rf-media-copy` — do we extend the
existing entry with new props, or add a variant? Extending keeps the catalog small
and every other tenant gains; variants are safer but multiply. Recommendation:
extend where the difference is decoration (FAQ), add an entry where the difference
is structure (the offer card's price + best-for list).
