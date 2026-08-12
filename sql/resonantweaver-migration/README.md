# resonantweaver.com → the platform

Phase 0's inventory is `PHASE-0-INVENTORY.md`; the plan of record is
`~/.claude/plans/generic-popping-sunset.md`. This file is the runbook for what
Phase 3 built. **What is still LEFT — bucket B, the signups, the ten API routes,
parity and the cutover — is `CUTOVER-PLAN.md`**, in the order it has to happen.

## What is here

| File | What it is |
|---|---|
| `copy.mjs` | The prose, the orbs, the radii and the asset map that are NOT in her `src/data/*` — transcribed once, and checked back against her source on every run. |
| `generate.mjs` | Reads her data modules and emits the two SQL files. `--check` fails if they are stale. |
| `01-theme.sql` | **GENERATED.** Her palette, type, radii, the two ambient orbs, and the Cormorant Garamond faces. Three `content_overrides` rows. |
| `02-pages.sql` | **GENERATED.** Her contact form plus `home`, `home-classic` and `writing` as `page_models` rows. |
| `03-journey-preview.sql` | **GENERATED.** The journey as an `rf-journey` section at slug `journey-preview`, so it could be driven beside the package still serving `/journey`. |
| `04-journey-row.sql` | The journey takes its real URL, once the preview matched. |
| `05-journey-signups.sql` | **HAND-WRITTEN.** `public.journey_signups` + her 2 rows, forced onto her site key. The one part of her funnel that is an application, not content — see CUTOVER-PLAN §2. |

Do not hand-edit the SQL. Change her source or `copy.mjs`, then re-run.

## Running it

```bash
cd clients/office.tinyglobalvillage.com
node sql/resonantweaver-migration/generate.mjs          # rewrite the SQL
node sql/resonantweaver-migration/generate.mjs --check  # fail if stale

psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/01-theme.sql
psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/02-pages.sql
psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/03-journey-preview.sql
psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/04-journey-row.sql

# 05 reads the `resonantweaver` schema, which tgv_app cannot. Run it as the
# superuser, and RUN IT AGAIN AT CUTOVER to pick up any signup taken while her
# app was still answering on :3003.
sudo -u postgres psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/05-journey-signups.sql
```

Both files are re-runnable: every insert is guarded by a null-safe
`NOT EXISTS` on the tuple the unique index names, and both end in assertions
that refuse to commit if the result is not what the file claims.

`RW_ROOT` and `HQ_ROOT` override where the generator looks for her checkout and
HQ's `public/`. Both default to siblings of this repo.

## Why a generator

Her content was already data. `src/data/{home,writing,i18n}` holds the
offerings, the testimonials, the FAQ, the writing entries and the whole contact
dictionary as typed objects, because she separated content from presentation
years ago. Importing them is what makes the first render identical *by
construction* rather than by proofreading — giocoelho's and refusionist's pages
were typed by hand and both needed a browser to find what the typing lost.

Three things the generator does that a transcription cannot:

- **It reproduces the runtime filter.** `onePage.tsx` hides any offering flagged
  `hidden`, collapses a two-up row that lost an item, and drops a row that lost
  both. Two of her five rows are affected today — the generated stack is what a
  visitor sees, not what the data file contains.
- **It guards every transcription.** Anything written inline in her JSX lives in
  `copy.mjs` and is searched for in the file it came from, with whitespace
  collapsed and entities unescaped the way JSX renders them. If she edits a
  tagline in her repo, the generator refuses to emit and names the string.
- **It refuses an unmapped asset.** Every `/images/*` path she wrote resolves
  against *her* app; each one is routed through an explicit map to
  `/images/tenants/resonantweaver/`, and a path with no entry is an error rather
  than a 404 found in a browser later.
- **It checks which component each route renders** (`ROUTES` + `guardRoutes`).
  The three guards above all ask whether a STRING still says what we
  transcribed. None of them asked the prior question — whether the page being
  read is still the page that route serves — and that is the one that was
  wrong: `(home)/page.tsx` swapped to the star landing on 2026-07-30 and this
  generator kept reading `onePage.tsx`, emitting her ARCHIVED landing as `home`
  with every check passing, because each string was still true of the file it
  named. A guard can be thorough one level below the mistake.

## What it found

- **`/images/LeafOscilator-Logo4.png` does not exist.** The second writing entry
  names it as a cover; there is no such file in her repo, so that card is broken
  on her live site today. It is deliberately absent from the asset map, so the
  card comes across with no cover rather than with a 404 — visible, and fillable
  in the studio.
- **Her background colour was never missing.** Phase 1 deferred her theme row
  because `tokens.ts` has no background. It is the first declaration in
  `OnePage.styles.ts`'s `Body`: `hsl(165, 60%, 6%)`, i.e. `#061814`.
- **Two of her roles are alphas, and the theme is hex-only.** `--text-muted` is
  bone at 65% and the one flat panel colour she has is `rgba(4, 20, 19, .9)`,
  both over that ground. They are flattened here — `#999d95` and `#041413` —
  which is what a browser paints for those pixels anyway.
- **Naming a font never loaded one.** See below.

## The font row, and why it is new

`SiteTheme.fonts` could always say `'Cormorant Garamond', Georgia, serif`. On
her own app the face arrived through a Google Fonts `@import` in
`src/styles/journey.css` — a file that does not travel with her pages. Pooling
her site without a face would have rendered a serif site end to end in Georgia,
with every colour, size and word correct.

So Phase 3 added `siteFonts`: a site-scoped override, a validated reader and a
`<style>` emitter, sibling to `siteBackground` in every respect including the
no-platform-rung rule. The faces are self-hosted under
`clients/tinyglobalvillage.com/public/fonts/tenants/resonantweaver/` (Cormorant
Garamond is SIL OFL). One file per style, not per weight — it is a variable font
and Google serves the same woff2 for 300 and 400.

## What is NOT here

- **The journey** (`/journey` and its canvas blocks) and the **starseed
  surfaces** move as packages in Phase 4. The gateway's words and its link are
  authored now; its seven chakra dots come with the package.
- **The rest of the commerce funnel** — `/pearl-chamber`, `/starseed`,
  `/open-your-journey` and the landing-star tree BELOW its hub (the gateway
  pages, the offer detail pages, all-products, the course). Bucket B, per
  `CUTOVER-PLAN.md` §1. Until it lands, the two featured CTAs on the hub point
  at `/landing-star-preview/offer/…`, which this renderer does not serve — the
  same knowingly broken link giocoelho's `/playlists` was.

  The hub ITSELF is here, as `home`: `(home)/page.tsx` renders
  `LandingStarPreview`, so her front door is bucket A's page whichever bucket
  the tree under it belongs to.
- **`ContactForm.tsx`** is not ported. The contact section is a `form-live`
  pointing at a `public.forms` row this migration creates from her own
  dictionary, so submissions land in her Forms inbox behind the anti-abuse
  engine. Two forms collecting the same fields would be the
  duplicate-but-different pair that starts drift.

## Order

`01-theme.sql` then `02-pages.sql`. Neither depends on the other at the SQL
level, but a page rendered before its theme exists is her content in the
platform's colours, which is a confusing thing to look at.

The routing key (`villager_sites.subdomain = 'resonantweaver'`) is already set —
it is what makes the custom-domain branch resolve at all, and setting it is what
made any of this testable. nginx still sends resonantweaver.com to her own app,
so nothing that serves traffic has moved.

## Re-authoring a page

`02-pages.sql` INSERTs and never UPDATEs, on purpose: after cutover the studio
owns those rows and a migration that overwrote them would delete Marthe's work.
While the migration is still being tuned — Phase 5 parity, mostly — the recipe
is to drop the row and re-run:

```sql
DELETE FROM public.page_models
 WHERE site = 'resonantweaver' AND mode = 'published' AND user_id IS NULL
   AND slug IN ('home', 'home-classic', 'writing');
```

`site_releases` keeps every version the capture trigger saw, so the previous
state is recoverable from Client Versions either way.

**Name the slugs. Do NOT delete the whole site.** `journey` is authored by
`03`/`04`/`09`, not by `02` — and `02` asserts it is present, so a
`DELETE … WHERE site = 'resonantweaver'` leaves the file aborting on

    assert: the journey row is gone — replay 03, then 04, then 09 (found 0)

with the delete already committed. The assertion says exactly what to do and
the three files are idempotent, so the recovery is to run them in that order
and then re-run `02` — but the whole trip is avoided by listing the slugs.
(2026-08-11, the footer-ground redrive.)
