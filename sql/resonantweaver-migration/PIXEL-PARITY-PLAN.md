# Pixel parity for resonantweaver.com — the plan

Written 2026-08-07, the day the cutover was rolled back. Marthe's words were
*"Menu is different… images are different… buttons are different. Boxes are
different."* She was right about all four, and the check that cleared the
cutover did not look at any of them.

**Status: her own app is serving again** (`pm2` id 5, nginx restored from
`resonantweaver.com.pre-pool-2026-08-07`, verified from a cold browser). The
pooled config is kept beside it as `resonantweaver.com.pooled-2026-08-07`, so
re-cutting is one `cp` when this plan says it is ready.

---

## 1 — What actually differs, measured

Home page, 1440×900, her app on :3003 versus the pooled render, same moment:

| | her app | pooled | |
|---|---|---|---|
| page height | 6047 px | 5357 px | **−690 px, −11%** |
| sections | 11 | 11 | same count, different sizes |
| menu | Starseed · Sun Walk · Contact · Login | HOME | **3 links lost** |
| logo | `/images/Small-Logo-RW-2026.svg` | none | **missing** |
| images | 4, through `next/image` (`?url=…&w=640&q=75`) | 3, raw files | **unoptimised, one absent** |
| typefaces in the DOM | 6 — Science Gothic 24, Space Mono 18, Space Grotesk 14, Ubuntu Mono 6, Times 2, Arial 2 | 2 — Space Grotesk 57, Science Gothic 15 | **Space Mono and Ubuntu Mono never arrived** |
| hero | mark LEFT, wordmark copper on the right, copy centred | wordmark teal on the LEFT, mark right, copy left-aligned | **mirrored, recoloured, realigned** |
| buttons | `I · Door…`, `Ask about access →`, `Send Message` | adds `Explore`, `Learn more`, `— select one —▼`; drops the `→` | **set and labels differ** |
| `body` font | her stack | **Arial** | the body token is declared and never applied |

Her pooled content is **16 published pages, 2 drafts, 95 section instances**
across ten catalog types. Two entries carry three quarters of it —
`rf-offer-card` ×36 and `rf-media-copy` ×35 — then `rf-linkbar` ×10,
`form-live` ×5, `rf-accordion` ×2, `rf-testimonials` ×2, `rf-split-hero` ×2,
`rf-journey`, `rf-door-card`, `rf-list`.

Her `content_overrides` hold exactly three keys: `siteBackground`, `siteFonts`,
`theme`. **There is no `nav` row and no `footer` row.** That is not a bad value,
it is an absent one — which is the whole explanation for the menu and the logo.

---

## 2 — Why it drifted: three causes, not eleven symptoms

**A. Her site was TRANSLATED, not ported.** Twenty-three hand-coded pages were
re-authored as rows over generic catalog blocks. Translation always loses
something, and here it lost the parts of her design that the generic block has
no word for. That is why 71 of 95 sections are two entries: `rf-offer-card` and
`rf-media-copy` are doing the work of a dozen bespoke layouts.

**B. The type system is smaller than her design.** `SiteTheme.fonts` has exactly
two roles, `heading` and `body`. Her site uses four faces in anger — Science
Gothic, Space Grotesk, Space Mono, Ubuntu Mono — plus Cormorant on the journey.
Two of those were never shipped in her `siteFonts` row and two have no role to
be named by, so ~24 elements' typeface is unreachable **by construction**. The
same two-role ceiling is what CUTOVER-PLAN §7 rung 1 hit from the other side.

**C. The check that cleared it measured the wrong thing.** `tenant-parity.mjs`
compares structure: pages present, sections present, strings present, banned
platform words absent. Every one of those passed. None of them can see a
mirrored hero, a lost typeface, or 690px of missing height. **"Structurally
green" was never evidence of appearance and must stop being used as if it were.**

---

## 3 — The rule this plan runs on

> **Parameters where the difference is decoration. Her component where the
> difference is structure.**

Gio set this rule in PHASE-0 as an open question about extending versus adding
catalog entries, and the cutover answered it: extending a generic entry until it
can express a bespoke layout is how a catalog rots, and it still will not match.
The journey is the proof of the other path — `rf-journey` renders her code, and
it renders identically because it *is* her code.

So the target is not "make `rf-media-copy` able to look like her". It is: keep
the generic entry where her section genuinely is that generic thing, and port
hers where it is not. Pixel parity then holds **by construction** for the ported
ones instead of being chased.

---

## Phase 0 — the measuring stick, before a single fix

Nothing below can be trusted without this, and it is the cheapest thing here.

1. **Freeze the baseline while her app is still up.** Full-page screenshots of
   all 16 routes × {1440, 768, 390}, plus a computed-style fingerprint per
   element, captured from :3003 through the tunnel. Commit the fingerprints;
   keep the PNGs device-local. **Do this first** — the baseline disappears the
   moment somebody stops pm2 id 5, and today it nearly did.
2. **Build the pixel differ.** `scripts/tenant-pixel-parity.mjs`: baseline vs
   pooled at the same viewport, per-page and per-section-crop, output a
   percentage-of-pixels-changed plus a diff PNG. Section crops matter more than
   whole pages — one shifted band offsets everything below it and a whole-page
   number then says 60% for a single defect.
3. **Keep the style fingerprint beside it**, from `token-parity.mjs` (already
   written): a pixel diff says *that* something differs, a computed-style diff
   says *what*. Font-family, colour and box metrics are the three that explain
   almost everything.
4. **Set the gate.** A page ships when every section crop is under **0.5%**
   changed pixels at all three viewports, with a written exception list. Not
   zero — see §"What pixel-perfect cannot mean".
5. **Retire the old criterion.** `tenant-parity.mjs` grows a loud header saying
   it checks structure only and must not be used to clear a cutover alone.

**Exit:** a one-command report that ranks all 16 pages and all 95 sections by
how wrong they are. Everything after this is worked in that order.

## Phase 1 — the type system (the single biggest delta)

Four of her six DOM typefaces cannot currently be expressed. This is also §7's
rung 2, so none of it is throwaway.

1. **Grow `SiteTheme.fonts` beyond two roles** — `display`, `body`, `mono`,
   `accent`, `serif`. Type, validator, and one `--tgv-font*` pair each in
   `themeToPairs`; the theme panel that edits it grows the same rows.
2. **Ship the missing faces** in her `siteFonts` row: Space Mono and Ubuntu
   Mono, self-hosted under `/fonts/tenants/resonantweaver/` like the four
   already there.
3. **Apply the body role to `body`.** `--tgv-fontBody` is declared and only
   honoured by blocks that opt in, which is why her body text computes to
   **Arial** on a themed page. `themeToFontCss` sets the heading rule; it needs
   the body rule too.
4. **Point the catalog's type at the roles**, so a section without an explicit
   font prop inherits the site's rather than the platform's.
5. Re-run the differ. Expect this alone to move the type portion of every one of
   the 95 sections.

## Phase 2 — the chrome

Her nav and footer have **no row at all**, so this is authoring, not repair.

1. Author the `nav` override: her logo, and Starseed · Sun Walk · Contact ·
   Login with her hrefs (`/en/starseed/`, `/en/sun-walk/`, `/en/#contact`,
   `/en/login/` — note Contact is an in-page anchor, not a route).
2. Author the `footer` override from her app's footer.
3. Copy `Small-Logo-RW-2026.svg` into `public/images/tenants/resonantweaver/`
   and point the row at it.
4. Diff the chrome band alone at all three viewports before moving on — it is on
   every page, so it is 16 pages' worth of error for one fix.

## Phase 3 — the sections, worst-diff first

For each section the differ ranks, take one of three actions and record which:

- **Parameter fix** — the entry can express it and the row is wrong. The two
  already known: `rf-split-hero`'s `markRight` is inverted, and her wordmark is
  **copper** (`accent2`) where the entry paints `accent1`. Also the stray
  `Explore` / `Learn more` CTAs that her page does not have, and the `→` glyph
  dropped from "Ask about access".
- **Extend the entry** — the difference is decoration and every tenant gains.
- **Port her component** — the difference is structural. It arrives as its own
  `rf-*` entry rendering her markup, the journey pattern, with her content as
  props. Expect this for a meaningful share of the 36 `rf-offer-card` and 35
  `rf-media-copy` instances, because that concentration is itself the evidence
  that generic blocks were stretched.

Work in diff order, not in page order, and re-run the differ after each. One
commit per section or per group, so a regression is bisectable.

## Phase 4 — images

1. Restore every missing asset under `/images/tenants/resonantweaver/`.
2. **Decide the image pipeline.** Her app rendered `next/image`, so the browser
   received a resized, quality-tuned file; the catalog renders a raw `<img>`, so
   it receives the original. That is both a payload regression and a sharpness
   difference at the same box size. Either give the catalog an optimising image
   component or pre-generate sized variants — a ruling, not a detail, because it
   affects every pooled tenant.
3. Re-diff: image bands are where a percentage differ is most likely to flag a
   difference no human would notice, so tune the threshold here specifically.

## Phase 5 — the other fifteen pages

Same loop, in differ order. Expect the tail to be much cheaper than the home
page: most of what Phases 1, 2 and 4 fix is site-wide, and Phase 3's ported
components are reused across pages.

## Phase 6 — the re-cut, with a gate this time

1. Every page under threshold at all three viewports, exceptions written down.
2. **Marthe looks at it before DNS moves**, on a shareable preview of the pooled
   render — not after. She found in a minute what the tooling missed entirely,
   and that is the strongest check available.
3. Flip nginx (`cp` the kept `.pooled-2026-08-07` config back), reload, verify
   live from a cold browser, and **leave her app running for a week** rather
   than stopping it at the flip.
4. Only then `pm2 stop`, and only after a second look.

---

## What pixel-perfect cannot mean

Set the expectation honestly and in writing:

- **Font rasterisation.** Her app loads faces through `next/font`'s build-time
  transform; the pooled renderer loads them as self-hosted `@font-face`. Metrics
  match, hinting and fallback timing may not, so sub-pixel differences on text
  edges are expected and are not defects.
- **Anything genuinely dynamic** — the sun walk's current week, the particle
  field, anything with a timestamp — must be masked in the differ rather than
  chased.
- **The threshold is 0.5%, not 0.** A differ that demands zero gets muted, and a
  muted differ is worse than none.

## The two cheaper answers, stated plainly

The plan above is real work — I would estimate **days, not hours**, with Phase 3
carrying most of it — and every future catalog change re-opens the question.
Both alternatives deserve a decision rather than a drift:

1. **Port her components wholesale** instead of section-by-section — the journey
   model applied to the whole site. Appearance becomes identical by construction
   rather than by chasing diffs, and she still gets editable content rows.
   Slower to start, far cheaper to hold, and it is the same ladder §7 already
   climbs.
2. **Leave her standalone.** Resonant Weaver is the most hand-built site in the
   fleet, and demo-fliring was already exempted on exactly this reasoning —
   pooling costs its visual identity, which is what the asset is for. Nothing
   about the platform requires her to be pooled today.

**Recommendation: 1**, with this plan's Phases 0, 1, 2 and 4 done regardless —
the measuring stick, the type roles, the chrome and the image pipeline are all
platform gaps that outlive her, and every one of them was found by her site.

---

## And fix the rollback itself

It nearly did not work when it was needed, which is the only time it matters.

- **`pm2 start resonantweaver.com` fails on this box** — pm2 read the name as a
  file path and answered *"Script not found:
  /srv/refusion-core/clients/resonantweaver.com/resonantweaver.com"*, then
  created a second, errored app called `resonantweaver` pointing at
  `/home/admin/resonantweaver.com`. `pm2 start 5` (the id) worked immediately.
  The stray entry has been deleted and `pm2 save` run.
- The rollback comment inside every pooled nginx config says `pm2 start <name>`.
  **Correct it in all of them**, giocoelho's and refusionist's included, and say
  to use the id.
- Sibling, already open: 🔴 S1 `mac-deploy-rollback-serves-a-mixed-build`. A
  rollback path that is never exercised is a rollback path that does not exist —
  both of these should be rehearsed on a schedule, not discovered in an
  incident.
