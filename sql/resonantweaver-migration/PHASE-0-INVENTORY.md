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

## Open question for Gio

When a section is CLOSE to an existing catalog entry but not identical — her FAQ
against `rf-accordion`, her offer card against `rf-media-copy` — do we extend the
existing entry with new props, or add a variant? Extending keeps the catalog small
and every other tenant gains; variants are safer but multiply. Recommendation:
extend where the difference is decoration (FAQ), add an entry where the difference
is structure (the offer card's price + best-for list).
