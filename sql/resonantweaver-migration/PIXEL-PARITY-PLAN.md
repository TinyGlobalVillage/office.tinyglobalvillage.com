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

## Phase 0 — the measuring stick, before a single fix — **DONE 2026-08-07**

Nothing below can be trusted without this, and it is the cheapest thing here.

> **Shipped.** `clients/tinyglobalvillage.com/scripts/tenant-baseline.mjs` and
> `tenant-pixel-parity.mjs`, over `scripts/lib/{browser,measure,pixeldiff}.mjs`.
> The baseline is re-frozen at **23 routes × 3 viewports = 69 captures**
> (`baseline/her-app-2026-08-07-v2.tgz`), and `tenant-parity.mjs` now opens with
> a box saying it checks structure only and must not clear a cutover alone.
>
> **The measuring stick was itself measured.** Two captures of her app taken
> minutes apart were diffed against each other: **23/23 PASS**, worst residual
> 0.11%, every computed style identical. A differ that cannot return PASS on a
> page against itself cannot be believed when it returns FAIL on anything else.
>
> **Four things that pass found, which is why it ran before any fix:**
> 1. **The first freeze was missing five of her pages** — 18 captured, 23 served.
>    Absent: `/open-your-journey/`, `/landing-star-preview/course/` and the three
>    `/experience/` pages. A baseline missing a page cannot fail on it.
> 2. **Her app hides the default locale** — `/en/starseed/` 307s to `/starseed/`.
>    Phase 2 below lists her nav hrefs WITH the `/en/` prefix; authored that way
>    every nav click costs a redirect hop. Corrected there.
> 3. **Animations are frozen, not masked.** Pearl Chamber's rotating mandala and
>    glowing title made that page differ from ITSELF by 2.11%. The reflex is a
>    mask; a mask is a band nobody checks, so the day the mandala fails to render
>    pooled it would still say PASS. Every keyframe animation is driven to its
>    end state on both sides instead. `--mask` survives for JS-driven motion,
>    which CSS cannot freeze, and every mask is recorded in the manifest.
> 4. **Bands, not pages, and the descent has to find them.** A first cut took the
>    children of `<main>` and got ONE band the size of the whole page, because on
>    this fleet `main` holds a single wrapper. Whole-page diffing is the trap this
>    phase exists to avoid — one band that grew 40px shifts everything below it
>    and the page scores 60% for one defect. It descends to where the page
>    branches now, and keeps the best node it saw rather than wherever it stopped,
>    because an unguarded walk down a single-child chain ends at a leaf and
>    reports zero bands — which is not "nothing to compare", it is going blind.
>
> Also fixed on the way: the Playwright resolver picked the first installation it
> found, and this Mac has three — one of them an alpha pinned to a chromium
> revision that is not downloaded. It ranks by whether the browser is actually on
> disk now.

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

### The exit report — 2026-08-07, 1440px, live HQ behind the Host proxy

All 23 routes answered 200 pooled; nothing was skipped. **Twenty of 23 pages
have at least one band at 100%.** The three that do not are the whole tail:

| | worst band | bands over gate | height |
|---|---|---|---|
| `sun-walk` | 25.3% | 14/14 | +330px |
| `landing-star-preview/course` | 11.9% | 6/6 | −16px |
| `open-your-journey` | 7.0% | 2/2 | −28px |

Those three are the ones already drawn by ported code — sun walk by
`@tgv/module-starseed`, and they are the shape everything else has to reach.
Every other page is a rebuild, not a repair, exactly as §2's cause A predicted.

**What the report says about the home page, in its own words** — these are the
first four items of Phase 3's queue and none of them needed a human to notice:

- the eyebrow *"galactic bridge ✦ energy guide"* — **Space Mono → Space
  Grotesk**. Phase 1's missing face, per string.
- the wordmark letters — **`rgb(183, 138, 119)` → `rgb(72, 210, 185)`**, copper
  to teal, and **79.056px → 73.2px**. The `accent2`/`accent1` inversion this plan
  already suspected, now measured.
- *"where people begin"* — Space Mono → Space Grotesk, **10.88px → 12px**, and
  its colour loses its alpha (`rgba(…, 0.66)` → `rgb(…)`).
- **missing from the candidate: "starseed", "sun walk", "contact", "login"** —
  Marthe's "Menu is different", as four absent strings.

**Two findings the ranking does not show.** `galactic-field-guide` renders
**zero bands** pooled against five on her app — it is not a diff, it is an empty
page. And the landmark census reads `main 2→0  nav 1→0  header 2→0` on every
page, which turned out to be fleet-wide and live: 🔴 S3
`~/.claude/bugs/pooled-pages-have-no-landmarks.md`.

The full report is regenerated by one command (see `baseline/README.md`); it is
not committed because it is derived, and it changes with every fix.

## Phase 1 — the type system (the single biggest delta) — **BUILT 2026-08-07**

Four of her six DOM typefaces cannot currently be expressed. This is also §7's
rung 2, so none of it is throwaway.

> **Shipped:** mono `f16a5bf0` (the model) + `a66148da` (the catalog),
> HQ `1a35b2d4` (the faces), office `7cf243f` (her rows).
> `01-theme.sql` is **applied to production tgv_db** and re-run to a no-op —
> six roles and eight faces where there were two and four. Nothing anyone can
> see has changed: nginx still sends resonantweaver.com to her own app.
> Harness 123 → 140; both packages build clean.
>
> **Item 3 was already done, and the plan was wrong about why.** "Her body text
> computes to Arial" does not reproduce: `themeToFontCss` has emitted the body
> rule since 2026-08-05, `PublicTenantLanding` mounts it, and her pooled body
> text measures **Space Grotesk** — her own body role, correctly applied. What
> the differ actually found is the *other* four faces. Measured, her home at
> 1440:
>
>       her → pooled
>       117 → 262   Space Grotesk
>        59 →  23   Science Gothic   (`scienceGothic`, her next/font local name)
>        31 →   0   Space Mono
>         8 →   0   Ubuntu Mono
>        21 →   3   Arial
>        18 →   0   Times
>
> Four families collapsing into one is 145 elements wearing the wrong face with
> every colour, size and word correct. That is why it survived a cutover, and
> it is the number Phase 1 exists to move.
>
> **Five families, not six.** Arial and Times are UNSTYLED fallbacks in her own
> app — the root layout declares Inter and Playfair and never applies them — so
> they are not roles to port. Chasing them would have been porting her bugs.
>
> **`mono` and `accent` were one read away from being swapped.**
> `--gfg-font-mono` (Space Mono) is the star landing's *meta* face;
> `--font-mono` (Ubuntu Mono, GlobalStyles) is the site-wide alias her PillNav
> points at. Reading them the obvious way round puts Space Mono in her nav and
> Ubuntu Mono on her kickers — and both would have looked deliberate. Ubuntu
> Mono is also where **"starseed", "sun walk", "contact", "login"** live, which
> is four of the strings Phase 0 reported missing.
>
> **The write boundary was the quiet half.** `sanitizeSiteTheme` kept `heading`
> and `body` and dropped the rest, so a theme saved through the editor would
> have lost four roles between the panel and the database. And the theme
> picker rendered BLANK on any role whose value it did not offer — which is
> every migrated stack — so a set role read as unset and one click would have
> replaced a site's own type with a platform default. Both fixed with the model.
>
> **DEPLOYED 2026-08-07** — mono `94b61498` → RCS turbo 50/50 → HQ `e708c966`,
> `mac-deploy … --no-git-sync` from the shared main checkout,
> `BUILD_ID=F_aUrxiKQ9Am1WoBQwir8`, RCS did zero app build. All four woff2 files
> 200 on the live host. Fleet smoke green: TGV, giocoelho, guardians, nevlo,
> refusionist and resonantweaver each 200 wearing their own title.
>
> **AND THE MEASUREMENT IS THE POINT OF THIS NOTE — Phase 1 moved TWO
> elements, not 145.** Re-measured against the live pooled render:
>
>       her → before → AFTER   (home @1440)
>       117 →   262  →   261   Space Grotesk
>        59 →    23  →    22   scienceGothic
>        31 →     0  →     2   Space Mono
>         8 →     0  →     0   Ubuntu Mono
>
> Exactly the two elements this phase wired — rf-split-hero's eyebrow and its
> tagline. So the plan's own expectation for item 5 ("expect this alone to move
> the type portion of every one of the 95 sections") was wrong, and it was wrong
> in a way worth writing down: **a role nothing points at changes nothing.**
> Phase 1 built the capacity — six roles, eight faces, a shared helper, a write
> boundary that keeps them — and Phase 3 is what spends it, one component at a
> time. The 2/2 is the proof that the whole chain works end to end (theme role →
> custom property → @font-face → glyphs on the page); the remaining ~145 are
> per-component decisions the differ has to name first.
>
> It is also the reason this landed as its own deploy rather than riding with
> Phase 3: the only site with `accent` set moved two elements, which is the
> cleanest evidence available that the catalog change is inert on the four
> pooled tenants that set no such role.
>
> **ONE OF THE TWO WAS WRONG, AND THAT IS THE MOST USEFUL THING HERE.** The
> eyebrow moving to `accent` was right — Phase 0 had named it. The tagline
> moving with it was a guess dressed as symmetry: two lines either side of a
> wordmark, so the same role read as tidy. Her "a return to yourself" wears
> scienceGothic, so the change turned a MATCHING string into a mismatched one,
> and the report said so on the first pass after deploy —
> `font: scienceGothic → Space Mono`, a line that had not existed in Phase 0's.
> Reverted to the heading role in mono `52c06c33` (deployed,
> `BUILD_ID=8_nQf_Jmswq0bm00Xb6xk`) and re-diffed: font deltas on her home
> 23 → 22, the tagline silent again. The harness now asserts the absence, so
> the symmetry cannot come back with a tidy-up.
>
> A fix that makes a site LESS like itself is indistinguishable from a fix that
> works — in a screenshot, in a typecheck, and in 134 green assertions. Only the
> diff against her own render could tell them apart. That is the argument for
> Phase 0 in one line, and it took an hour to earn.
>
> **Bands are unchanged at 1440: 20 of 23 pages still have a 100% band**, same
> as Phase 0, with `sun-walk` 25.32%, `landing-star-preview/course` 11.87% and
> `open-your-journey` 7.00%. Type was never going to close a band; the height
> deltas (-690px on home) and the missing sections are Phase 2 and Phase 3.

1. **Grow `SiteTheme.fonts` beyond two roles** — `display`, `body`, `mono`,
   `accent`, `serif`. Type, validator, and one `--tgv-font*` pair each in
   `themeToPairs`; the theme panel that edits it grows the same rows.
2. **Ship the missing faces** in her `siteFonts` row: Space Mono and Ubuntu
   Mono, self-hosted under `/fonts/tenants/resonantweaver/` like the four
   already there.
3. ~~**Apply the body role to `body`.**~~ **Already true** — see the exit note
   above. Her pooled body text is Space Grotesk, not Arial.
4. **Point the catalog's type at the roles**, so a section without an explicit
   font prop inherits the site's rather than the platform's.
   `shared/typeRoles.ts` is the one table; it takes the fallback rather than
   owning one, so `typeRole('accent', headFont)` is the identity string until
   somebody names the role. Three elements pointed at their real role from the
   differ rather than from taste — rf-split-hero's wordmark at `display`, its
   eyebrow and tagline at `accent`. The other sections keep `heading`/`body`
   until a diff names them; that is Phase 3's job, not this one's.
5. Re-run the differ. **Blocked on the deploy** — the faces are HQ `public/`
   assets and the pooled render is the live HQ.

## Phase 2 — the chrome — **BUILT 2026-08-07**

Her nav and footer have **no row at all**, so this is authoring, not repair.

> **Shipped.** Two catalog entries, one wiring fix, one generated SQL file.
>
> **`rf-pill-nav` mounts the SHARED component her own app mounts.** The obvious
> move was to rebuild her bar as absolutely-positioned atoms with measured
> offsets, the way `TgvV5NavAtomic` rebuilt the platform's. That is the right
> tool when the original is app code with nothing shared behind it — and it is
> the wrong one here, because her nav IS `PillNav` in
> `@tgv/module-component-library`, generalised out of this exact site, whose
> defaults still reproduce it. A replica could only have been a slower copy that
> drifts. `rf-site-footer` is the other half: her `FooterWrapper` transcribed
> breakpoint for breakpoint and lifted into props.
>
> **The gap was not the components, it was that chrome could not hold one.**
> Chrome is stored as LayerNodes; a `block` LayerNode embeds a catalog entry
> through `blockRef`; and `LayerRenderer` resolves that through a `registry` +
> `ctx` pair that `TgvLandingRenderer` threads into the PAGE's layers and that
> **neither chrome renderer had ever been given**. Without them a block layer
> renders an empty box **in silence**. So a tenant's own nav had nowhere to be,
> and the only chrome anyone could author was the atom kind. Fixed in both
> `PublicTenantLanding.client.tsx` and `PublicSlugClient.tsx`, so the capability
> is the same on the apex and on a customer's domain.
>
> **The frame is the subtle part, and it is where a plausible choice is wrong.**
> Her nav carries its own `position: fixed` and reserves no height. A
> `chromeBehavior:'fixed'` band mirrors its height into `body`'s top padding —
> correct for the platform's bar, and here it would push all twenty-three pages
> down by the height of a bar that was never in the flow. The rows use a plain
> flow frame with a `grow` layer instead: `height:auto; overflow:visible`, and a
> fixed child is out of flow, so the frame measures zero and nothing moves.
> An assertion in `07-chrome.sql` refuses the file if either row ever becomes a
> chrome band.
>
> **Every value is guarded against her source.** `gen-chrome-rows.mjs` reads
> `layout.client.tsx`, `Footer.tsx`, `FooterWrapper.tsx` and `en.ts`, and each
> transcribed value is returned by the same call that asserts its line still
> exists. Edit a nav label or the copper in her repo and the generator refuses to
> emit rather than writing a row that quietly disagrees.
>
> **Two things found on the way.** The harness had never rendered a Next client
> component, so it grew a `next/link` / `next/navigation` stub — and the first
> render of the bar reported `An empty string ("") was passed to the src
> attribute`, which makes a browser re-download the whole page as an image. Real
> consumers always pass a logo, so it only surfaced once the nav became a catalog
> entry whose defaults carry none. `PillNav` now renders no `<img>` at all when
> `logoSrc` is empty. Harness 140 → 165 assertions.
>
> **Left for the browser pass:** her footer says "Powered by Tiny Global Village
> LLC™" and the pooled renderer appends its own attribution below the chrome, so
> the credit will appear TWICE. `creditLabel: ""` drops hers; that is Marthe's
> call, not a silent edit.
>
> **DEPLOYED AND DRIVEN IN A BROWSER 2026-08-07.** mono `30e87c0c` → RCS turbo
> 50/50 → HQ `db393a8e` (`BUILD_ID=9_eDkestEUlsgZMDHdmSW`, RCS did zero app
> build) → office `de075ee`; `07-chrome.sql` applied to production tgv_db and
> re-run to a no-op with every assertion green. Measured through the Host proxy
> at 1280: the bar is `position:fixed; top:5px; z-index:40`, its pill is
> `border-radius:999px` with `backdrop-filter: blur(12px) saturate(1.25)`, the
> links render **Ubuntu Mono** in `rgba(183,138,119,0.84)` — her mono role and
> her copper, resolved through the theme rather than hardcoded — her four hrefs
> carry no locale prefix, and the logo loads (512px natural, drawn at 42×42).
> The footer is a `contentinfo` landmark in the same face over a transparent
> band with her hairline. **The chrome frame measures `height: 0`,** which is the
> whole design: nothing below it moved.
>
> **The SQL's own fleet guard was wrong, and production is where it said so.**
> Assertion (f) asked for chrome rows changed inside a one-minute wall-clock
> window; it fired on the first real run, not because the file wrote outside its
> site but because the four PLATFORM chrome rows carry timestamps **four and a
> half hours in the future** (a UTC-vs-local write, days older than this work).
> The transaction rolled back, which is why a wrong assertion was safe to find
> there. It now diffs against a before-picture taken ahead of the first write.
>
> **The studio had the same hole as the public page,** and it would have been
> worse: `getEditorRegistry`'s two chrome LayerRenderers passed `ctx` and not
> `registry`, so a nav that served correctly on the site would have VANISHED the
> moment Marthe opened the editor to change it. Fixed in the same pass
> (`30e87c0c`).
>
> **Two findings the browser pass produced, neither ours:**
>
> 1. **The 84px — FOUND AND FIXED THE SAME DAY** (HQ `205034b3`).
>    `GlobalStyles.ts` sets `body { padding-top: var(--hdr) }` for TGV's own
>    fixed marketing bar, globally, so **every** pooled tenant page opened that
>    far down for a bar that is not on their site. It was the largest single
>    vertical offset left between her app and her pooled render, and no
>    per-section fix could have recovered it.
>    `TenantBodyChrome` gives it back — the third instance of a pattern this app
>    already carried twice (`MeetChromeReset`, `AppBodyChrome`), and the tell
>    that it is a fix rather than a redesign is that the STUDIO never had the
>    gap: a tenant authored at the top of the canvas and their visitors saw it
>    lower.
>    Measured on the four live domains at 1280×900 before and after:
>    guardianstuffies **84 → 0**, neverendinglogic **84 → 0**, giocoelho 76 → 76,
>    refusionist 76 → 76. **The two that did not move are the answer to the
>    risk** — their 76px was never the platform's; it is their OWN
>    `chromeBehavior: fixed` nav band reserving its real height, emitted after
>    the global rule and already winning. So the change moved exactly the two
>    sites that were wrong. resonantweaver, re-measured through the proxy:
>    `bodyPadTop: 0`, bar floating at `top: 5`, chrome frame `height: 0` at
>    `top: 0`, first section at `0` — her own app's geometry.
> 2. **`/sun-walk/` had no chrome at all — FIXED THE SAME DAY** (HQ `9c927ea8` +
>    `b859ad39`). There is no `page_models` row for it, nor for
>    `/galactic-field-guide/` or `/open-your-journey/`: they are APP routes over
>    `@tgv/module-starseed`, living in `app/[lang]/**` rather than in the
>    `app/u/[username]/**` segment where `PublicTenantLanding` dresses a tenant's
>    pages. The differ said `nav 1→0` and her four nav labels MISSING there while
>    `home` and `starseed` carried them.
>    The open bug called it a missing THEME. Measured, it was worse: no nav, no
>    footer, no backdrop and no webfaces either.
>    `SiteSurfaceChrome` now paints all of it from the layout — the same file
>    that already resolved the tenant per request for JSON-LD — and **which**
>    routes is decided in the proxy and carried on `x-tgv-site-chrome`. Grants
>    qualify by definition; `/book` and `/performers` join them. Excluded on
>    purpose: `/dashboard`, `/editor`, `/studio`, `/blog-editor`, `/meet`,
>    `/session` and `/login`, each of which brings its own full-height chrome or
>    strips chrome deliberately — wrapping one would be a regression dressed as a
>    fix. The layout costs one header read before any query, so the apex pays
>    nothing.
>    Verified: `/sun-walk/` renders her bar at `top: 5` in Ubuntu Mono, her
>    footer, "The Sun Walk" in Science Gothic, her backdrop, `bodyPadTop: 0`,
>    content at `0`. `refusionist.com/testimonials/` and `/book/` and
>    `guardianstuffies.com/book/` carry their own theme scope; the apex's
>    `/book/` does not; `refusionist.com/studio/` and
>    `guardianstuffies.com/dashboard/` still 302 to the handoff unwrapped.
>    Harness: 71 classifications + 23 retired URLs + **25 chrome decisions**.
>
> **So her chrome is now complete across both segments**, and Phase 3 is free to
> be about the components rather than about the frame around them.

1. Author the `nav` override: her logo, and Starseed · Sun Walk · Contact ·
   Login with her hrefs — `/starseed/`, `/sun-walk/`, `/#contact`, `/login/`.
   Contact is an in-page anchor, not a route. **No `/en/` prefix**: her app
   hides the default locale and 307s `/en/starseed/` to `/starseed/`, so the
   prefixed form (which this plan asked for until Phase 0 probed it) would cost
   every visitor a redirect on every nav click.
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

> **QUICK WINS — DONE 2026-08-08** (mono `1a3241b5` + office `490cf59`; rows
> applied to prod by delete-and-redrive of the 18 generator-authored pages).
> `markRight` false in both heroes (SymbolWrap is the FIRST grid child — mark
> LEFT); the hero row carries `accent`=COPPER / `amber`=TEAL swapped off the
> theme fan-out, which fixes wordmark, eyebrow, tagline, halo, rule and both
> drop-shadows in one move (measured: the wordmark colour rows vanished from
> the census; eyebrow/tagline now differ only in notation, rgba vs
> color(srgb)); `wordmarkSize`/`wordmarkLineHeight` ride the star hero
> (PreviewBody upsizes every h1 to 4.5vw — the 79.056px); `RfCtaDef.arrow` +
> `RfOfferItem.ctaArrow` render her trailing `→` in its own aria-hidden span.
> The stray-CTA claim retired: her launch RENDERS "Learn more"/"Explore"
> (OfferingTile linkLabel) — the differ's real complaint was the arrows.
> **Deployed and measured**: HQ @ `1a3241b5` (BUILD_ID `b3B9EuS49oFZcDuPCtW7p`,
> mac-deploy from the lane, RCS built nothing); the re-diff drops the wordmark
> size rows (79.056 → gone) and the arrows now render (missing 21 → 17; the
> `→`s survive as a font row, Space Mono → Space Grotesk, which is the
> offer-card CTA type-run work). Remaining census noise worth killing in the
> HARNESS: the differ prints `rgba(72,210,185,.68) → color(srgb 0.282…/0.68)`
> — identical pixels, different notation, because color-mix() output reads
> back as color(srgb). Canonicalise colours in measure.mjs before the next
> ranking or every swapped-accent row wears a false diff.
>
> **And the biggest single-page loss was a data bug, not component work:**
> `receive` (−2879px, error boundary) 500'd because her gateway `lead` is
> `string | string[]` and receive's is the array — authored raw, it broke
> BOTH `tenantPageMetadata`'s trim and the offer card's body split. Joined
> in the generator (blank-line for body — the exact inverse of the split —
> space for meta); receive now renders 7 sections, 200 everywhere. Two
> traps recorded on the way: 02-pages.sql is INSERT-only (`WHERE NOT
> EXISTS`) so re-authoring means DELETE the 18 slugs + redrive, and the
> LANE's RW checkout must be pulled to her launch commit (`e01bb4c`) before
> regenerating or HIDDEN_GATEWAYS reads receive as hidden.

### The gateway/offer family — the map (read 2026-08-08, sources verified)

Twelve of the fourteen worst pages share ONE styled vocabulary, so the next
pass is a family, not a page: `OfferDetail.tsx` composes `ProductHero` +
`DetailSection` + `ProcessCard`/`ProcessFlow` + `CalloutBar` over local
`BackLink`/`Eyebrow`/`SectionHeading`; `GatewayPage.tsx` composes
`GatewayHero` + `SectionIntro` + the same steps/callout shapes.

**Recurring atoms** (extract first, per §3b): meta eyebrow (mono face
`--gfg-font-mono`, 0.67rem/700/0.13–0.19em/uppercase, accent-toned — the
`accent` TYPE role, which `typeRole()` layers safely: unset ⇒ no-op
fleet-wide); display heading (display face, clamp(1.75rem,3.2vw,2.65rem)
section / clamp(2.65rem,4.5vw,4.4rem) page hero, weight 520, −0.025–0.045em,
lh 0.98–1.04); muted copy (BONE 0.58–0.63, lh 1.68–1.72, max 35–39rem); mono
plate button (0.68rem/700/uppercase, accent-38–48% border over
rgba(8,24,38,.65), hover slides the `→` span 4px); mono text link (same run,
no plate, BONE 0.47–0.52); ✦ list with mono label (DetailSection Includes);
framed cover (radius 12, `0 18px 48px` drop, inset vignette, accent glow
radial); price line (1.5rem display accent in hero, 1.05rem mono in callout).

**Entries to derive** (five-file shape each, `derivedFrom` recorded):
- `rf-product-hero` ← ProductHero/GatewayHero — framed image one side, eyebrow
  + title + lead + optional price/status + actions (plate and/or text link);
  gateway is the image-right, two-action, no-price parameterisation.
- `rf-detail-split` ← DetailSection — 0.72/1.15/0.85 three-column, ruled top
  and bottom, head | paragraphs | ✦ includes with mono label.
- `rf-callout-bar` ← CalloutBar — centered ruled band, radial glow at 50% 0%,
  eyebrow/title/copy/optional price/plate action; the three variants collapse
  to props (glow + accent follow the row; offerings' bare copper link is the
  no-plate parameterisation).
- `rf-process-steps` ← ProcessCard grid + ProcessFlow — "01 …" numbered cards
  three-up, or the compact one-line flow with separators.
- `rf-section-head` ← GatewayPage SectionIntro — heading left, copy right,
  aligned to baseline, hairline bottom border.
- `rf-centered-intro` ← LandingStarPreview Intro — centered eyebrow/title/copy,
  width min(100%−3rem, 55rem), title 520/−0.025em/0.98.
- back link: her `BackLink` (mono 0.68rem, BONE 0.47, ← prefix, aligned to the
  86rem container) — decide rf-linkbar `look:"mono"` param vs its own entry.

**The page shell is the missing landmark-and-tone layer**: GatewayBody /
OfferBody set a per-page toned background (radial glows keyed to the door),
`--page-accent`/`--product-accent`, and the page base font, and her containers
run min(100%−3rem, 86rem) = 1376px at 1440 where the pooled bands measure
full-bleed 1440. The entries must reproduce the container; the per-page tone
needs a home (page-level prop or a leading full-bleed section) — decide at
build time. The offer pages read `offer.accent`/`offer.glow` from her offers
catalog per slug (teal/copper/indigo per product) — the generator must carry
those per-row the way the hero now carries its swap.

Where a section of hers turns out to be genuinely the generic thing, keep the
generic entry and say so in the ledger. The ruling is bias-to-more, not
port-everything; a row that already matches is a row that already matches.

`OnePage.styles.ts` deserves its own pass rather than being absorbed piecemeal —
it carries the shared vertical rhythm behind all fourteen, and it is where most
of the 690px lives. Treat its spacing scale as its own atom set.

### THE FAMILY PASS — first cut BUILT + DEPLOYED 2026-08-08

**Eight entries landed on mono main, one commit each** (`c8854f20` atoms →
`ab781de7` rf-product-hero → `34c42db5` rf-detail-split → `0944f8ee`
rf-callout-bar → `20740c74` rf-process-steps → `230aee58` rf-section-head →
`6f155c2f` rf-centered-intro → `3037436e` rf-back-link → `cbc0cdf3`
rf-page-tone, plus `c9b10101` + one fix commit). Atoms first per §3b: RfCta
grew her `plate` and `monolink` shapes (+ per-CTA `color`, because her plate
borders are copper at 38% even on the teal door), and RfMetaEyebrow /
RfDisplayHeading / RfStatusBadge are shared primitives in refusion.tsx.
`ComponentEntry.derivedFrom` is now a TYPED field; every entry records its
lineage. Render-check grew to ~240 assertions.

**Rulings taken and recorded in the entries themselves:**
- back link = its OWN entry (rf-back-link), NOT `look:"mono"` on rf-linkbar —
  one link on a container vs a wrap row; bending the generic one is the
  anti-pattern §3 closed.
- the page shell = rf-page-tone, a leading SECTION (rides rows/versioning/
  Client Versions), failing toward NOTHING like siteBackground.
- the family's mono runs follow the **accent** type role (her Space Mono),
  never `mono` (her nav's Ubuntu Mono) — asking for mono would mis-face every
  plate, marker, badge and back link the day the roles resolve.

**Two lessons a browser taught that render-check could not:**
1. **A section cannot own a fixed z:-1 layer.** The renderer's per-section
   wrappers are positioned and z-indexed, so the tone layer painted at the
   bottom of ITS wrapper's context and the wrapper lifted it above every later
   section — an opaque tone over the whole page. The tone paints on the BODY
   now (also her actual geometry: page-sized, scrolling).
2. **The differ's first family run was 100% polluted by that layer** — every
   band % from run rw-p3-family1 measured glows-over-nothing. Re-measure after
   any page-level paint change before reading numbers.

**Row bugs the first diff surfaced, fixed in the generator** (`30d745b` +
`71b2289`, both redriven to prod): develop's offer grid heads with its OWN
`offerEyebrow/Title/Copy` ("ways into the practice"), and the gateway
noteTitle band ("which one fits?" / "practice, not performance") had never
been authored by ANY generation. Three offer-page sections also author for
the FIRST time: `detail.inside`, `detail.processCompact` (the → flow) and the
`noteTitle` prose band — part of somatic-signature's lost height.

**Still open after this cut (differ, non-polluted items):** the gateway/
all-products CARD grids still render as rf-offer-card approximations
(headings 52px teal vs her 30.4 bone; markers Space Grotesk; "learn more →"
links missing) — the rf-door-card/rf-offer-card refinement is its own pass;
form labels ("name *"); home's doors/FAQ/contact/about bands; and the
harness's color-mix-vs-rgba false positives (canonicalise in measure.mjs)
still pollute every text census.

**Second run (rw-p3-family2, deployed `0caf5d02`, redriven rows): the offer
detail pages are census-clean on TYPE** — resonance-mirror's 1440 diff is
down to `box 10` + the one rgba-vs-color(srgb) false positive; every font,
size, weight and color matches. What keeps the bands over the gate is now
MEASUREMENT GEOMETRY, not pixels: (a) the candidate's band crops are the
full-bleed section (1440) where hers crop the in-container band (1312) —
the differ needs to crop both sides at the same x-extent (full viewport per
band y-range is the honest form) before its percentages mean anything on
these pages; (b) the callout band absorbed the 7rem page-bottom pad into its
own box — fixed component-side (`6084bf57`, margin not padding — ON MONO
MAIN, NOT YET DEPLOYED; deploy before the next measurement). **Next window,
in order: the two harness fixes (color canonicalisation + band x-crop) in
measure/pixeldiff, deploy `6084bf57`, re-rank; then the door/offer-card grid
refinement, home's remaining bands, form labels.**

### THE RULER PASS + THE CARD GRIDS — 2026-08-08 (same day, next window)

**The ruler first.** HQ `fa64a678` (tenant-pixel-parity + pixeldiff, pushed to
HQ main; scripts only, no deploy needed):
- **Colours canonicalise at COMPARE time** — `rgba(232,229,218,0.47)` and
  `color(srgb 0.909804 … / 0.47)` are one paint Chromium serialises by
  authoring space; both sides now collapse to 8-bit rgba before comparing
  (raw strings kept in the examples). Compare-time, not capture-time, so the
  frozen baseline needs no re-shoot.
- **Bands diff as FULL-WIDTH STRIPS of the two full-page screenshots** over
  each band's own y-range (`diffBands`, decoded once per page). Element-box
  crops compared her in-container 1312px against the catalog's full-bleed
  1440 — every pair a size mismatch, every % about the crop.
- **One-sided bands diff against the OTHER page's neighbour-aligned strip.**
  Her offer back link is `inline-block`, content-wide, so HER census never
  banded it — and a flat 100% for a link both pages render made every offer
  page's "worst" a phantom. Genuinely absent content still scores high.
- The live differ now writes `<slug>.json` per capture, so a finished run
  re-diffs via `--candidate-dir` after a harness change without re-shooting
  75 pages.

`6084bf57` deployed (BUILD_ID `KpTdLWdbR9n2ZOJo_-c0I`). **The honest re-rank**
(`rw-p3-rank1`, all 25×3): open-your-journey 0.22% under the gate; course
8.41%; somatic-signature 12.15%; the offer/experience detail pages 15–34%
(their hero bands are micro-offsets + the tone-glow geometry, which scales
with page height); receive/develop 94% and all-products 78.5% — the card
grids, exactly next in line. journey / galactic-field-guide / writing /
pearl-chamber still carry structural 100s (pairing collapses — chrome/section
granularity, not paint).

**Then the grids.** Mono `80c26d2f` **rf-hud-cards** — her Cards.tsx is ONE
material (`hudCardSurface` under `cardHeadline`, "Shared card material for
every card in this file") worn two ways, so one entry with two layouts:
`door` (marker with its clamp(5rem,9vw,8rem) drop when no artwork, price +
real StatusBadge row, arrow inside the link's words) and `tile` (contained
artwork on the teal-glow well, "01 · category" index, foot PINNED via
margin-top:auto — price left, sliding-arrow span right, `featured` floors
30rem under the brighter wash). `columns: 0` = her auto-fit 20rem grid.
`heading` = her DoorHeading (small display h2 IN THE INK — the 52px teal row
heading the differ kept naming). WHY NOT rf-offer-card / rf-door-card is in
the entry README. Mono `df102d8c` **rf-mono-note** — her PlaceholderNote is a
<p> in a dashed box; rf-media-copy's band padding made the 49px note a 243px
section (the worst band on the three draft offers). Mono `f79b…/last`
**rf-back-link pageTop = margin** — the callout ruling applied at the other
end: padding put 152px of page ground inside a 16px band and every family
page's worst was a 94% phantom.

Office `1d30f8e` + next: six grids re-author as rf-hud-cards (receive cards +
courses, develop courses, three all-products doors) with her Cards.tsx tones
authored per row; the three placeholder notes as rf-mono-note; `hudStatus()`
carries READY_STATUSES from her source. Rows redriven to prod (DELETE 18 +
02-pages.sql, assertions green).

**Measured after deploy (`rw-p3-cards1`)**: the grids land — receive's rail
2.12%, courses grid 7.86%, develop's grid 6.24%, all-products tiles 8–10%,
the placeholder note 80.9% → 4.14% (band 49px, exactly hers), and the
gateway/offer text census is CLEAN on type (box rows only). What remains on
these pages is measurement geometry again, one level up: (a) her band census
is COARSER than the candidate's — her ContentSection is intro+grid in ONE
band (847/1018px) while the candidate sections one-per-entry, so the pair
compares a compound band against its own head (80–86% phantoms on bands the
aligned strips score 2–8%). The differ needs SEGMENT-ALIGNED diffing (anchor
on matched pairs, diff the full page between anchors) before per-band % means
anything on compound pages. (b) all-products' HEADER is still an rf-media-copy
approximation — her Header is the section-head shape at h1 scale (64.8px vs
51.2 rendered, Space Mono eyebrow vs Grotesk): parameterise rf-section-head
(headingLevel, titleSize/tracking/lh/max, column fraction, gap, padBottom)
and re-author. Its closing band eyebrow shows the same non-accent face — check
what authors it. (c) the waitlist pages' 100s are the FORM: form-live labels
("Your name"/"Email"/"(optional)") don't render, the submit is dark 13px
Grotesk vs her teal 10.88px mono plate (WaitlistForm.tsx: labels 0.65rem/0.08em
uppercase bone-62, input on rgba(0,0,0,0.28), submit teal-8% bg/teal text) —
plus the band finder swallows chrome on short pages. **Next window, in
order: segment-aligned diffing, the rf-section-head h1 parameterisation +
all-products header re-author, the form-live label/submit styling, home's
doors/FAQ/contact/about bands** (home band 2's door markers also wear Grotesk
— rf-door-card's index run predates the accent-role ruling; check it while
in there).

### SEGMENT ALIGNMENT + THE ALL-PRODUCTS HEADER — 2026-08-08 (the window after)

**The differ got its page-level number (HQ `c51c0b83`).** Segment-aligned
diffing landed exactly as the ledger asked, plus one lesson the first cut
taught: anchors are the order-agreeing sig-matched pairs (LIS on candidate y,
so a crossed match can't fold a segment negative), and cuts land at each
anchor's top AND at its bottom — but the bottom only when the pair's HEIGHTS
AGREE (±max(32px, 15%)). Top-only cuts left few-anchor pages as one huge
segment where a 19px growth misaligned everything below (open-your-journey
read 2.63% aligned against 0.22% worst band); bottoms from compound↔head
matches are different visual lines and manufacture misaligned segments (a
first draft scored develop 61% where the final scores 33%, both against the
same pixels). Every pixel of both pages is diffed exactly once; `alignedPct`
ranks the report and gates the pass; per-band rows stay as localisation
detail. Bands still gate captures with no full-page shots.

**The first honest full ranking (`rw-p3-rank2`, live @ 04a8ff8b, 75/75):**
home 51.65–65.99% / home-classic 44–57% / starseed 33–41% / pearl-chamber
49.75–80.83% are the real worst; experience pages 21–31% (+180–426px);
all-products 16.76–22.38% with the header seg at 62.33%; the offer-detail
cluster a uniform 7.7–15% every one +87–123px taller; develop's 94% "worst
band" is honestly 8.23% aligned; open-your-journey 2.63% (its one real
defect: a +19px footer-region tail segment, 9.68%). FIVE pages have NO
anchors at all — journey, writing, galactic-field-guide (pairing collapses:
9→2, 2→4, 5→1 sections) and the two draft offers (the form pages) — aligned
n/a, structural work, not styling.

**Then the three named re-authors, one commit each:**
- **rf-section-head learned her Header — one seat, two scales** (mono
  `923cfbe9`). headingLevel h1/h2 + title size/tracking/lh/maxCh + copy
  column fraction/min/gap + padBottom + borderAlpha + copy scale + stackAt,
  every default the gateway values so existing rows emit byte-identically
  (asserted — the old block passes untouched; 276/276). sec-all-head authors
  AllProducts.styles verbatim: clamp(2.65rem,4.5vw,4.4rem) at −0.03/1.04,
  15ch, 0.62fr from 18rem, 6rem gap, clamp(3rem,6vw,5rem) over the 11%
  hairline, copy clamp(1rem,1.45vw,1.16rem)/1.7 capped by the column alone,
  760px stack.
- **The all-products closing was a CalloutBar all along** — variant
  "offerings", and the entry already existed; the row just wore rf-media-copy
  (the "non-accent eyebrow face" the last window flagged). sec-all-close
  re-authored on rf-callout-bar: teal glow rgba(TEAL,0.1), 20ch title at
  −0.025/1.04, copper monolink with arrow, maxWidth 86, padBottom 7rem
  (office `261a391`, both rows).
- **The form renderer's last hardcoded paint became `--mf-*` vars** (mono
  `47cde691`). The waitlist "100s" were never missing labels — the census
  drops FTitle leaves that carry a required-`*` child span; the real drift
  was the platform's cyan-white 12px labels, dark glass fields and
  dark-on-accent pill on her domain. Ink, gap, label
  font/size/tracking/transform/color, field pad/size/bg/edge/focus, radius,
  submit pad/size/tracking/transform/font/ink/bg/bg-hover/edge — each a var
  whose fallback is the old literal (an unthemed form is byte-identical;
  both package tscs exit 0). `--mf-req-display: none` hides required marks
  for designs that mark nothing. form-live grew a `vars` map (only the
  `--mf-` namespace crosses). The waitlist rows author WaitlistForm.tsx:
  labels 0.65rem mono uppercase bone-0.62 (accent role via
  var(--tgv-fontAccent)), square fields on rgba(0,0,0,0.28) with teal focus,
  submit teal-on-teal-8% 0.68rem/0.08em with teal-16% hover, 28rem column,
  no asterisks. Home's contact form has its OWN styling (r8, bg 0.3, focus
  ring, full-width 0.72rem submit) — its vars belong to the home pass.
- **rf-door-card's index run and arrow joined the accent role** (mono
  `1f9ba8f8`) — the last two meta runs in the family wearing the page face
  ("i · door" and "→" measured Grotesk on home). typeRole('accent') in front
  of inherit; role-less sites render exactly as before; 280/280.

Rows redriven (DELETE 18 + 18 inserts, assertions green — twice, it is
delete-and-redrive by design). Home's contact form data is FINE — "name *"/
"email *" missing from its census is the same FTitle-leaf artifact, the form
and its fields render.

**Measured after deploy (`rw-p3-verify1`, live @ 1f9ba8f8, fleet green):**
all-products 18.72% → **10.85%** aligned at 1440 — the header band is her
height now (248→249px, was 312→485), the closing callout 27.8% → 2.59%, and
the page's whole type census is down to ONE row ("→#11" 10.88 vs 10.72px).
The waitlist forms measure her values exactly (Space Mono 10.4px/700 labels
on bone-0.62, 448px column, fields 15.2px on rgba(0,0,0,0.28)) and their
type-delta rows are gone; the pages stay aligned-n/a because SHORT pages
pair nothing — structural, next window. **One find while verifying: the
pooled footer appends its own 12px "powered by tiny global village" line
UNDER her footer** (candidate-only last band on every page — her own footer
already says "tiny global village llc™", so it reads twice on her domain).
It is most of the tail segments (all-products' 224→311px) and plausibly the
offer cluster's uniform +90px. Whether RW keeps the platform attribution is
GIO'S ruling, not a generator fix.

**Next window, in order:** (0) the footer attribution ruling + the offer
cluster's uniform +90px (measure what's left of it if the line goes);
(1) **home's bands** — the doors row re-author
(her CardIndex/Arrow metrics: index teal-0.62, arrow copper-0.94 at
0.7rem/0.1em with the 1rem sliding span and 1.7rem seat — needs arrow
metric/color knobs on rf-door-card), "begin where you feel the pull"
(54.34%), the archive band (24.59%), FAQ (59.35%), contact (her landing form:
r8 fields on rgba(0,0,0,0.3), border white-16, teal focus + 3px teal-16 ring,
full-width mono submit 0.72rem/0.12em — author as --mf-* vars incl. a
--mf-submit width... check what her submit's colors resolve to first), about
(72.41%), and the two 128px her-only page segments (seg 0/5 — her page-top/
inter-band margins, likely the margin-not-padding family again). (2) the
offer cluster's uniform +90px. (3) the five NO-ANCHOR pages (journey /
writing / galactic-field-guide render 2, 4, 1 sections — missing content,
not styling; the two draft offers pair nothing because the form + chrome
dominate short pages). pearl-chamber + home-classic stay parked on the
Cormorant-wholesale ruling (Gio).

### THE ATTRIBUTION RULING + HOME'S BANDS — 2026-08-08 (the window after that)

**The ruling (Gio):** the "powered by tiny global village" line is DROPPED on
dashboards and KEPT on the public website. Code says the drop half was already
true — the string renders in exactly one place, `PublicTenantLanding`
(`/u/**` pages + blog); the `(app)` group serving `/dashboard` never mounts it
and HQ's marketing footer's own advert line is commented out. (Noted while
verifying: the granted app surfaces under `SiteSurfaceChrome` — sun-walk,
course, field guide — carry NO attribution at all, so the line is inconsistent
across her site; platform call, not parity work.) The kept line therefore
became a MEASUREMENT rule: the candidate capture records where
`[data-powered-by]` starts (visible-only — rf-journey hides it and a hidden
rect reads y=0, which would crop the whole page) and the differ treats the
page as ending there — a CROP, not a mask, because a mask leaves the height
delta, which is most of what the line costs. Printed as
"(attribution 67px cropped)" so it is visible, not silent. HQ harness commit
`08f345e3`, pushed. Honest re-rank `rw-p3-rank3` (all 25, live @ `1f9ba8f8`):
offers fell 8–15% → 5.8–7.8% with +20px remainders (the +90px WAS mostly the
line), all-products 9.60, open-your-journey 2.63 (attr 0 there — rf-journey
hides the line, correctly), home 52.15 = the worst measurable page.

**Home's bands, two rounds, DEPLOYED (`37aba7bf` then `25ce4c4d`), rows
redriven twice, fleet green: 52.15 → 12.91 → 9.89% aligned, dH −758 → −28.**
Seven mono commits of knobs — every default byte-identical (320/320
render-check), her values authored in the rows, never the defaults:
- `ea7dfa3c` rf-split-hero `padAsMargin` — the entry carried her Main's 8rem
  top pad INSIDE the section, so every pooled hero box was 128px taller than
  hers and segment alignment charged the page top for it (both 128px "her-only
  segments" were THIS + her Section rhythm). Margin, not padding: the
  rf-back-link pageTop lesson, again.
- `15dd42b5` rf-centered-intro `marginTop` — her home rhythm is
  clamp(5rem, 9vw, 8rem); spacedTop's boolean is the callout family's
  clamp(6rem, 11vw, 10rem). Two real rhythms, string wins.
- `4ab1db95` rf-door-card density + BOTH hues — teal index, copper-0.94 arrow;
  one accent could not carry both. Her flex arrow (0.5rem gap, 1rem glyph,
  5px hover slide), her cardHeadline title, sidePad 0 (the entry's 1.5rem was
  narrowing every card 24px).
- `1fe574f5` rf-hud-cards density knobs + `profile` (her AboutCard — the same
  material worn as a bio; third layout, not a new entry).
- `b377a0f9` rf-accordion card face (FaqCard: hud wash + 48rem + her hairlines
  white-0.08, display-role names 0.98/300, compact #f5f9f8 head, upright
  #9aa4ab lede, teal-0.7 chevron) + RfSection padding="none"/marginTop.
- `35db9cfc` module-forms: --mf field lh/font, placeholder, focus RING,
  textarea-minh, submit width/align/weight/minh/lh/shadow, a full --mf-title-*
  family; form-live cardWash/cardPad (one hud material across all three home
  cards).
- `25ce4c4d` round 2: eyebrowSize 0.68rem, hud marginBottom (the page's bottom
  breath), rf-media-copy framePad/marginTop/centered (its lg frame was +121px
  of the archive segment), RfCtaDef per-CTA type overrides (NotifyButton = the
  ritual plate worn in the accent mono — no variant could say that).
Office `77507c1` + `84de20f`: the star rows author all of it, including
ContactCard RESOLVED (FormWrapper/RitualButton base + the && overrides baked
into 36 --mf vars, 544px card) and the featured tiles' true tones the measure
named (index teal-0.7, link copper-0.94, copy bone-0.57 — round 1 had them
teal/teal/platform-grey).

**Also this window: Gio's dashboard-reset question, answered** — 🟡 S2
`~/.claude/bugs/dashboard-layout-canon-always-wins.md`. HQ's dashboard page
passes `{layout, updatedAt}` into a prop typed `LayoutNode[]`, so
`liveLayout.length` is undefined, `hasRow` is always false, and EVERY member's
saved arrangement silently resets to canon on reload (the save itself lands in
`member_dashboard_layout` and is never read). Plus: the canon-publish gate
`!activeSiteId` is never true for an admin on HQ (P11 self-site seam), and tab
toggles write `dashboard_features` without the HQ-self-site override the read
applies. Fix is three small HQ edits (in the bug file) + an optional DB-only
promote of his saved tree into `dashboard_layout_canon` tonight.

**Left on home (1440):** hero interior 20.96 + its 84px gap 29.18 (halo/nav
pixels — needs the seg diffs read against her HeroSection), intro bands ~30%
of 262+80 (metrics match the census — 42.4/520 both sides; the offset needs a
crop-level look), doors 19.86 (photo RESAMPLING — her next/image optimized vs
pooled raw <img> — plus small text ghosts; may be the differ's floor unless
pooled serves the same bytes), about 10.3, featured 5.6, FAQ 6.4, contact 2.5.
**Next window, in order:** (0) hero + intro segment forensics (read
`rw-p3-home2/1440/home@seg01..04.diff.png` against her HeroSection/Intro);
(1) the doors image question — same bytes or accept a floor; (2) the five
NO-ANCHOR pages (journey/writing/galactic-field-guide = missing content); (3)
sweep the new knobs' EditorPanel fields (authored via SQL today, not yet
studio-editable — flagged, not hidden); (4) re-rank all 25. pearl-chamber +
home-classic stay parked on the Cormorant ruling. The differ's `--only` needs
full slugs (`home`, `landing-star-preview-develop`, …); infra: tunnel 3101 +
host-proxy 8105 still up.

### THE WASH FORENSICS — 2026-08-09 (items 0 and 4; rf-page-tone was never painting)

**The hero/intro forensics found one missing paint, and it wasn't the hero's.**
Her `PreviewBody` puts two radial washes on the PAGE-HEIGHT body — at 1440 the
blue `ellipse 66% 36% at 50% 12%` is a ~2,200px-tall glow reaching from the
hero through the intro into the doors. The pooled page approximated it with
`siteBackground`'s orbs, which render in SiteBackdrop's `position: fixed`
viewport layer: the same wash at ~1/7 the height, pinned to the top of the
screen. Measured: her empty center column reads (11,28,44) at hero AND intro
depths; the pooled page read bare `#06111c` — that one wash was most of
seg01–04 (21–31% each). Fix: `sec-star-tone` + `sec-all-tone` author each
page's own `rf-page-tone` layers (source-guarded; office `6602d71`, applied by
redrive). The orbs STAY for open-your-journey and starseed, whose `Sky` is
genuinely `position: fixed` in her source — that is why open-your-journey
measures 0.22% with orbs alone.

**Which exposed that rf-page-tone had NEVER painted, anywhere, for anyone.**
Two defects, both proven in a live browser and fixed in the package (mono
`d22b72d2` + `4f5f9713`, deployed):
1. **The cascade.** SiteBackdrop's `body { background: transparent }` lands
   AFTER the tone's bare `body` rule in the served sheet (SSR extraction order
   ≠ mount order), so every tone row on the fleet was inert — computed body
   background transparent on home and on an offer page both. The offers'
   "toned" look was their heroes' local glows. Now `html body` — one level of
   specificity, order-proof.
2. **The backdrop paints OVER the body.** With the cascade fixed, the wash
   showed in fullPage captures but NOT in the live viewport at any scroll —
   the opaque fixed z:-1 ground covers the body's background in Chromium
   ("an opaque body hides the fixed layer" is false; fullPage renders the
   fixed layer only once, which is why the differ could see what users could
   not). The tone now hides `[data-site-backdrop]` while mounted — a page
   declaring an opaque tone has no use for the site backdrop, same reasoning
   as her opaque bodies covering the starfield. Plus `display: flow-root` on
   body: the first section's collapsed top margin was shifting the gradient's
   positioning area down 128px; flow-root contains it without moving content.

**Measured after deploy (differ, live HQ):** home 9.89 → **7.79%** (hero seg01
20.96 → 2.95, its gap 29.18 → 0, intro seg03 30.61 → 6.28, seg04 29.11 → 0);
all-products 10.85 → **7.08%** (header band 36.18 → 4.89 — its teal wash).
Full re-rank `rw-p3-rank4` (item 4): **offers now 3.05–5.90** (was 5.8–7.8),
develop 4.50, receive 5.33, course 6.03, pendulum experience 7.03,
open-your-journey 2.63 unchanged. Remaining, in order: pearl-chamber 47.02 +
home-classic 43.29 (PARKED, Cormorant ruling), starseed 32.88, experience
resonance-mirror 21.97 + pearl-chamber 21.06, sun-walk 13.80, home 7.79
(doors 19.87 = the image-resampling ruling; about 10.29; tail seg14 24.36 =
the +19px footer delta, now lit up by the wash edge — the same "+20px
remainder" the offers carry). journey/writing/galactic-field-guide still
pair nothing (missing content).

**Next window, in order:** (1) the doors/experience image question — same
bytes or accept a floor (GIO'S RULING; experiences 21–22% are card grids of
the same photos); (2) the five NO-ANCHOR pages; (3) the +19px footer tail;
(4) EditorPanel fields for the SQL-only knobs. Same infra, same `--only`
slugs.

### THE NO-ANCHOR PAGES + THE INHERITED 1.6 — 2026-08-09 (items 1–3)

**The ruling (Gio, item 1):** photos are judged by eye, not by bytes — ~20%
on the doors/experience segments is the accepted resampling floor, and HE is
the eye: everything gets committed before the cutover and nothing switches
until he has looked. So the doors (19.87) and the experience pages (20.35 /
21.28 in this ranking) are DONE pending his pass, not work items.

**Item 2 — the three pages that paired nothing, three different causes:**

- **/writing was a different design, now it is her page on its own entries.**
  Two new catalog entries derived from `WritingPage.styles`, one commit
  (mono `55c881f7`): `rf-serif-head` (small-caps serif eyebrow, the two-line
  title with the italic second line, the ghost ampersand at −48%, the 1.85-lh
  lede, the FadeLine rule at container width) and `rf-cover-cards` (4/5
  cover-art cards under her scrim, footer pinned to the card's bottom edge,
  the RESONANT WEAVER byline wordmark with enlarged initials, the bookmark).
  The row (office `ad16bf2`): sec-writing-tone — her FOUR-layer wash, where
  the fourth layer IS the ground (a deep-blue radial, not #06111c) — plus the
  two entries, fourteen new source guards, colors on the surface tokens and
  type on the SERIF role. Card 2's cover is deliberately empty: her
  `LeafOscilator-Logo4.png` never existed (broken on her live site), so the
  pooled card wears her CoverFallback ground instead of carrying a 404. The
  studio-instruction rewrites (copy.mjs) are unchanged and remain the one
  deliberate text delta.
- **/journey was wearing the wrong ruling.** "The section owns the viewport,
  so chrome off" was an assumption; her live page has the nav pill FLOATING
  over the sealed experience and 112px of real footer below it (1012 vs 900).
  `09-journey-chrome.sql` flips the applied row (nav+footer true), 03/04
  corrected so a replay agrees; rf-journey's [data-powered-by] hide (Gio's
  2026-08-05 ruling) is untouched — the line she shows is her OWN footer's.
  Measured: nav floats without pushing (JourneyGlobals still zeroes the body
  pad), footer lands below, dH 0. The page stays aligned-n/a STRUCTURALLY —
  its nine baseline bands are her textless 100svh scroll markers, nothing for
  the sig-matcher to hold — but every strip diffs ≤1.9%, which is the honest
  number for a page that is one canvas.
- **/galactic-field-guide was pixel-identical with a footer painted over
  it.** Her page mounts the HUD inside `position:fixed; inset:0;
  z-index:100000`, so the layout's footer exists UNDER an opaque chart; the
  pooled mount had dropped that wrapper, the flow height collapsed, and the
  tenant footer landed at the top of the viewport across the star chart. One
  HQ commit (`0576fd5a`) restores her wrapper verbatim: **3.91% aligned,
  dH 0, 5/5 sections paired.**

**Item 3 — the +19px footer tail was ONE MISSING DECLARATION, and it was the
inherited-1.6 family all along.** Her footer never declares a line-height and
renders at `normal` (16px lines); the pooled base styles set 1.6 on the body,
which rf-site-footer inherited — 25.6px lines, two of them, +19.2px on every
RW page (her 112 vs pooled 131, same padding, measured live). The entry now
declares `line-height: normal` (mono `04955d80`). THE SAME MECHANISM then
surfaced twice more the same hour: the writing eyebrow (+7px, everything
below it shifted) and the cover-card footer runs — every block her files
leave undeclared now declares `normal` in the two new entries. Fleet risk
nil: rf-site-footer serves only RW's chrome rows.

**Two cascade lessons the new entries taught, both now pinned in
render-check (347/347):**
1. **A styled class cannot out-vote the theme's heading rule.** themeToFontCss
   applies the site's heading role as `[data-site-theme] h1…h6` — (0,1,1) —
   which beats a bare styled class (0,1,0). Every prior rf heading WANTED the
   heading/display role, so the trap never fired; writing is the first SERIF
   heading, and its h1 rendered Science Gothic with `--tgv-fontSerif`
   correctly set on the very element. Both new entries declare font-family
   behind a doubled class (`&&`); an entry asking for a NON-heading role on a
   heading must do the same.
2. **padTop is a margin here** — her 4.5rem lives outside the header band, so
   padding inside the section put the band top at y=0 and every strip cut 72px
   out of phase (mono `80d4f5f9`… the lane's last commit; the
   margin-not-padding family, one more member).

**Measured (rw-p3-rank5 full 1440, then rw-p3-noanchor7 for writing):**
writing none → **6.73%** (page top 0.64, body 7.19 = the cover art + the two
ruled text rewrites); galactic-field-guide none → **3.91%**; journey strips
≤1.9, dH 0. And the footer fix moved the whole board: **offers 1.88–4.54**
(was 3.05–5.90), **open-your-journey 0.41** (was 2.63), develop 3.94, receive
4.69, course 4.71, all-products 6.61, home **7.43**, galactic-pendulum
experience 6.19. Unchanged and parked: experiences 20.35/21.28 + doors (the
photo floor, Gio's eye at the end), sun-walk 13.38, starseed 32.76,
pearl-chamber 46.18 + home-classic 43.56 (Cormorant ruling). writing at
390/768 carries −30/−56px (card/title clamp midpoints) — a refinement, not a
gap. Four deploys, all smoke-green, RCS built nothing.

**Item 4 (NEXT) — EditorPanel fields for the SQL-only knobs**, audited
2026-08-09, panels missing exactly these: rf-split-hero `padAsMargin`;
rf-centered-intro `eyebrowSize`/`marginTop`; rf-door-card's density family
(`rowGap sidePad cardBg titleSize titleWeight titleTracking titleLh copySize
arrowColor arrowSize arrowWeight arrowTracking arrowTop arrowGap
arrowGlyphSize hoverGlow`); rf-hud-cards' density/profile family
(`marginBottom gap cardPad marker* title* copy*`); rf-accordion's card-face
family (`cardWash cardPad maxWidth framePad marginTop itemEdge itemHoverWash
name* head* lede* chevColor`); rf-media-copy `framePad`/`marginTop`/
`centered`; rf-callout-bar `eyebrowTracking`. Then: writing's mobile
clamps, sun-walk/starseed, and the pre-cutover eyeball pass Gio asked for —
**commit everything, then tell him BEFORE any switch; he looks first.**

### THE LEVERS, THE GUTTER AND THE FONT THAT NEVER LOADED — 2026-08-09 (items 4–6)

**The levers (item 4) are done, and the audit list was short by three.**
Rather than work from the list above, each entry's defaults block was diffed
against its own EditorPanel — 59 props across nine entries had no lever, and
three families the list had not named turned up: the font escape hatches on
rf-split-hero / rf-door-card / rf-offer-card, rf-site-footer's `focusColor`,
rf-hud-cards' `profile` mode missing from its own segmented control, and
rf-accordion items' image alt and CTA shape. Every added lever is empty/0/off
by default and every empty/0/off already falls back to the pre-knob render, so
no published row moved. `anchorId` stays panel-less — **no** entry in the
library exposes it; it belongs to the section shell. Mono `05c39515`.

**Writing's mobile deltas (−30 at 390, −56 at 768) were two causes, and only
one of them is ours to fix.**

**(a) The scrollbar gutter.** Her GlobalStyles carries
`html { scrollbar-gutter: stable }`. Pooling her pages left it behind, so every
pooled page of hers lays out **15px wider** than the same page on her app at
every viewport — measured body box 375 / 753 / 1425 on hers against
390 / 768 / 1440 on ours. Above a max-width that is invisible, which is why
1440 never showed it; below one it decides where text wraps, and at 390 it gave
her intro four lines (124px) and ours three (93px) — the whole −30. Now
`SiteBackgroundData.scrollbarGutter`, emitted by the one component that already
owns a site's global `html`/`body` rules, **site-scoped on purpose**: reserving
it fleet-wide would move four live customer sites 15px on any desktop with
classic scrollbars. Mono `27bac257` + `e9177704`, office `6f93bbc`.

> **It shipped inert the first time, and the lesson is now an assertion.**
> `asSiteBackground` NAMES every field it keeps, so a field added to the type
> and to the component still arrives `undefined`. That file's own comment
> describes this happening once before to the orbs' `width`/`height`. The check
> now walks the whole path — row → reader → emitted CSS — and writing it found
> a second inert rung: the first draft asserted against `render().html`, and a
> `createGlobalStyle` rule lands in the **sheet**, not the markup, so it would
> have passed on a page that reserved nothing. 354/354.

**(b) Cormorant Garamond — GIO'S RULING, and it is the same one that parks
pearl-chamber and home-classic.** Measured on her LIVE site, page by page:

| her page | elements asking for the serif | what actually renders |
|---|---|---|
| `/journey/` | 13 | **real Cormorant** — its own Google-Fonts `@import` |
| `/home-classic/` | **293** | the fallback |
| `/pearl-chamber/` | 28 | the fallback |
| `/writing/` | 24 | the fallback |
| every other page | 0 | — |

Her app declares Cormorant nowhere: `next/font` loads Inter, Playfair Display,
Space Grotesk, Space Mono and Ubuntu Mono, and `tokens.ts`'s
`SERIF = "'Cormorant Garamond', Georgia, serif"` resolves to the second name.
Her own code says so out loud — `layout.client.tsx` on the nav: *"its built-in
default ('Cormorant Garamond', Georgia) is never loaded here, so the nav had
been silently rendering in Georgia"* — and that session fixed the nav and left
the token. The pooled renderer ships the real face (`siteFonts`, self-hosted),
so her serif text is ~27% narrower than her live site's: `& reflections.`
measures 359px on ours and 457px on hers at the same size and weight.

So these pages can be faithful to her CSS **or** to her pixels, not both.

> **RULED — Gio, 2026-08-09: A. Keep the real Cormorant.** The source names it,
> `/journey/` proves the intent, and `siteFonts`' own doc comment was written
> for exactly this case. It is also already what the pooled renderer does, so
> the ruling changes no code — what it changes is the MEASURE. On `/writing/`,
> `/pearl-chamber/` and `/home-classic/`, the serif delta against her live app
> is now EXPECTED, and the aligned% on those three stops being a target. They
> are worked on their non-font deltas only, and they close when nothing but the
> typeface differs.

Marthe still gets the choice in her own words (the layperson question and the
before/after shots), and if she prefers her live look it is now a dropdown in
the Typefaces panel plus Publish — no deploy, no developer.

**sun-walk (item 6) is closed: 13.38% was one missing declaration.** The page
differed from hers in **no** colour, size, weight, margin, padding or gap — and
was 358px taller, drifting month by month until July sat 321px low. Every delta
was `line-height: normal` on her app against `25.6px` on ours: the week cards,
date lines and star lines declare none, so they take the host body's, which is
nothing on her app and 1.6 on the platform. The third page in this family after
the site footer (+19px) and the writing eyebrow (+7px). Declared on SunWalk's
`Page` and the dossier modal's `Shell` — what her app already computes, so
nothing moves there. Verified on the deploy: **her 4496, ours 4496.** Mono
`4224a5d7`.

**AND THE FIX MADE THE NUMBERS WORSE, WHICH IS HOW THE RULER WAS CAUGHT.** The
moment the pooled pages reserved the gutter — becoming geometrically identical
to hers, `develop`'s h1 at x 24.5 / w 688.2 on both sides — the whole board
drifted 1.5–4.4 points the wrong way, with **heights unchanged on every single
page**. Only the horizontal phase had moved. Her own live page, re-shot through
the same harness, needed a **−7px shift** to align with her own 2026-08-08
baseline (7.45% changed at shift 0, 2.33% at −7), on an app that had not changed
commit and still measured 4077px tall. That baseline was captured with the
gutter NOT reserved, so it was laid out at 1440 where her app lays out at 1425 —
and it was the only thing left in the old phase.

Re-frozen as `rw-her-app-2026-08-09` (fingerprints in `baseline/`), and two
guards so it cannot be silent again: `measurePage` records `layoutWidth`
(`document.body.clientWidth`, not the ICB, which stays 1440 either way), both
captures store it, and the differ collects an `outOfPhase` list printed ABOVE
the findings — *the ruler is wrong, not the pages; re-freeze, don't nudge
pixels.* Proven to fire on a doctored capture. HQ `274b79eb`.

**The board against the re-frozen ruler (1440, aligned%)** — every page back
within ±0.12 of its pre-gutter number, `outOfPhase` empty, and **sun-walk
13.38 → 0.05**: pearl-chamber 45.99 · home-classic 43.52 · **starseed 32.75** ·
experience-resonance-mirror 21.30 · experience-pearl-chamber 20.37 · home 7.55 ·
writing 6.80 · all-products 6.66 · galactic-pendulum-exp 6.23 · course 4.77 ·
receive 4.70 · the nine offer pages 1.94–4.61 · galactic-field-guide 3.92 ·
open-your-journey 0.52 · sun-walk 0.05 · journey n/a (structural).

**starseed (32.75%) is the one real page left, and it is a re-author, not a
tune.** Its row was authored early as generic `rf-media-copy` bands and never
given her seats: Space Mono absent entirely (26 elements → 0), 66 size / 60
weight / 60 colour mismatches, and 13 text runs missing. Her seats are in
`starseed/theme.ts` + `StarseedOraclePage.styles.ts` — eyebrow mono 11.5px
`.24em` copper `#c79a86` 500; H1 display 540 `clamp(2.65rem, 4.5vw, 4.4rem)`
lh 1.04 `#f5f9f8`; HeroAccent teal italic 440 `clamp(1.55rem, 2.6vw, 2.5rem)`
lh 1.08; P `#c4ccd0` lh 1.72; H3 520 lh 1.25 `#eef4f3`; FinePrint mono 11.5px
lh 1.65 `#9aa4ab` with `b` in copper 600; Section 80px/0 (60 at ≤900); Wrap
1120px with `clamp(32px, 5vw, 64px)`. The band eyebrow/title are the
`IntroEyebrow`/`IntroTitle` the star landing already uses, which the pooled row
did not point at.

### EVERY ATOM PICKS ITS OWN TYPE ROLE — 2026-08-09 (Gio's ruling)

Asked whether Option A would still be editable later, the answer was *half*:
the theme panel's Fonts group already offered all six roles, but its hint
pointed at a **"Fonts under Site Settings"** screen that had never been built.
Gio's ruling: **not** under Site Settings — self-serve in the EDITOR, and
*"every atom should be able to change its font."*

`TextSpec.font` — one of `display · heading · body · serif · mono · accent`, or
`""` for inherit. `TextSlotSpec` extends `TextSpec`, so every named run carries
it too: an offer card's price can be mono while its title is serif.

**A role, not a family**, and that is the design. A role is a pointer the theme
resolves and `siteFonts` actually loads, so a pick can only land on a face the
site really has — a typed family name is a wish, and naming one nothing serves
is precisely how a page silently renders Arial. `""` emits **no `font-family`
declaration at all** (not `inherit`, which would still outrank a host rule), so
every pre-2026-08-09 spec emits byte-for-byte what it always did — the fifth use
of the same back-compat mechanism after `gradient`, `states`, `textSlots` and
`shadows`, and the 39 existing pins prove it unchanged.

One `FontRow` in the shared Atomic Editor panel, so the Atom Library and the
Component Composer both get it from one definition. The drift guard grew
`fontFamily` (a NAMED family fails; `inherit` and `var()` pass) — a component
that hardcodes a face has taken the decision back off the editor, invisibly,
until someone re-themes.

**Proven on the deployed Office** (mono `5cb611bd` + office `a55e128`, authed
Playwright through the tgv.com UAT door): the Font row renders under Text with
all seven options; picking Serif put `font-family: var(--tgv-fontSerif)` on the
bench atom's own inline style, and it computed to Office's inherited stack
because Office defines no `--tgv-fontSerif` — which is the designed answer and
the proof that leaving the var fallback-less is right: on resonantweaver, where
that role IS defined, the same atom paints Cormorant. Set back to Inherit and
the declaration disappeared; the shared draft was left as found. 40/40 atom
tests, render-check 354/354, office tsc at its 66-error baseline. Only console
errors were the known employee-role 403s (uat@ is not an admin), which is
correct gating.

### AND THE TYPEFACE ITSELF IS SELF-SERVE — 2026-08-09 (Gio's ruling, second half)

The atom ruling left one operator-only step: a FACE was a `siteFonts` row
written by hand, so the six roles could only point at what an operator had
already loaded. Gio: *uploading a new typeface should be self-serve.* It is now.

**A Typefaces panel** sits under the theme's Fonts group — upload a file, name
the family, set weight/style/loading, remove. It rides `postChromeDraft` like
the theme and the nav, so faces land in the draft the Publish button promotes
and the rows Client Versions restores; **publish promotes theme and faces
together**, because a published role naming a family nothing loads is a role
that silently means Arial.

**The bytes are the guard, not the MIME type.** Browsers report the same woff2
as `font/woff2`, `application/octet-stream` or `""` depending on the OS and the
picker, so a MIME list wide enough to accept every real font accepts any binary.
`createUploadHandler` gained a `verify` hook that runs BEFORE the write, and
`looksLikeFont` reads the container tag (wOF2 / wOFF / OTTO / sfnt).
`application/octet-stream` stays OUT of the allowlist so the MIME check is still
a real first gate. 11 assertions pin it — a PNG, a zip and a script wearing font
extensions, and a woff2 uploaded as `.woff`.

**A QMBM carries what the form cannot:** that a typeface is TWO steps (load the
family, then point a role at it, and nothing moves until the second); that
Regular/Italic/Bold are three faces sharing ONE name, and getting that wrong is
why bold stops being bold; that `.woff2` is the file to want; and that the
webfont licence is the uploader's, because we host the file where any visitor
can download it.

**Proven on production** (mono `665e096b` + HQ `b98e506b`), via curl against the
live routes and authed Playwright in the live editor: a real woff2 uploads
**200** and serves as `font/woff2`; a PNG renamed `.woff2` is refused **415**
("not a valid .woff2"); an anonymous POST is **401**; `application/octet-stream`
is **415** at the MIME gate. A face written through the panel's own door reads
back exactly, and a `Break"Out` family — the injection shape the harness caught
once before — is dropped on the way IN while its valid sibling survives. The
panel renders with its upload button and its `?`, and the QMBM opens with the
two-step text. Test artefacts cleaned: the draft row set back to empty (the only
published `siteFonts` row is still resonantweaver's 8 faces) and the uploaded
file deleted from the bucket (`cdn` still serves it from a Cloudflare HIT until
it ages out). render-check 365/365.

**Per site since the same day.** Every face was landing in one shared
`fonts/` folder, so a bucket path told you nothing about whose asset it was.
Now `<project>/fonts/<site>/…` under the public prefix — the same `<project>/`
fold the editor's image route uses, so an audit reads one layout rather than
two. Not about collisions (the stamped filename already handles those): it is
that a customer's uploads should be listable, auditable and deletable as THEIR
set. The folder is the RESOLVED site, never a request field, and `safeSegment`
sanitizes each part while keeping the slash, so a slug cannot climb out.
No siteId (the house surface) lands under `fonts/house`. Verified live: a house
upload keyed `tgv/fonts/house/…`, a tenant upload `tgv/fonts/resonantweaver/…`;
both test objects deleted afterwards, prefix back to zero. HQ `642f40ce`.

### STARSEED, HALF-WAY — 2026-08-09 (and the half that's left is named)

**rf-media-copy learned her type** (mono `0f312b6a`) — a per-run family
(eyebrow / heading / copy) plus the accent line, every field defaulting to the
metric the entry shipped with so no published row moves (383/383 pins it,
including both heading scales and the 62ch column). **Roles are opt-in**: the
entry has never declared a family, and following the site's roles by default
would re-type every rf-media-copy row on the fleet at once. `""` emits no
`font-family` at all — not `inherit`, which would still outrank a host rule the
row never asked to beat — and a heading asking for a NON-heading role gets the
doubled class, rf-serif-head's lesson.

The **accent line is a shape, not a size**: `headingAccent` sits inside the
heading by default, but her hero is the other shape — she "separated the hero
heading from its teal italic accent line" in her own change log — so
`accentAsLine` makes it a sibling `<p>`. Carrying it inline would collapse two
elements she deliberately split.

Then her seats, seventeen new source guards deep (office `b765d2b`): the BANDS
take the star landing's IntroEyebrow/IntroTitle plus her Prose; the HERO takes
its own page-local type instead. Redriven to production, 19 rows, assertions
green.

**Measured: 32.75 → 32.59 at 1440** — and the small number hides the real
result, because the page is 9858px and the bands are a fraction of it. Read per
band, the approach is working and the remainder is somewhere else:

| band | now | what it is |
|---|---|---|
| space to explore · what begins to make sense · who this is for | **9.7–10.6%** | pure `rf-media-copy` — DONE |
| your hybrid starseed lineages | 18.35% | band + the PullQuote (authored as an emphasised paragraph; hers is 28px display copper) |
| hero | 32.32% | band + artwork + CTA + FinePrint |
| your birth sky · a wider astrology | 34–36% | band + the method cards / the currents list |
| inside your journey (2105px, the biggest) | 38.26% | `rf-offer-card` — the braid stages |
| your journey begins here | 40.81% | `rf-offer-card` — the closing callout |
| how it works | 49.18% | `rf-offer-card` — the numbered steps |

**So the next unit is exactly one entry: `rf-offer-card` needs the same type
family**, and it carries four of the six worst bands. The census names the
seats it is missing — `BraidStageNumber` is Space Mono 12.48px copper and
renders Space Grotesk 10.24px teal; the card titles run 28.8px where ours run
31.2. After that: the PullQuote (her `PullQuote` is its own block, not an
italic paragraph), `rf-list` for the eight currents, and the hero's FinePrint.

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

### STARSEED'S OTHER HALF — 2026-08-09 (32.75 → 19.32 at 1440)

**Three of the four grids were never offer cards, and reading her page rather
than her prose is what said so.** `/starseed/` mounts two SHARED components and
one local one:

| band | was | is | her source |
|---|---|---|---|
| inside your journey (2105px) | rf-offer-card 38.26% | rf-hud-cards **23.99%** | `BraidJourney` → BraidStages / BraidStage on her `hudSurface` |
| how it works | rf-offer-card 49.18% | rf-process-steps rail **11.10%** | `<TrainingStep>` in her `Steps`, left rule + per-row cells |
| your journey begins here | rf-offer-card 40.81% | rf-callout-bar **11.95%** | `<CalloutBar variant="gateway">` |
| the method cards | rf-offer-card ~35% | rf-hud-cards **35.19%** | her `Cards` / `Card`, same material |
| hero | 32.32% | **15.23%** | HeroGrid, 1.05fr of copy |

Every one of those entries had ALREADY been derived from those files during the
family pass. rf-hud-cards' own header records the same mistake for her gateway
grids — *"the first family cut authored these grids AS rf-offer-card and the
differ called it"* — and starseed made it again, on a page written before that
lesson landed. **The question that finds this class of bug is not "does the
entry have the right knobs" but "what component does her page mount".**

**What the entries had to learn** (mono `8f0532cc`, `842e3a15`, `4a04ab82`,
`9294429d` — every field ""/0 ⇒ the pre-knob render, four pins say so):
rf-hud-cards gained a card floor, a stated marker gap that replaces the gateway
card's float, copy in BOTTOM margins (her `P` is `margin: 0 0 16px` and the
trailing gap under the last line is part of it — a top margin cannot say that),
multi-paragraph copy in door and tile (profile already split), and a lone last
card centering on one track at her own `calc(50% - 0.625rem)`. rf-process-steps
gained `stepsTop`, for a headless rail that still opens below a band of its own.

**TWO LEVERS WERE WIRED TO NOTHING, and only the measure found them.**
`copyColor` reached the PROFILE card and no other — her stages author `#c4ccd0`
and rendered the muted role, so the knob read as present and did nothing. And
`imagePosition: "right"` gave the IMAGE the wide column: `40% 60%` has always
meant media-narrow/copy-wide, but the sides were swapped with `order`, and order
is what grid auto-placement reads. **Five published rows were rendering that
way** — giocoelho's `fitness` and both recipes, refusionist's recipe, and her
own starseed hero, whose copy column measured 397px against her 491 and ran the
band 182px tall for it. Fixed for everyone, named rather than shipped quietly.

**AND THE WHOLE PAGE WAS THE WRONG WIDTH.** Her `Wrap` is 1120 with
clamp(32px, 5vw, 64px) sides — a 992px column at 1440, where the frame's default
is 1100. Every band had been 108px wider than hers, which rewraps every
paragraph before a single type value is compared. rf-media-copy took a
`maxWidth`; the page is one width now, hers.

Office `14e2b79` + the hero/fineprint seats: twenty-four new source guards over
her theme, her page styles and both shared components. Redriven ×3, 19 rows,
assertions green each time. HQ deployed at `9294429d`.

**LEFT ON THIS PAGE, in size order:** the eight currents (35.63% — her
`CurrentsGrid` is a 2-up grid of hudSurface rows with a coloured dot, and it is
authored as a flat `rf-list`; same shape of finding as the four above); the
method cards (35.19% — the entry is right now, the remainder is not yet read);
the PullQuote (18.12% — her `PullQuote` is its own blockquote, 28px display
copper italic, ruled top and bottom, currently an emphasised paragraph); and her
`Or` line, which is a 13.5px sentence with a teal link inside it and has no
grammar in `parseInline`.

**Board (1440):** pearl-chamber 45.99 · home-classic 43.52 (both parked on
Cormorant A, which unparks them for their NON-font deltas) · experience-
resonance-mirror 21.30 · experience-pearl-chamber 20.37 · **starseed 19.32** ·
home 7.55 · writing 6.80 · all-products 6.66 · offers 1.94–4.61 ·
open-your-journey 0.52 · sun-walk 0.05.

---

## THE CURRENTS AND THE PAGE FRAME — 2026-08-09 (19.32 → 11.18 at 1440)

Two findings, and the second was the bigger one by a factor of four.

**The eight currents were a list of her cards.** `CurrentsGrid` is eight
`hudSurface` rows two across — a lit 13px dot beside a family name and one
essence line — and the pooled row said `rf-list`. Same shape of finding as the
four grids the window before: a list is not the material she wrote, and no
number of type levers on a list turns it into a card. It became `rf-hud-cards`
mode **`row`** (mono `db5c5f1f`), the fourth layout of the one material, derived
from CurrentRow/Dot/Name/Essence — and her own file says why it belongs to this
entry rather than a new one: its hudSurface holds *"the same values as the
landing-star hub's shared card surface … so every card on this page reads as one
system"*.

The dot's colour rides the **item** (`dotColor`), because that is the band's
whole point — each current wears the WCAG-checked accent the starseed package
paints that family in, and a section-level colour would flatten eight into one.
The name renders as a **div**, as hers is: these are the rows of a grid, not the
headings of a page, and a heading here would also have to fight
`[data-site-theme] h1…h6` for its face. Measured after: the row is her box to
the pixel — 489×106 at the same x, same padding, same gradient, same shadow,
same dot, same type, same paint on both sides.

**AND THE ROW BEING EXACT IS WHAT EXPOSED THE FRAME.** With nothing left to
blame inside the card, the band was still 31px out — and the probe put 144px
between her prose and her grid where she has 40. Two causes, both structural:

1. **Her page frame is not on the scale.** Every Section and Band on the page is
   `padding: 80px 0` (60 under 900). The pooled rows wore `lg` — 88 desktop, 52
   mobile — so all eleven bands ran 8px tall and then 8px short.
2. **A logical section split across two pooled rows double-counts.** Her stars
   Section holds the prose AND the grid, so its 80px closes BELOW the grid. Ours
   is a head band plus a grid band, so the head's 88px bottom pad landed in the
   middle where she has nothing, and the close under the grid went missing:
   **128px in the wrong place, on all four of this page's grids.**

`RfSection` grew `padTop`/`padBottom` and rf-process-steps grew `marginBottom`
(mono `911f8b7d`); the four heads close at `0` and the four grids carry the
section's close as their own bottom margin, which cannot collapse with the next
band's padding, so her 80 + 80 between sections survives. `PAGE_PAD` is
`clamp(60px, 7.8vw, 80px)` — the single-value form of her step, since hers
breaks at 900 and the shared frame breaks at 768; it lands on HER number at all
three measured widths.

**The first draft of the override was a bug the assertion caught before any
capture.** It appended `padding-top:` after the shorthand — which beats the flat
rule and LOSES to the mobile media query, where the whole shorthand is restated.
It would have held on a desktop and been silently taken back on a phone. The
value is composed INTO the shorthand now, so there is one declaration to win;
a row that states neither still emits the two-value form byte for byte, pinned
both ways. render-check 414/414.

**Measured (1440), band by band:**

| seg | | before | after |
|---|---|---|---|
| 2 | responsive | 10.46 | **5.01** (496 → 496) |
| 3 | recognition | 9.73 | **5.62** |
| 4 | braid stages | 23.99 | **12.37** |
| 5 | the eight currents | 24.18 (35.63 before the row mode) | **6.06** (1058 → 1057) |
| 6 | method cards | 35.36 | **20.05** |
| 7 | how it works | 10.96 | **6.77** |
| 8 | audience | 9.45 | **6.16** |

**starseed 19.32 → 11.18% at 1440, +199px → −37px.** 390: 29.01 → 22.75.
768: 33 → 31.35 (its hero is the outlier there, +234px — a stacking question the
1440 capture cannot see).

**LEFT ON THIS PAGE, in size order at 1440:** the method cards (20.05, −61px —
**and 46px of that is her three card glyphs**, 30px stroke-only line icons with
16px under them, drawn inline in her page file and deliberately left behind by
the first cut; carrying them needs an item-level glyph on rf-hud-cards, masked
rather than `<img>`'d so the teal stays a knob); the lineage band (18.21, −113px
— the PullQuote, her own blockquote at 28px display copper italic, ruled top and
bottom, currently an emphasised paragraph); the hero (15.23); the begin block
(11.91). And her `Or` line still has no grammar in `parseInline`.

Also unmeasured and unpainted: her `Band` (four of the eleven) carries a 1px
`rgba(255,255,255,0.09)` hairline top and bottom over a 3% teal gradient. The
wash is below the differ's tolerance and effectively below the eye's; the
hairlines are two real rows of pixels per band and have no knob yet.

**Board (1440):** pearl-chamber 45.99 · home-classic 43.52 (both parked on
Cormorant A) · experience-resonance-mirror 21.30 · experience-pearl-chamber
20.37 · **starseed 11.18** · home 7.55 · writing 6.80 · all-products 6.66 ·
offers 1.94–4.61 · open-your-journey 0.52 · sun-walk 0.05.

---

## THE GLYPHS, THE BLOCKQUOTE AND THE HERO — 2026-08-09 (11.18 → 9.01 at 1440)

Three units in one window, each the same shape of finding: a thing her page
states that the entry had no way to say, and a first cut that rendered
something adjacent instead.

| band (1440) | before | after | height |
|---|---|---|---|
| seg 0 hero | 15.23 | 15.06 | 1203 → 1184 (hers 1159) |
| seg 1 lineage | 18.21 | **6.02** | 791 → 901 (hers 904) |
| seg 6 method cards | 20.05 | **7.74** | 773 → 830 (hers 834) |

Page: **1440 11.18 → 9.01 · 768 29.13 → 24.29 · 390 21.07 → 19.45.**
Hero at 768 alone: **41.66 → 25.72**, +234px → −58px.

### The glyphs — masked, not `<img>`'d

Her three method cards each open on a 30px stroke-drawn line icon in the theme
teal. `RfGlyph` is shared (any entry can wear one) and paints by MASK: an
`<img>` carries the drawing and LOSES the colour — baked into the file, so a
tenant recolouring the section leaves the glyph behind and a second accent
needs a second copy of the same artwork. A mask keeps the drawing in the URL
and the paint in `background-color`, which is a knob. That is the whole reason
a glyph belongs to the editor and not to a hardcoded icon set. The URL is a
`data:image/svg+xml` URI, so there is no asset to ship and no `public/` 404
window.

**The generator EXTRACTS `CARD_ICONS` rather than transcribing it.** Every
other value on this page is one we read and re-state, and `verbatim` can guard
a value; path data is a *drawing*, and a drawing re-typed drifts silently —
the differ reports a few hundred pixels and names nothing. Parsed, it follows
her redraws. The conversion is the part with teeth: React attribute spellings
become SVG's own, and any camelCase attribute that survives fails the run,
because a browser IGNORES `strokeWidth` in a real SVG file — a hairline glyph
would arrive at a 1px default stroke with square caps and nothing would say so.
`viewBox` and its camelCase-by-spec siblings are named, not banned.

**And the glyph rides the baseline.** Everything matched but 12px: hers is an
inline `<svg>` in flow, so the card's own descender space falls UNDER it. She
declares 16px; the seat measures 25px. Carrying 25px would make her 16px a lie
and drift the moment the card's face changes, so the MECHANISM is carried —
`display: inline-block` — and `iconGap` stays her literal value.

Also here: her `Card` rule restates the p's size and colour and NOT its
line-height, so the copy keeps `P`'s own 1.72 rather than the stages' 1.68.

### The blockquote — and why it is not its own entry

Her `PullQuote` is a real `<blockquote>`: 34rem centered on a band far wider,
ruled top and bottom, copper, serif italic at clamp(1.25rem, 2.35vw, 1.75rem)
/1.42, each line its own block because she breaks them herself. It was authored
as two emphasised paragraphs, which is why that band ran 113px short with every
word in place.

It belongs to `rf-media-copy`, not to an entry of its own, because it lives
inside her one `Section` with the paragraphs above it — **a second pooled row
would carry a second frame, and a logical section split across two rows
double-counts its padding.** That is the trap the page-frame pass caught on
four grids; not repeating it is the point.

TWO coppers, deliberately not collapsed: the words wear her theme's own
`copper` literal (#c79a86), the hairlines wear `pullQuoteBorderRgba` — the
COPPER token at 0.34 (#b78a77).

### The hero — three findings, one of them invisible at 1440

1. **Chips are not a fine print.** Her hero closes on one 11.5px mono line
   UNDER the button — what the price buys. The first cut split it on its
   interpuncts into three chips ABOVE the button: a different sentence, in a
   different place, in a different face.
2. **Her figure is capped at 31rem and unframed.** At 1440 the grid track IS
   the cap, so it looked right; at 768 ours ran 709px against her 496 and
   pushed the hero down 277px. **The 1440 capture could not see it** — which is
   why the rig shoots three widths, and the reason to read the 768 column even
   when 1440 is green. The 16px radius over a 22%-accent hairline is right
   round a photograph in a card and wrong round a cut-out PNG on a sky; both
   are escape hatches now (`"0"`, `"none"`) defaulting to the old frame.
3. **Her Hero is its own frame** — 116px above (the fixed nav's clearance, her
   own comment says so) and 56px below, not a rung of any scale. Her ≤900 step
   to 104px is NOT carried: a stated pad holds at every width, her break is 900
   and the shared frame's is 768, so honouring it would cost a second knob to
   move 12px at one viewport.

`RfCtaDef.padX` came with it — her PrimaryButton is the ritual plate WIDENED to
`padding-inline: 1.35rem`, which is geometry and cannot ride `size`. The six
per-CTA overrides a row could state and the studio could not (variant, font,
size, weight, tracking, colour) got their levers at the same time.

**A number that got worse and should have:** seg 0 reads 15.06% at 1440 against
14.23% before the frame fix, while being 4px closer in height. Our hero column
is 25px taller than hers (1012 against 987); starting 28px too high used to
cancel part of that in the middle of the column. Two errors cancelling is not
parity, and the honest frame exposes the real one.

### Left, in order

- **seg 5 the braid stages at 768: 51.94%, 2246 → 2603 (+357px)** — the largest
  single band on the page at any width, and 1440 sees only 12.37% of it.
- **The hero's remaining 25px of column height** (1012 vs 987), measured.
- **seg 10 the begin block, 11.91 → 11.76%, 783 → 850.**
- Her `Or` line — a 13.5px sentence with a teal link inside it; `parseInline`
  has no grammar for inline links.
- Her `Band` hairlines — four of eleven bands carry a 1px rgba(255,255,255,0.09)
  top and bottom over a 3% teal gradient; the wash is below the differ's
  tolerance and the hairlines have no knob.
- pearl-chamber 45.99 + home-classic 43.52 — unparked by Cormorant A, NON-font
  deltas only. doors/experiences ~20% — Gio's eye.
- Then: **tell Gio "come look", his eyeball pass, then the flip.**

Commits: mono `96c9fa22` (glyph) · `861d8c86` (baseline) · `69bf93f6` (pull
quote) · `5f170049` (hero). Office `cf07bb1` · `4a883f7` · `7e47bbe` · `26be946`.
HQ deployed four times, RCS built nothing each time; render-check 435/435;
`02-pages.sql` redriven to production five times, 17 published rows each.

---

## THE BREAKPOINTS — 2026-08-09 (768: 24.29 → 15.88)

One finding, four times over: **a breakpoint the entry hardcodes is a breakpoint
no tenant can state**, and her starseed page has four of them.

| | 1440 | 768 | 390 |
|---|---|---|---|
| start of window | 9.01 | 24.29 | 19.45 |
| **now** | **8.21** | **15.88** | **17.64** |
| page delta | +85px | −70px | +91px |

| band | before | after |
|---|---|---|
| seg 5 braid stages @768 | 51.93 · 2603px | **20.07 · 2232** (hers 2246) |
| seg 0 hero @1440 | 15.06 · 1184px | **8.36 · 1158** (hers 1159) |
| seg 0 hero @768 | 18.09 | **12.74** |

### Her four breakpoints, and the two knobs that carry them

Her page stacks its BraidStages at **720**, its Cards and CurrentsGrid at **900**,
and steps its Hero's top pad at **900**. The door mode hardcoded **800** and the
shared section frame hardcodes **768** — so the entry could not reach any of them.

At 768 that one number *was* the braid band: hers still two-up, ours already
stacked, 2246px against 2603.

- `rf-hud-cards.stackAt` — 0 ⇒ the mode's own (door and profile 800, tile 780,
  row 900).
- `RfSection.narrowAt` + `padTopNarrow` / `padBottomNarrow` — the page-frame pass
  had already named this cost in its own comment ("a stated pad holds at every
  width"); now a frame can step, and step at ITS OWN width. Each narrow side
  falls back to its wide value, so one stated pad still holds at both.

**Her stage card also swaps padding at 900 while its grid stacks at 720** — two
independent widths in one component. `cardPadAt` is therefore its own knob and
merely falls BACK to the stack point. Collapsing them would be a guess wearing a
measurement's clothes.

The method cards' 900 changes nothing at 1440, 768 or 390 — it is wrong only
*between* 768 and 900, which the rig does not shoot. Authored anyway: **the rig
is a sampler, not the definition of correct.**

### And three hero values that were the wrong shape

- **`copyTop` was pushing the whole column.** Her `Copy`'s 1.25rem is above the
  PROSE, and it collapses into the accent line's 1.8rem bottom margin at every
  width — so the knob was adding 20px her hero has never had. The bands still
  state it, because there the column IS the prose.
- **The shared `CtaRow`'s 22px/12px are a default, not her values.** Hers is
  gap 14px and no margin: the last paragraph's own 16px bottom is already the
  gap, and 22px collapsing over 16 is 6px more. `ctaTop` / `ctaGap`.
- Both now measurable: hero 1184px → **1158** against her 1159.

### Left, in order

1. **seg 6 the currents at 768/390 — 21.62 / 16.43%** (1354 → 1330, 1553 → 1572).
   The worst band at 768 now.
2. **seg 4 the braid at 390 — 23.08%** (3687 → 3725) and **seg 5 at 390 19.91%**.
3. **seg 2 at 768 — 17.34%** (469 → 441), the responsive band.
4. **seg 10/11 the begin block — 11.76% at 1440** (783 → 850).
5. Her `Or` line — 13.5px with a teal link inside it; `parseInline` has no
   grammar for inline links. The differ names it at every width.
6. Her `Band` hairlines — 1px rgba(255,255,255,0.09) top and bottom over a 3%
   teal gradient on four of eleven bands; the wash is under tolerance, the
   hairlines have no knob.
7. pearl-chamber 45.99 + home-classic 43.52 — unparked by Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
8. Then: **tell Gio "come look", his eyeball pass, then the flip.**

Commits: mono `30fb38a6` (stackAt + cardPadNarrow) · `0d2efc4d` (ctaTop/ctaGap) ·
`54f1f350` (RfSection narrowAt). Office `d52de0d` · `0633bcf`. HQ deployed three
times, RCS built nothing each time; render-check 444/444; `02-pages.sql` redriven
three times, 17 published rows each.

---

## THE PAGE GUTTER — 2026-08-09 (768: 15.88 → 11.94 · 390: 17.64 → 15.03)

**The finding is one value in thirteen places.** Her whole starseed page is laid
out by ONE `Wrap`: `max-width: 1120px; padding: 0 clamp(32px, 5vw, 64px)`,
stepping to a flat `22px` under 640. Ours hardcoded `min(100% - 3rem, Xrem)` in
twelve entries and a per-rung horizontal value in the shared section frame —
24px a side, which is right at no width she uses. At 768 hers is 38.4 and every
band of ours laid out 29px wider, with the text inside rewrapped.

Measured on the currents grid, where it was the *whole* of the band's delta: her
column is 608px and ours was 637, so her sixth row wrapped to two lines and ours
did not. After: **676×789 against her 676×789 at 768, row heights identical**;
331×1151 against 331×1151 at 390. seg 6 **21.62 → 8.60%**.

**So it became a mechanism, not a knob.** `--rf-gutter` is declared on the body
and inherited; every consumer reads it with **its own old literal as the
fallback** (`1.5rem` for the wraps, `1rem` for a door row, the rung's `h` for the
frame), so an unset page renders the pixels it rendered before. `rf-page-tone` —
the only page-level entry there is — states it once and every band on that page
obeys, *including entries written before the variable existed*. A knob would have
had to be authored on eleven rows and re-authored on the twelfth somebody adds.

A tone row may now carry ONLY a gutter: the paint half stayed conditional, so
stating an edge does not blank the body or hide the site backdrop. That is what
her starseed page needs — her own wash is the fixed `Sky` the backdrop paints.

**And it is a starseed fact, not a site one.** Her twelve detail pages, the
landing hub and `/writing` all use `min(100% - 3rem, 86rem)` or a `1.5rem`
container — the literal the entries already carry. Read from her source, guarded,
and authored on exactly one row (`sec-ss-gutter`). Verified live: two
`--rf-gutter:` declarations on `/starseed/`, zero on her other pages and zero on
giocoelho, guardians, nevlo and refusionist.

**Trap avoided:** the first cut authored it on `sec-star-tone`, which belongs to
the **landing hub**, not the starseed page — the probe caught it (no `flow-root`
in the served `/starseed/` html at all) before the number was believed.

## THE HERO'S STACK — 2026-08-09 (seg 0 at 768: 12.64 → 11.00)

Three more things her hero states that the entry could not.

**The grid's media query hardcoded both of its numbers.** `@media (max-width:
768px) { gap: 22px }` — so between 768 and 900 ours was still two columns where
hers had stacked, and on every phone the 22px **silently took back** whatever
`mediaGap` the row had stated. Her HeroGrid stacks at **900** and opens to a
**flat 40px** there (the clamp is the desktop value only). Now `stackAt` and
`mediaGapNarrow`, both defaulting to what the entry drew.

**`eyebrowLh`** — the fifth page in the inherited-line-height family. Her Eyebrow
declares none and inherits her `Page`'s 1.68; ours inherited the platform's 1.6.

**`RfCtaDef.sparks`** — her `PrimaryButton` extends `RitualButtonAnchor`, the
BARE plate. The four-point star is `RitualButtonStar`, a sibling component her
callers mount when they want one, and this one does not. Ours drew two
unconditionally: **220px of button against her 177**, and a decoration on a page
that never asked for one. Empty ⇒ the pair, so no published ritual CTA moved.

### Board after both (starseed, aligned)

| | 1440 | 768 | 390 |
|---|---|---|---|
| before | 8.21 | 15.88 | 17.64 |
| after | **8.20** | **11.94** | **15.03** |

1440 is unmoved by design — her 62rem cap already won there.

### Left, in order

1. **seg 5 the braid at 768 — 17.91%** (2246 → 2259) and **seg 4 at 390 —
   ~20%**. The worst band at both narrow widths now.
2. **seg 11 at 768 — 14.15%** (732 → 778, +46px), the begin block.
3. **seg 1 — 11.82% at 768** (799 → 796) and **seg 0 — 11.00%** (1494 → 1485).
4. Her `Or` line — 13.5px with a teal link inside it; `parseInline` has no
   grammar for inline links. The differ names it at every width.
5. Her `Band` hairlines — 1px rgba(255,255,255,0.09) top and bottom over a 3%
   teal gradient on four of eleven bands; the wash is under tolerance, the
   hairlines have no knob.
6. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
7. Then: **tell Gio "come look", his eyeball pass, then the flip.**

---

## THE PAGE'S RHYTHM, AND THE 20px UNDER THE HEAD — 2026-08-09

**1440 8.20 → 5.05 · 768 11.94 → 8.08 · 390 15.03 → 9.73.** The single biggest
move this page has made, and it came out of one ledger rather than one band.

The braid was the named next unit and the braid turned out to be innocent. Every
value in it already matched hers — the two-up grid at 720, the 28px/8px stage
padding, the last odd child centered on `calc(50% - 0.625rem)`, the wash, the
shadow, the h3's 480 at her clamp, the copper marker at 0.78rem/0.2em. The grid
measured 2022px against her 2026 and 3433 against her 3440. So the 17.91% was
not the braid; it was the band ABOVE the braid, and then the same thing on every
other band of the page.

### Finding one — her page reads at 1.68, ours at 1.60

Her `Page` root declares `line-height: 1.68`. Ours inherits the platform's 1.60.
A ratio sweep of every text run on the page — same string, same tag, both sides —
named six classes where hers is 1.68 and ours 1.6:

| run | size | entry |
|---|---|---|
| band eyebrows | 10.88px | rf-media-copy |
| braid stage numbers | 12.48px | rf-hud-cards |
| "how it works" step markers | 11.2px | rf-process-steps |
| the closing eyebrow | 10.72px | the begin block |
| a price | 16.8px | rf-hud-cards |
| a CTA arrow | 10.88px | RfCta |

One pixel each, seven bands, and every band below the first shifted by the
accumulation — which is why bands whose values all matched still diffed at 8–14%.
Answering it per entry is six knobs on four entries and a seventh the day
somebody adds a run. It is the `--rf-gutter` argument verbatim, so it took the
same shape: **`rf-page-tone.lineHeight`, declared on the body, inherited by every
run that states none.** Runs that state their own (the fixed nav, the footer,
every paragraph carrying `copyLh`) do not move — measured, not assumed.

Injected against the deployed candidate before writing a line of it: +19px over
the page, the braid grid landing on her **2026px exactly**, nav and footer
unmoved. That experiment is why there is no `markerLh` knob in this commit.

### Finding two — her 1.25rem is a gap under the head, not above the column

Her `Copy` is a **wrapper round the prose** carrying `margin-top: 1.25rem`; the
eyebrow and the h2 are its siblings, not its children. Ours has no wrapper, so
the value was transcribed onto the copy COLUMN — which holds the head too. All
20px landed above the eyebrow and the words sat touching the h2:

```
her   sec 1494 → eyebrow 1555 (pad 60)   h2 1589   prose 1636  (h2 + 20)
ours  sec 1485 → eyebrow 1565 (pad 60+20) h2 1598   prose 1626  (h2 + 1)
```

Every head on the page opened 20px low with the prose 20px tight, and the two
head-only bands — her journey intro and her "How it works" — grew 20px of air she
has never had (our journey-head band was 141px where her whole head is 121).

`proseTop` is the gap under the head: the first paragraph's own margin, and
nothing at all when there are no paragraphs. `copyTop` keeps its meaning for the
fine-print row, where the column really is the prose.

**The hero's own comment had already found half of this and drawn the wrong
conclusion** — it took the column knob off the hero because "her Copy's 1.25rem
sits above the PROSE, not above the eyebrow", and then left it on the bands
"because there the column IS the prose". It is not: the band column carries the
eyebrow and the h2 as well. A correct observation, applied one row too narrowly.

### Also learned, and worth keeping

Her page has **fifteen `Reveal` blocks** — `opacity: 0; translateY(20px)` until
an IntersectionObserver fires. A probe that scrolls in 400px steps at 40ms does
NOT fire them, so an un-settled probe reads every head 20px low and reports a
transform as geometry. `settle()` (0.8×viewport, 60ms) does fire them, and the
baseline PNGs are correct — verified by cropping her capture at the journey head
and looking at it. **Probe through `settle`, or measure her animation instead of
her page.**

### Board (starseed, aligned)

| | 1440 | 768 | 390 |
|---|---|---|---|
| the gutter + the hero | 8.20 | 11.94 | 15.03 |
| after this | **5.05** | **8.08** | **9.73** |

The braid: 768 17.91 → **8.94** (2246 → 2243) · 390 20.40 → **8.55** (3687 →
3685) · 1440 12.37 → **4.61**. The box census fell 20 → 5 at both narrow widths
and 19 → 2 at 1440.

Scope proven live: `line-height` and `--rf-gutter` appear on `/starseed/` and on
nothing else — rw `/`, rw `/writing/`, giocoelho, guardians, nevlo, refusionist
and the apex all declare neither. home (7.55), writing (6.80) and sun-walk (0.05)
re-measured identical at 1440.

### Left, in order

1. **The begin block** — the worst band at every width now: 1440 11.72% (783 →
   853, **+70px**), 768 13.91% (732 → 782, +50), 390 11.84% (1038 → 1047, +9).
   Her `Section` there carries `padding: 53.76px` with `margin: 96px 24px 0`;
   ours is `padding: 0` with `margin: 96px 0 0`.
2. **The hero** — 1440 7.73%, 768 11.00% (1494 → 1485), 390 15.92% (1734 →
   1725). Consistently ~9px short at every width.
3. Her `Or` line — 13.5px with a teal link inside it; `parseInline` has no
   grammar for inline links. The differ names it at every width.
4. Her `Band` hairlines — 1px rgba(255,255,255,0.09) top and bottom over a 3%
   teal gradient on four of eleven bands; the wash is under tolerance, the
   hairlines have no knob.
5. `tag 15` — her braid stage number is a `<span>`, ours a `<p>`; her step
   markers likewise. Invisible to a pixel diff, named by the text census.
6. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
7. Then: **tell Gio "come look", his eyeball pass, then the flip.**

---

## A SENTENCE CAN BE A LINK — 2026-08-09 (1440 5.05 → 4.28 · 768 8.08 → 7.78)

The closing block was the worst band at every width and it was two lines, both
unauthorable.

Her `#begin` div closes with `<Or><a href={mailto…}>{direct}</a></Or>` then
`<Footnote style={{maxWidth:720, margin:"2rem auto 0", textAlign:"center"}}>`.
The `Or` is **13.5px of prose whose whole run is a link** — teal, no underline,
centred, 20px under the callout. Ours rendered it as a `RfCtaDef`, because a
CTA was the only thing that could carry an href: **51px of plate against her
23px of sentence, and under the disclaimer rather than above it.** The
disclaimer meanwhile ran five lines against her three — a 62ch box parked at the
column's left where hers is a 720px box centred in the 992 column, at 1.65
against her inherited 1.68.

Three package changes, all empty by default:

**`parseInline` gains `[text](href)`** — every entry that renders prose gets
links inside sentences at once. The destination is **allowlisted** (http(s),
mailto, tel, a site path, an anchor), not scheme-blocked: a parser that has to
enumerate what is dangerous is a parser that will one day miss a scheme. Anything
else stays literal text. Off-site links open away with `rel`. The anchor is
emitted **bare** so no entry inherits a browser blue it never asked for.

**`linkColor` / `linkDecoration`** on rf-media-copy — the host's half of that
bargain, and the only reason a bare anchor is safe.

**`proseCenter`** — `margin-inline: auto` on the paragraphs, composed INTO the
margin shorthand rather than appended after it. A centred column is not a centred
box, and the difference is invisible until the box is narrower than the column.

The row split in two (`sec-ss-direct`, `sec-ss-disclaimer`) because one
`paragraphs` array cannot carry two type treatments. Both greys are pinned to her
theme by `verbatim` — `muted: #9aa4ab` and `faint: #6b7980` are different greys
and collapsing them would have been a quiet recolour.

**Closing band: 1440 11.72 → 2.62% at 783px against her 783 exactly** · 768
13.91 → 9.96 (732 → 711) · 390 11.84 → 11.42 (1038 → 1017).

### Board (starseed, aligned)

| | 1440 | 768 | 390 |
|---|---|---|---|
| the gutter + the hero | 8.20 | 11.94 | 15.03 |
| the rhythm + the head | 5.05 | 8.08 | 9.73 |
| the closing lines | **4.28** | **7.78** | **9.70** |

The box census at 1440 is down to **1**.

### Left, in order

1. **The hero** — the worst band at every width now: 1440 7.73%, 768 11.00%
   (1494 → 1485), 390 15.92% (1734 → 1725). Consistently ~9px short.
2. **768 and 390 in the closing block** — 9.96% / 11.42%, and ours is now 21px
   SHORT at both. Her `Section` there carries `padding: 53.76px` with
   `margin: 96px 24px 0`; ours `padding: 96px`, `margin: 0 152.5px`.
3. Her `Band` hairlines — 1px rgba(255,255,255,0.09) top and bottom over a 3%
   teal gradient on four of eleven bands; the wash is under tolerance, the
   hairlines have no knob.
4. `tag 15` — her braid stage number is a `<span>`, ours a `<p>`; her step
   markers likewise. Invisible to a pixel diff, named by the text census.
   `weight 7` and `color 2` are the rest of the census.
5. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
6. Then: **tell Gio "come look", his eyeball pass, then the flip.**

---

## THE DESCENDER UNDER HER FIGURE, AND TWO COLOURS — 2026-08-09

The hero was the worst band at every width and consistently ~9px short. It was
one declaration she never wrote.

### 8.875px of nothing

Her hero figure is a `next/image` whose inline style names width, height and a
31rem ceiling and **not `display`** — so it computes to `inline`, rides its
wrapper's baseline, and the strut's descender is held under it. Measured on her
live page: **8.875px, identical at 1440, 768 and 390** (her wrapper's 26.88px
line box = her page's 1.68 at 16px, in Space Grotesk). Ours is a block `img` and
held nothing.

That was the whole remaining delta, and it presented as two different bugs:

- **stacked** (768, 390) the wheel row was 8.8px short, so the copy column began
  8.8px high and the whole band ran short — 1494 → 1485, 1734 → 1725;
- **side by side** (1440) the two band heights matched *exactly* and the figure
  still sat 4.5px low, because `align-items: center` split the difference.

`mediaSpaceBelow` states it on the media **cell**. Not the grid gap, which also
opens between the columns; not padding on the `img`, which would sit inside a
frame this row has turned off. Stated as a value rather than reproduced as inline
layout: the number comes from her font's metrics, and a customer's uploaded
photograph should inherit no descender it never asked for. The guard is her
`display`-less style — state a display there and the value has to come out.

**Hero band: 1440 7.73 → 3.73% · 768 11.00 → 5.75% (1494 → 1494) · 390 15.92 →
7.66% (1734 → 1734).** Every height exact.

An inline-image census across seven of her routes found this on the starseed
hero and nowhere else — her other figures are blocks with frames of their own.

### Her plate rests copper and only hovers teal

`ritualButtonCss` hardcodes `color: rgb(COPPER)` at rest for every ritual button
on her site and moves to `--button-hover-rgb` on hover, which her starseed
`PrimaryButton` — and only that button — sets to TEAL. Ours rested on the
section's accent and hovered to its amber. **On her copper-accented offer pages
the two coincide**, which is why this stood through nine deploys; on the
teal-accented starseed page they are exactly swapped, and her copper button
rendered teal.

`cta.color` already existed for the plate and monolink variants and now reaches
the ritual plate — the same statement one rung down. Her button is *built* out of
that colour, so it carries the hairline at 22% and the gradient's top stop at 7%
with it: a knob that moved only the word would have left a teal frame round a
copper one. `hoverColor` is the second, independent statement. No published row
carries a colour on a ritual CTA, so widening it moved nothing.

### Her nav never marks the current page — and the reason is the `/en/`

PillNav paints the link matching `usePathname()` in bone at 94%. On her own app
that branch has **never once fired**: her nav items carry a `/${lang}/` prefix
her config hides from the URL, so `pathname === item.href` is false on every page
of hers, including the one she is standing on. Pooling had to drop the prefix —
`/en/starseed` 307s on her app and 404s here — the comparison started succeeding,
and one link per page turned bone. On all twenty-five pages, because it is chrome.

`PillNavTheme.currentPageColor`: empty is the bone the bar has always drawn,
`"none"` takes it off (the var is published as the ordinary link tone, so the
current link becomes its own sibling), anything else is a colour. One
`--pn-current` behind a fallback, so the rule is unchanged and a site that states
nothing is indistinguishable from the bar before this existed. Blast radius
checked at the database: **resonantweaver is the only site whose `navLayers` point
at `rf-pill-nav`.**

> **FOR GIO — this one reproduces an accident, not a decision.** The current-page
> mark is a real affordance, and Marthe's visitors have never had it only because
> of the prefix mismatch. The row says `"none"` to match her site; say the word
> and it becomes an empty string and the mark comes back. It is one line in
> `gen-chrome-rows.mjs`, flagged there too.

Both colour findings closed the census: **`color 2` → 0** at every width.

### Board (starseed, aligned)

| | 1440 | 768 | 390 |
|---|---|---|---|
| the gutter + the hero | 8.20 | 11.94 | 15.03 |
| the rhythm + the head | 5.05 | 8.08 | 9.73 |
| the closing lines | 4.28 | 7.78 | 9.70 |
| the descender + two colours | **3.81** | **6.67** | **8.78** |

---

## THE CLOSING BLOCK: A GUTTER SAID TWICE, AND A GUTTER SAID BY MISTAKE — 2026-08-09

21px short at 768 and at 390, identically. Two facts about horizontal inset, and
neither of them was vertical at all.

### Her card means 24px, not the page's gutter

Her closing card is `CalloutBar variant="gateway"`:
`width: min(100% - 3rem, 70rem)` with `margin: clamp(6rem, 11vw, 10rem) auto 0`.
That inset is a **literal**, written in a component shared across her pages, so
the card is 24px in from each edge whatever the page's reading gutter happens to
be. rf-callout-bar's own schema has said `min(100% − 3rem, Nrem)` since it was
written.

Then `rf-page-tone` learned to state a gutter, and this band started following
it — which is precisely what that mechanism is for: it has to reach bands written
before it existed. On starseed the page says `clamp(32px, 5vw, 64px)`, so at 768
the card came out **705 → 676px**.

`sideInset` is how a band says it means a different inset. It replaces the width
rule outright rather than changing the variable's fallback, because a fallback
still loses to a page that states a gutter — the band would be back where it
started. Empty ⇒ the gutter, which is every published row. Card now 705 at x24 at
768 and 327 at x24 at 390, both hers exactly.

### …and her two closing lines mean the gutter and nothing else

Her `Or` and `Footnote` live in her `Wrap` — `padding: 0 var(--gutter)` — inside
a `div` that states no padding of its own. So: the page's gutter horizontally,
no frame vertically.

Both rows were authored `framePad: "none"`, and "none" means the band asks the
frame for **nothing, gutter included** — which is correct, and is what keeps a
full-bleed band full-bleed however the page is laid out. But these two are not
full-bleed bands; they are prose that wanted no *vertical* furniture. Running
edge to edge, the disclaimer's own 720px cap became the wrap width instead of the
page's 676px, and it set in **three lines where hers sets in four**. That is the
21px, at both widths, for the same reason.

**No knob was needed.** A rung with both vertical pads zeroed already IS her
Wrap: `padCss` emits `0 var(--rf-gutter, h) 0 var(--rf-gutter, h)`, and the
rung's own `h` is only the fallback for a page that states no gutter. `md`'s 32px
is her clamp's own floor, so even the fallback is hers.

**Closing block: 768 9.96 → 4.85% (732 → 732 exact) · 390 11.37 → 6.70%
(1038 → 1038 exact).** The page-height delta fell from −29px to **−8px, uniform
at all three widths**. Census `box` 5 → 1 at 390 and 4 → 1 at 768.

Controls unmoved: home 7.55 at 1440 and 22.54 at 768, open-your-journey 0.52,
sun-walk 0.05 — every one identical to its last recorded number.

### Board (starseed, aligned)

| | 1440 | 768 | 390 |
|---|---|---|---|
| the gutter + the hero | 8.20 | 11.94 | 15.03 |
| the rhythm + the head | 5.05 | 8.08 | 9.73 |
| the closing lines | 4.28 | 7.78 | 9.70 |
| the descender + two colours | 3.81 | 6.67 | 8.78 |
| the two gutters | **3.81** | **6.32** | **8.45** |

### Left, in order

1. **The uniform −8px, and it is four 2px gaps.** At 768 the ledger reads
   799 → 797, 2246 → 2244, 1124 → 1122, 685 → 683 — four bands, exactly 2px each,
   and nothing else on the page is off by a pixel. Same four at 390. Worth one
   probe: one cause, four places.
2. Her `Band` hairlines — 1px rgba(255,255,255,0.09) top and bottom over a 3%
   teal gradient on four of eleven bands; the wash is under tolerance, the
   hairlines have no knob.
3. `tag 15` — her braid stage number is a `<span>`, ours a `<p>`; her step
   markers likewise. Invisible to a pixel diff, named by the text census.
   `weight 7` is the rest of it; `color` and `box` are effectively clean.
4. **home at 768 is 22.54% and at 390 is 18.88%**, against 7.55 at 1440 — three
   bands render only in the candidate ("01 · your birth sky…", the star-lineage
   grid, the early-access note) and the page runs +222px at 768 and −141px at
   390. Not caused by this window (`rw-rhythm-control` recorded the same 22.54);
   just never looked at, because the board only ever ranked 1440.
5. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
6. Then: **tell Gio "come look", his eyeball pass, then the flip.**

---

## FOUR BANDS, TWO PIXELS EACH — 2026-08-09

The last record left one item at the top: *"the uniform −8px, and it is four 2px
gaps… four bands, exactly 2px each, and nothing else on the page is off by a
pixel. Same four at 390. Worth one probe: one cause, four places."* It was one
cause, and it was already written two items further down the same list.

**The probe answered it in one run.** Dumping the audience band's whole subtree
on both sides: every row identical — the eyebrow 18.27, the h2 41.55, six
paragraphs to the pixel, the inner column 533.52 on both — and her section's
first child opening at **rel 81** where ours opens at **rel 80**. Computed
padding read `80px/80px` on both. The 2px was not inside the band at all; it was
the band's own edge.

`Band = styled(Section)` — her page's one variant, and its whole body is three
declarations:

```
border-top: 1px solid ${({ theme }) => theme.border};      /* rgba(255,255,255,0.09) */
border-bottom: 1px solid ${({ theme }) => theme.border};
background: linear-gradient(180deg, rgba(72, 210, 185, 0.03), transparent);
```

`<Band>` appears **four times** in her page — lineage, journey, method,
audience — against seven bare `<Section>`s. Those four are exactly the four
segments that measured short. A border sits outside the padding, so each one
costs 1px at each edge: 4 × 2 = **the whole −8px**, and the reason it was
uniform at 1440, 768 and 390 is that a hairline does not scale.

So item 1 and item 2 of that list were the same finding. The plan had already
named the hairlines and filed them as cosmetic ("no knob"); what it had not
noticed is that they were also the entire height ledger.

### The knob: a rule is the band's edge, so the FRAME emits it

`RfSurface.ruleTop` / `ruleBottom` take a complete CSS border value, and
`SectionWrap` emits them outside the padding and outside the mobile media query
— a hairline is the band's edge at every width. That reaches all nine entries
that mount `RfSection` at once. rf-hud-cards frames itself (the grid IS the
band) and emits the same two on its own `Band`. Absent ⇒ no border, pinned both
ways.

The wash needed nothing new: `bg` has always taken a gradient.

### Two of her four bands are two rows of ours, which is where the design was

Her journey and method each hold prose AND a grid inside **one** ruled
`Section`; ours are a head row plus a grid row. So the pair has to be sayable
across two rows:

- the **head** states `ruleTop` and nothing at the bottom — the band does not
  close there, and a second hairline in the middle is an artifact of our split;
- the **grid** states `ruleBottom` — and its close has to move from
  `marginBottom` to a new `padBottom`, because the rule sits at the outer edge
  and a margin would leave the line floating **above** its own 80px.

That is the third time this page has taught the same lesson (the head's bottom
pad, the gutter's opt-out, now the rule's close): *a page-level or band-level
fact stated once by her has to be re-stated at the seam wherever we split her
band in two.* The pooled grid that carries no rule is indifferent between margin
and padding and keeps the margin it already had — the currents grid is
untouched.

**The wash rides the head row alone**, for the same reason. Her gradient runs
the length of the band and ours cannot span two boxes. Restarting it on the grid
would put a 0.03 → 0 step at a boundary she has nothing at; what is given up
instead is the tail, where her alpha is already under 0.02 — about one level of
RGB over this ground. On lineage and audience, which are one row each, the wash
is exact.

### The board

| width | before | after | ledger |
|---|---|---|---|
| 1440 | 3.81% | **3.24%** | −8px → **same height** |
| 768 | 6.32% | **5.56%** | −8px → **same height** |
| 390 | 8.45% | **7.51%** | −8px → **same height** |

Every one of the four is now exact at every width: 904→904, 2105→2105, 834→834,
712→712 at 1440; 799→799, 2246→2246, 1124→1124, 685→685 at 768. **Not one band
on the page is off by a pixel any more**, and `starseed` joins `sun-walk`,
`open-your-journey` and `galactic-field-guide` on `same height`.

Controls unmoved on the same pass — home 7.55 / 22.54 / 18.88, writing 6.80,
all-products 6.66, open-your-journey 0.52, sun-walk 0.05, receive 4.70, develop
3.99, offer/pearl-chamber 3.42 — which is what "absent ⇒ no border" is supposed
to mean on nine entries at once. render-check 515/515, fleet 7/7, RCS built
nothing.

### Left, in order

1. `tag 15` — her braid stage number is a `<span>`, ours a `<p>`; her step
   markers likewise. Invisible to a pixel diff, named by the text census.
   `weight 7` is the rest of it; `align`, `color` and `box` are down to one each.
2. The five bands still carrying a candidate-only sibling (the aligned strips at
   92%, 68%, 65%, 51%, 28%) — these are structure, not paint: her journey/
   currents/method/how bands hold their grid INSIDE the band and ours emit a
   second `<section>`, which is also the whole of `sections 11→16` and of
   `landmarks: main 1→0  header 2→1`. One ruling, one shape, five bands.
3. **home at 768 is 22.54% and at 390 is 18.88%**, against 7.55 at 1440 — three
   bands render only in the candidate and the page runs +222px at 768 and −141px
   at 390. Never looked at, because the board only ever ranked 1440.
4. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
5. Then: **tell Gio "come look", his eyeball pass, then the flip.**

---

## THE CENSUS GOES CLEAN — 2026-08-09

*The window after the four ruled bands. `starseed`'s text census reads
**"92 strings on both sides, identical"** at 1440, 768 and 390.*

The board barely moved — 3.24 → **3.23** · 5.56 → **5.55** · 7.51 → **7.50** —
and that is the point. Everything closed here was invisible to a pixel band and
visible to the only instrument that reads type: `tag 15 · weight 7 · align 1 ·
box 1`. Four findings, and only one of them was what the plan predicted.

### The marker was bold, and no band could say so

Her `BraidStageNumber` is a `styled.span` that declares no `font-weight`, so it
runs 400. `rf-hud-cards` had `font-weight: 700` welded into both marker rules
and `styled.p` welded under them. Seven markers on the page rendered **bold
against her regular** — a real paint difference that the band percentage could
not report, because that band is one of the five still carrying a structural
sibling and its number is dominated by the split.

The 700 is not wrong. It is where the entry came from: her gateway
`OfferingIndex` and her landing `CardIndex` are both `<p>` at 700, read off her
own `Cards.tsx` and `LandingStarPreview.styles.ts`. So the default stays and the
stage states the exception — `markerWeight: 400`, `markerTag: "span"`.

Both marker rules now declare `display: block`, which is what makes the element
free: a paragraph is a block already and a bare span is not, so without it the
swap would have changed the box as well as the tag.

### "Her step markers likewise" was wrong

The previous record predicted the same fix for the how-it-works rail. Measured,
her step marker and ours are **already identical** — `01#2 | span | Space Mono |
11.2px | 700 | rgb(72, 210, 185) | 112x108` on both sides. `rf-process-steps`'
`RailNumber` was a `styled.span` from the day the rail mode was derived from her
`TrainingStep`. Nothing to do; the prediction is corrected here rather than
quietly dropped.

### Eight rows of `div → p`, and ours is the better element

Her `CurrentEssence` is a bare `div`. The row mode renders a `<p>`, which is the
more correct element for a sentence — so the default stays and `copyTag: "div"`
is hers to state. Zero pixels either way (both are blocks with the same margins;
the census box read `421x45` on both sides before and after). It is transcribed
anyway because a permanent eight-row census delta on an otherwise clean page
makes the instrument read as noise, which is the same argument that earned the
colour canonicalisation.

### `left` vs `start` was the harness, not the page

One row, on her hero eyebrow: she declares `text-align: left`, the catalog
declares nothing and computes `start`. Identical paint at every width this rig
shoots. Canonicalised in the differ beside `canonColor`, and **named rather than
dropped from TPROPS** — the pair genuinely separates under `direction: rtl`, and
the day something in the fleet sets it this has to come back.

### The arrow was 13px wide because `next/font` builds a fallback face

The last row was `box 13x18 → 7x18` on the `→` in her CTA. Both sides declared
Space Mono at 10.88px/700. The stacks:

```
hers   "Space Mono", "Ubuntu Mono", "Ubuntu Mono Fallback", ui-monospace, monospace
ours   "Space Mono", "Ubuntu Mono",                         ui-monospace, monospace
```

`next/font` generates one metric-matched alias beside every family it loads and
sits it in the stack immediately after that family. Read off her live app:
`"Ubuntu Mono Fallback"` is `local("Arial")` at `size-adjust: 112.16%`. **Neither
Space Mono nor Ubuntu Mono carries U+2192**, so her arrow is Arial scaled 112.16%
— 13.08px — and ours fell through to `ui-monospace` and drew 7.42px. Measured
in her own document against nine candidate stacks: only her own rung reproduces
13.08.

That is not a flash-of-unstyled-text detail. The generated alias is what draws,
permanently, **any glyph the real file does not have** — so two renders can agree
on every declared family and still disagree on the glyphs neither of them owns.
Nothing in `siteFonts` could say the rung that decides it: a face was a file or
it was nothing.

`SiteWebfont.local` is the alternative to `src` (never both), with `sizeAdjust`
and the three metric overrides beside it, each **omitted rather than defaulted**
— a `size-adjust: 100%` we invented is a scale we would be asserting. Aliases are
counted apart from downloaded faces, because the twelve-face cap is a BYTES
budget and an alias fetches nothing; counted together, a site restating four
fallback rungs would silently lose a real face, and a dropped face is a page in
the wrong typeface.

Three aliases authored, and her four stacks re-stated around them. **The names
are ours, the numbers are hers**: she calls them after her `next/font` variables
(`"scienceGothic Fallback"`), we call them after the family we self-host, because
the alias only has to be reachable from our own stacks. The metrics cannot be
transcribed from her source — next/font computes them from the font file at build
time — so they are measured off the `@font-face` blocks her live app serves, and
the guards hold the four DECLARATIONS that mint them: `Space_Grotesk(…)`,
`Ubuntu_Mono(…)`, `localFont(…)` and, load-bearing in the negative,
`adjustFontFallback: false` on her Space Mono. That last one is why there is **no
Space Mono alias** — her own comment says next/font's generated fallback carries
no unicode-range and would claim Greek before her Ubuntu Mono chain could. If she
ever turns it back on, a fourth rung appears in her stacks and the guard fails.

### The board

| width | before | after | census |
|---|---|---|---|
| 1440 | 3.24% | **3.23%** | `tag 15 weight 7 align 1 box 1` → **identical** |
| 768 | 5.56% | **5.55%** | identical |
| 390 | 7.51% | **7.50%** | identical |

Controls flat-to-better on the same pass: home 7.55 / 22.54 / 18.89, writing
6.80 / 15.62 / 21.12, all-products 6.65, open-your-journey 0.52, sun-walk 0.05,
receive 4.69, develop 3.97, offer/pearl-chamber 3.40. `outOfPhase` empty.
render-check 535/535 (20 new), tsc clean, fleet 7/7, RCS built nothing.

### Left, in order

1. The five bands still carrying a candidate-only sibling (the aligned strips at
   92%, 68%, 65%, 51%, 28%) — structure, not paint: her journey/currents/method/
   how bands hold their grid INSIDE the band and ours emit a second `<section>`,
   which is also the whole of `sections 11→16` and of `landmarks: main 1→0
   header 2→1`. One ruling, one shape, five bands. **Now the largest thing left
   on this page by a wide margin** — with the census clean, every remaining
   starseed point is this.
2. **home at 768 is 22.54% and at 390 is 18.89%**, against 7.55 at 1440 — three
   bands render only in the candidate, the page runs +222px at 768 and −141px at
   390, and its census still reads `box 41 · tag 4 · size 2 · color 2 · weight 1`
   with 17 strings missing on each side. Never looked at, because the board only
   ever ranked 1440. writing is the same shape (`box 12` at 390, −30px).
3. pearl-chamber 45.99 + home-classic 43.52 — parked on Cormorant A, NON-font
   deltas only. doors/experiences ~20% — Gio's eye.
4. Then: **tell Gio "come look", his eyeball pass, then the flip.**
