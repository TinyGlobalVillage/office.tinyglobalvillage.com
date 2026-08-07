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

## 3 — The ruling, and the rule it produces

**Gio, 2026-08-07:** *"I want her to have a pixel perfect site from the original,
and I want generic components made from any new atoms that are needed that are
derived from her code. It's okay to have multiple types of atoms, we can always
redact them later when we do a review, but I'd rather more atoms and more
components than less. If it doesn't exist on the component library add it."*

So the target is not "port her components as hers" and it is not "stretch the
generic ones until they fit". It is: **decompose her code into atoms and
components, make those generic, and put them in the library.** Her site is
pixel-perfect because it is drawn by the real thing; the platform is richer
because the real thing is now everyone's.

> **The rule: her design is the SOURCE, never the DEFAULT.**
>
> A component derived from her code ships with platform-neutral defaults and
> theme-token colours. Her values live in her `page_models` row, explicitly.
> That is exactly what §7 rung 1 did with `rf-journey`'s `headingFont`: the
> family she authored in is the fallback, her row carries the choice, and any
> other tenant gets their own.

**Bias to MORE.** Two atoms that turn out to be one is a review finding; one
atom bent to cover two cases is a bug nobody can see. Where it is not obvious
whether something is a new atom or a variant of an existing one, **add it** and
move on. To make that safe to be generous about, every new entry records where
it came from — `derivedFrom: "resonantweaver/OfferingCard"` — so the later
review can cluster by provenance instead of by guesswork. Redaction is cheap
when the lineage is written down and expensive when it is not.

**What stops "generic" from being generic in name only.** A component derived
from one tenant and only ever seen against that tenant is that tenant's
component wearing a general name. Two checks make it checkable rather than
hopeful, and both already exist:

1. Every new catalog entry ships a **Sandbox demo using platform defaults**, not
   hers. If it only looks right in her colours, it is not done.
2. The **drift guard** added to `render-rf-sections.tsx` on 2026-08-07: strip
   every `var()` fallback from the emitted CSS and fail if a tenant literal
   survives outside one. It is what caught her palette hiding inside a shared
   `RitualButton`, and it generalises to every entry this plan adds.

---

## 3b — Architecture

### What her code actually contains (verified 2026-08-07)

Her repo already has the two layers this plan needs, which is why deriving from
it is realistic rather than aspirational.

**The atom layer she already wrote** — `src/styles/`:
`surfaces.ts` (surface treatments; `hudCardSurface` was already lifted out of it
into `@tgv/module-component-library`), `dividers.ts` (divider shapes),
`animations.ts`, `tokens.ts` (palette + serif — already handled by §7 rung 1),
`breakpoints.ts`, `GlobalStyles.ts`.

**The component layer** — 14 section components, and they map onto the 95 rows
almost exactly:

| hers | rows it should be drawing | today |
|---|---|---|
| `(home)/components/OfferingCard.tsx` | the 36 `rf-offer-card` | generic approximation |
| `components/DetailSection.tsx` | much of the 35 `rf-media-copy` | generic approximation |
| `(home)/components/HeroSection.tsx`, `components/ProductHero.tsx` | the 2 `rf-split-hero` | mirrored, wrong accent |
| `(home)/components/Testimonials.tsx` | the 2 `rf-testimonials` | generic |
| `(home)/components/FAQAccordion.tsx` | the 2 `rf-accordion` | generic |
| `(home)/components/{Intro,About,Contact}Section.tsx`, `JourneyGateway.tsx`, `CalloutBar.tsx`, `Cards.tsx` | the 10 `rf-linkbar`, the `rf-list`, the `rf-door-card` | generic |
| `components/WaitlistForm.tsx` | the 5 `form-live` | generic |
| `components/SunWalkCard.tsx` | already moved with `@tgv/module-starseed` | ported |
| `(home)/journey/**` | `rf-journey` | **ported — the one that matches** |

`OnePage.styles.ts` is the shared stylesheet underneath all of them and is where
most of the vertical rhythm lives — the 690px of missing page height is
overwhelmingly here, not in any one component.

So the real scope is roughly **14 components and 8–15 atoms**, not 95 ports.

### Where things go

Nothing new is invented; every destination already exists and has a law.

- **Atoms** → `packages/@tgv/module-core/module-component-library/atoms/`
  (`shipped.ts` + one `AtomSpec` each), surfaced in the Sandbox's **Atom
  Library** (`src/app/components/sandbox/atom-lab/`) with
  `SandboxEntry.tier: "atom"`.
- **Components** → `packages/@tgv/module-core/module-page-editor/editor/
  component-library/components/sections/<group>/<RfName>/` with the five-file
  shape every entry has (`schema.ts`, `Render.tsx`, `EditorPanel.tsx`,
  `Demo.tsx`, `README.md`), registered with `tier: "component"`.
- **The composition law holds** (project CLAUDE.md, Gio 2026-08-02): an Atom is
  solitary, a Component is a group of atoms. A thing that is one shape is an
  atom even if her code called it a section.
- **Check before creating** (`~/.claude/procedures/component-icon-check.md`) —
  the standing rule stays. It is not in tension with "bias to more": the check
  is one grep, and its answer is now "add it, record the provenance" rather than
  "bend the existing one".

### Four model gaps that block this, all verified in the code today

These are prerequisites, not discoveries to make later.

1. **`AtomSpec` has no state.** `spec.ts` carries `canvas`, `size`, `colors`,
   `effects`, `text`, `icon` — and nothing for hover, focus, selected or
   disabled. Every interactive thing she owns has a hover treatment. Needs a
   sparse `states?: { hover?, focus?, active?, selected?, disabled? }` of
   `AtomSpecPatch`, plus the matching levers in the Atomic Editor.
   **Independently confirmed today** from the other side: the atom migration
   lane stalled on exactly this for `TileButton` and `Lightswitch`, and reported
   that forcing them without it produces "a fake four-state migration in place
   of a real single-state one". So this is the model's next version, not a
   Resonant Weaver special case.
2. **`AtomSpec` has one `text` block.** Her offer card alone carries a title, a
   price, a "best for" list and a CTA — four type scales. Needs named text slots
   rather than one.
3. **`AtomSpec` has one fill and one gradient stop.** `hudCardSurface` is a
   layered gradient over an inset highlight; the two-stop linear fill cannot say
   it. Needs either layered fills or a declared escape hatch that the drift
   guard knows to skip.
4. **`SiteTheme.fonts` has two roles for her six typefaces.** Phase 1 below.
   This is also §7 rung 2, so it is owed anyway.

### How pixel-perfect is guaranteed rather than hoped

Per component, a fixed loop — and the order matters, because the last step is
the one that has been skipped every time:

1. Read her component. Extract its atoms first, spec them, land them in the Atom
   Library with a platform-default demo.
2. Build the catalog component from those atoms, generic, with neutral defaults.
3. Author her row with her explicit values.
4. **Render both, diff, iterate until under threshold.** Her component on :3003
   against the catalog one behind the Host proxy, at 1440 / 768 / 390, section
   crop not whole page.
5. Only then move to the next one.

The baseline this diffs against is already frozen in `baseline/`, so step 4 does
not depend on her app still running.

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

## Phase 1b — the four model gaps

Before any component can be derived, the model has to be able to hold it. All
four are verified against the code, not assumed — see §3b. In dependency order:

1. **`AtomSpec.states`** — sparse `AtomSpecPatch` per state, plus the Atomic
   Editor levers and a drift-guard rule that reads them. Unblocks `TileButton`
   and `Lightswitch` too, which the atom migration stalled on today, so P3
   resumes on the back of this.
2. **Named text slots** on `AtomSpec`, replacing the single `text` block.
3. **Layered fills**, or a declared escape hatch the drift guard skips by name
   rather than by silence.
4. **Font roles** — Phase 1 above.

Each lands with its own spec-version bump and a migration for the two atoms
already on the spec, so nothing published goes stale.

## Phase 3 — the components, worst-diff first

Work the fourteen in diff order, not page order, each through the five-step loop
in §3b — atoms first, then the component, then her row, then diff, then next.
One commit per component so a regression is bisectable.

Two differences are already known and are plain parameter bugs in her authored
rows rather than component work: `rf-split-hero`'s `markRight` is inverted, and
her wordmark is **copper** (`accent2`) where the entry paints `accent1`. Also
the stray `Explore` / `Learn more` CTAs her page does not have, and the `→`
glyph dropped from "Ask about access". Fix those first — they are minutes, and
they clear noise out of the differ before the real work starts.

Where a section of hers turns out to be genuinely the generic thing, keep the
generic entry and say so in the ledger. The ruling is bias-to-more, not
port-everything; a row that already matches is a row that already matches.

`OnePage.styles.ts` deserves its own pass rather than being absorbed piecemeal —
it carries the shared vertical rhythm behind all fourteen, and it is where most
of the 690px lives. Treat its spacing scale as its own atom set.

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

## The alternatives, closed

Two other answers were on the table and are now decided against by the ruling in
§3, recorded so nobody re-opens them by accident:

- **Chase the diffs** — keep the generic blocks and patch them until they match.
  Rejected: 71 of 95 sections sit in two entries, so this means bending two
  generic components until they can express a bespoke site, which is how a
  catalog rots, and it re-breaks every time either is improved for someone else.
- **Leave her standalone**, as demo-fliring is. Rejected: the point is not only
  her site. Her code is the richest source of atoms in the fleet, and pooling
  her is what converts it into library everyone draws from.

**Cost, honestly.** This is the largest of the three — days, with the component
work dominating — and it front-loads four model changes before the first
component can land. What it buys is that the result does not decay: a component
derived from her code and checked by the drift guard stays correct when the next
tenant arrives, and the atoms outlive the migration that produced them.

**Phases 0, 1, 2 and 4 are owed regardless** — the measuring stick, the type
roles, the chrome rows and the image pipeline are platform gaps that outlive
her, and every one of them was found by her site rather than by us.

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
