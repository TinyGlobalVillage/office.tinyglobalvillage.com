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
| `02-pages.sql` | **GENERATED.** Her contact form plus `home` and `writing` as `page_models` rows. |

Do not hand-edit the SQL. Change her source or `copy.mjs`, then re-run.

## Running it

```bash
cd clients/office.tinyglobalvillage.com
node sql/resonantweaver-migration/generate.mjs          # rewrite the SQL
node sql/resonantweaver-migration/generate.mjs --check  # fail if stale

psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/01-theme.sql
psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/02-pages.sql
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
- **The commerce funnel** — `/pearl-chamber` and the landing-star tree — is
  bucket B: app routes plus `SITE_SURFACES` grants. Until that lands, the Pearl
  Chamber CTA points at a path this renderer does not serve, the same knowingly
  broken link giocoelho's `/playlists` was.
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
   AND slug IN ('home', 'writing');
```

`site_releases` keeps every version the capture trigger saw, so the previous
state is recoverable from Client Versions either way.
