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
