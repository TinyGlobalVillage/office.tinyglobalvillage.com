# The conversion track — resonantweaver's components, by level

CUTOVER-PLAN §7. The cutover is done; this is what comes after it.

> *"Record the level per component when each moves, so the queue is visible
> rather than remembered."* — PHASE-0-INVENTORY, the line this file discharges.

| Level | What it means | What she can do |
|---|---|---|
| **L0 · Ported** | Lives in a package, mounted on her host. Renders identically. | Nothing new. |
| **L1 · Content freed** | Its words, images and ordering are a `page_models` section config instead of a source file. | Rewrite copy, reorder stops, swap images. |
| **L2 · Parameters declared** | The component declares its editable surface — name, type, range — the way an `AtomSpec` does. | Tune it, within bounds that cannot break a frame. |
| **L3 · Choreography wired** | Its drivers and targets are config: scrubbable, previewable. | Rewire what drives what. |
| **L4 · Canon** | A catalog entry any tenant can drop on a page, theme-neutral, in the Sandbox. | Not hers any more — the platform's. |

A component climbs one rung at a time. **L3 → L4 is a real gap and not
automatic:** a thing can be fully editable *for her* long before it is general
enough for anyone else.

---

## The ledger

| Component | Where it lives | Level | What the next rung costs |
|---|---|---|---|
| **Bucket A** — her twenty-odd content pages (doors, offers, archive, FAQ, testimonials, hero, accordion) | `page_models` rows keyed `site='resonantweaver'`, rendered by the shared `rf-*` catalog | **L4** | Nothing. They arrived at L1 and reached L4 by construction: they are catalog entries any tenant can drop, and three of them (`rf-offer-card`, `rf-testimonials`, the orbs backdrop) were ADDED to the catalog to carry her, so the platform gained what she needed. |
| **rf-journey** — The Seven Gates | `@tgv/module-page-editor` catalog section, `page_models` row | **L1→L2** | See below. The typeface is freed; per-stop editing is the rest of L2, and the choreography (what scroll drives what) is L3. |
| **RitualButton** — the CTA plate | `@tgv/module-component-library/components/ui` | **L1** | Shared by the journey and (later) the oracle. Colours follow the theme roles, face follows `--ritual-font`. Its L4 twin already exists — `RfCta`'s `ritual` variant, themed from props — and they meet when the oracle climbs. |
| **The Sun Walk** | `@tgv/module-starseed/sunwalk`, app route + `SITE_SURFACES` grant | **L1** | See below. Its palette is freed; its CONTENT is still compiled in — the eight currents, the 52-week walk and the four reference popups are `engine/sunwalk.ts`, not rows. |
| **The Galactic Field Guide** | `@tgv/module-starseed/fieldguide`, app route + grant | **L0** | The registry, the dossiers and the constellation geometry are `engine/fieldguide/*.ts`. It reads no site palette at all — it is typed and coloured entirely by the `--gfg-*` font module and its own literals. |
| **The Starseed profile panel** | `@tgv/module-starseed/panel`, mounted in the dashboard through `PROFILE_ENGINES` | **L0** | Its own `panel/tokens.ts` blends her palette with a mockup's; L4 is questionable for an engine UI and should not be assumed (PHASE-0's own caveat). |
| **The course space** (`/landing-star-preview/course`) | HQ route, `SITE_SURFACES` grant | **L1** | Four tabs of inputs over React state. Its palette is freed with starseed's; its copy is `content.ts` in HQ, byte-identical to hers. |
| **`/open-your-journey`** | HQ route + grant, `src/lib/journey/config.ts` | **L1** | A funnel, not a component: an email in, a secret link out. The words are config keyed by site; the secret is why it cannot be a row. |

---

## Rung 1 — the palette, done 2026-08-07

§7 named this: *"`journey/tokens.ts` and `starseed/ui/tokens.ts` are byte copies
of her palette … turning that into `color-mix` is the first rung, and it has to
be done against screenshots rather than in the same commit as a file move."*

**The premise was right and the prescription was wrong, in a way worth keeping.**
Both files carried the same paragraph of reasoning: `rgba()` takes three numbers,
not a custom property, so themeing the palette meant rewriting all seventy-five
`rgba(${TEAL}, 0.6)` call sites into `color-mix()` first — a big enough job to
schedule rather than do.

The platform's own token layer refutes it. `themeToPairs` emits an RGB **triplet**
beside every colour (`--tgv-cyan-rgb`, `--tgv-t1-rgb`, …) precisely so
`rgba(var(--x-rgb), a)` works, and uses that form itself: `--tgv-cyanLo` *is*
`rgba(var(--tgv-cyan-rgb), 0.08)`. A `var()` fallback may contain commas — the
fallback is everything after the first comma. So the rung is the two token files
alone and **not one of the seventy-five call sites moved.**

**The roles are exact, not approximate, and that is checkable.** Her published
theme row (`01-theme.sql`) sets `text` #e8e5da, `accent1` #48d2b9 and
`accent2`/`accent3` #b78a77 — the same three values that were hard-coded in the
package. Read off the live site at `[data-site-theme]`:

```
--tgv-t1-rgb    232, 229, 218   = BONE
--tgv-cyan-rgb   72, 210, 185   = TEAL
--tgv-mag-rgb   183, 138, 119   = COPPER
```

So on a themed surface the vars resolve to what the literals already were, and on
an unthemed one the literals *are* the fallback. Byte-identical in both
directions today; themeable the moment a theme reaches these routes.

**One consumer needed the numbers, not the declaration.** `CalendarModal` derives
a hex accent from COPPER for its two reference popups — the accent travels as a
JavaScript *value* before it is ever a CSS declaration, and JavaScript cannot
read a custom property the browser has not resolved. A `var(...)` would have gone
through `.split(",")` and produced `#varmg-b183`, which no parser accepts, so
both popups would have lost their accent **silently**. Hence the split into a
numeric half (`COPPER_RGB`) and a CSS half (`COPPER`) rather than one value.

**And four of the nine tokens were dead.** `PHTHALO` paints her writing page and
`SERIF` her journey — neither is in the starseed package; and `journey/tokens.ts`
still exported COPPER/TEAL/BONE/PHTHALO that nothing had read since the journey
became a section and every colour moved into a stop. Deleted rather than themed:
theming a value nothing reads is worse than leaving it, because it looks done.

## Rung 1b — the journey's typeface

The one thing in `journey/tokens.ts` that was real: **thirty inline
`fontFamily: SERIF` sites across eight files**, setting the whole experience in
Cormorant Garamond — a customer's typeface compiled into a catalog entry any
tenant can drop on a page.

`SERIF` is now `var(--rf-journey-serif, 'Cormorant Garamond', Georgia, serif)`
and `Render` sets that property on the journey's own root element from a new
`headingFont` prop. So the thirty sites did not move, an unset prop is
byte-identical to before, and the author has a field. It rides on the section's
root rather than the document because the section owns its viewport, not the
page.

**Why not `var(--tgv-fontHeading)`.** Because that is the theme's HEADING role,
and on resonantweaver it is **Science Gothic — a sans**. Her journey is
Cormorant, a third family the two-role theme (`heading`, `body`) has nowhere to
put. Binding to the heading role would have re-typeset the entire experience in
the wrong face while looking like a tidy-up.

**So the default is the last thing about rf-journey that is hers rather than the
platform's**, and it stays until `SiteTheme` grows a third role. That is the next
rung and it belongs in its own commit, against its own screenshots.

**And there was a third copy, which only the browser found.** The journey's
"Begin the Journey" plate is `@tgv/module-component-library`'s `RitualButton` —
a SHARED component in the platform's own library — and it carried its own
private `COPPER`, `TEAL`, `BONE` and `SERIF`, verbatim. So the first pass
re-typeset the entire experience around a button that did not move. Its header
even claimed the colours "are literals and not `var(--site-*)` because rgba()
takes three numbers" — four lines above `rgba(var(--button-hover-rgb, …), 0.58)`,
the shape it called impossible, already in the file for the hover state. It
follows the theme roles now, and reads `--ritual-font` for its face, which
`rf-journey` sets from the same one prop.

## How rung 1 was verified

Both directions, because each alone would pass for a broken change.

**Invariance** — `scratchpad/token-parity.mjs`. Captures every element's
computed `color`, `background-color`, `border-color`, `fill`, `stroke`,
`box-shadow`, `outline-color` and `font-family`, keyed by a DOM path (not by
class: styled-components hashes change whenever the CSS does, which makes them
exactly the wrong key for a before/after). Five surfaces × two viewports,
captured against the LIVE deploy, then against a Mac production build behind the
Host-rewriting proxy. **10/10 byte-identical**, 0 console messages. A pixel diff
would have said the same thing about a component that had stopped painting
entirely; this says the same thing about every declaration.

**Reachability** — `scratchpad/themeable-proof.mjs`, 9 assertions. Sets the
three role tokens to red/green/blue and asserts each token's declarations move
and no literal survives — and that the eight star currents, which are a fixed
astronomical model rather than a theme role, do **not** move.

**The harness lied three times before it told the truth, and the reason is worth
keeping.** Three assertions failed with values like `rgba(233, 221, 211, 0.55)` —
one and a half percent of the way from her bone white to the probe's red. These
controls declare `transition: color 180ms ease`, so changing a custom property
does not change the computed colour, it starts an ANIMATION; a read two frames
later catches it mid-flight. Which is indistinguishable, if you only check
whether the number moved, from a `var()` that failed to resolve. It cost an
hour of chasing a CSS bug that was not there.

**Guarded against regression:** `render-rf-sections.tsx` grew five assertions
(123/123). The load-bearing one strips every `var()` fallback from the emitted
CSS and fails if any tenant triplet survives outside one — a literal inside a
fallback is the rung working, the same literal outside one is the rung undone.
That check reaches past the section into the shared CTA, which is where the
third copy was hiding.

---

## What rung 1 revealed, and why it is latent

Measured on the live site, 2026-08-07:

| Surface | `--tgv-*` theme vars | Her self-hosted faces |
|---|---|---|
| `resonantweaver.com/` (a page row) | **set** on `[data-site-theme]` | **loaded** — Cormorant Garamond, Science Gothic |
| `resonantweaver.com/sun-walk/` (a granted app route) | **none** | **none** — `body` computes to `Arial, sans-serif` |

The theme scope and `<SiteFonts>` are emitted by `PublicTenantLanding.client.tsx`,
which wraps `app/u/[username]/**` — a tenant's page rows. Every SITE_SURFACES
grant lives in `app/[lang]/**`, whose layout emits JSON-LD and nothing else.

**So rung 1 changes nothing visible on any of her surfaces today**, and that is
the correct outcome rather than a disappointing one: the component stopped
baking a tenant's palette, and the fallback is what keeps the render identical
until a theme arrives. What it is waiting for is the theme reaching those routes
— which is a white-label defect in its own right and is logged as one
(`~/.claude/bugs/tenant-app-surfaces-have-no-theme.md`), because it is not
resonantweaver's problem: `/book/`, `/session/`, `/meet/`, `/performers/` and
`/studio/` are allowlisted onto **every** tenant host and render in the
platform's type and the platform's palette on a customer's own domain.

That bug is the same family as the four already fixed — the tenant chrome, the
`<head>`, the OG card, the JSON-LD — one layer further in. It is the enabling
rung for everything below L2 on the two star surfaces, and it is not this file's
to fix.

---

## The queue, in order

1. **The theme + fonts reach granted app surfaces.** The bug above. Everything
   else on this page is blocked behind it or unaffected by it.
2. **A third font role on `SiteTheme`** (`fonts.display`), so `rf-journey`'s
   default stops being Cormorant. Small — a type, a validator, one pair in
   `themeToPairs` — but it touches the shared theme schema and the panel that
   edits it.
3. **`rf-journey` L2**: the per-stop editor. Palette, element, mantra, breath
   phases with durations, watercolour blob geometry, four content tabs, five
   resonance labels. A form of its own, and the reason it is absent rather than
   half-built is that a stop editor which lets someone set a blur to 9000 is
   worse than none.
4. **`rf-journey` L3**: the choreography. Which scroll position drives which
   step, and the crossfade — `docs/artifacts/canvas-mode-parameters-and-choreography.html`
   is the design for it.
5. **The Sun Walk L2**: its content is `engine/sunwalk.ts`. The eight currents
   and the 52-week walk are a fixed astronomical model and arguably belong in
   code forever; the four reference popups' COPY does not.
6. **The field guide and the profile panel** stay at L0 until something needs
   them to move. L4 for an engine UI is questionable and should not be assumed.
