# Her navbar, her editor's Nav section and her balloon menu are three stores

Found 2026-08-12, from Gio's three reports in a row: *"her 4 links on her nav bar
are not showing up on the nav section"*, *"Writing I can't unclick"*, *"Writing
isn't listed anywhere but is showing up in her balloon menu"*. His own read —
*"which seems like a harness architecture thing"* — is exactly right.

## The three stores, measured on production

| What a person sees | Where it actually lives | What it holds for resonantweaver |
|---|---|---|
| The bar on her site | `content_overrides.navLayers` → the `rf-pill-nav` block's `blockRef.props.items` | Starseed `/starseed/`, Sun Walk `/sun-walk/`, Contact `/#contact`, Login `/login/` |
| The editor's **Nav section** (NavBarEditor's Links card) | `content_overrides.navigation` — the i18n nav DICT | **no published row at all** (one draft, user-scoped) |
| The **balloon menu** | `member_bottom_navbar.links`, seeded from `page_models.in_nav` | one Listed link: **Writing** |

Nothing joins them. That is the whole bug, and each of Gio's three symptoms is
one edge of it:

- **Her 4 links are absent from the Nav section** because the Nav section edits
  the dict and her bar is a chrome block. `rf-pill-nav` has no dict fallback;
  `TgvV5Nav` already does (`useSiteLinks` → `navData.links`, `inNav` respected).
- **Writing is on the balloon** because the balloon is seeded from page rows and
  `writing` is the only non-`home` row of hers carrying `in_nav = true` — set by
  `generate.mjs` (`inNav: true`, an authoring guess), not by anything her site
  says. Her other 17 rows are `false` and sit Unlisted.
- **Sun Walk can never reach the balloon**, however it is toggled: it is an app
  route (`SITE_SURFACES`, `@tgv/module-starseed`) with no `page_models` row, and
  the seed only walks page rows.

## SUPERSEDED IN PART — Gio's ruling, 2026-08-12 (built the same day)

The navbar is the registry. The balloon derives from the NAVBAR ALONE minus an
exception list (contact + the auth doors) — not from "nav dict ∪ page rows" as
step 3 below first proposed. A navbar link needs no page row (Sun Walk arrives
as a custom link); an off-navbar page cannot be Listed (switch greyed, reason
shown — the way on is the editor's Nav section). Canon:
`clients/tinyglobalvillage.com/docs/balloon-menu.md` +
`src/lib/tenants/navMenuPolicy.ts`. What shipped: mono `916f243f`
(rf-pill-nav useSiteLinks) + `ede7cc19` (Nav card falls back to published —
the reader gap that ALSO hid her links in the editor) + `23b26570`
(configurator affordance); HQ `65b21f8e` + `50db8041`; office
`10-nav-one-store.sql` (apply AFTER the deploy — flipping the block before
the package ships would blank her bar).

## REVISED AGAIN the same evening — four switches (nav-link atoms)

Gio's follow-up architecture: the dict is the REGISTRY; rows carry
inNav/balloon/attached/order; atoms flag in via `navKey`; the utility
exceptions became balloon DEFAULTS (overridable); the eyeball no longer gates
the balloon. Canon moved to `clients/tinyglobalvillage.com/docs/balloon-menu.md`
+ plan `generic-popping-sunset.md`; fleet migration
`sql/nav-link-atoms/01-registry-migration.sql`. RW needed no data change.

## SHIPPED AND VERIFIED — 2026-08-12, all six phases

Deployed @ HQ `3f7ec482` (BUILD_ID from mac-deploy, RCS built nothing), SQL
applied + re-run idempotent. Verified live: her bar renders BYTE-IDENTICAL
markup from the dict (curl diff against the pre-migration capture); the
editor loads her four links (authed door, "Go to Starseed"/"Go to Sun Walk"
in the payload, no base HOME dict); her balloon = Starseed (page) + Sun Walk
(custom, no page row) Listed, Contact/Login absent, Writing clamped Unlisted;
the Listed toggle round-trips both directions through POST (the "can't
unclick" path). Fleet: guardians unchanged (no dict → legacy seed).

**Two finds on the way:** (1) `readDraftNavAndFooter` fell back to BASE, never
published — the missing middle rung was the other half of "her links are not
in the Nav section" (`ede7cc19`). (2) **jsonb re-sorts object keys**, so the
dict rendered Login first and NavBarEditor's drag-reorder was an illusion
after any round trip; links now carry an explicit `order` stamped on save,
sorted by every reader (`3f7ec482` mono, `b92357b6` HQ).

**Ruling deltas on other dict sites** (balloon now mirrors THEIR navbar):
giocoelho 5 Listed pages → clamped, only UAT Blog (his navbar's one link);
refusionist 5 Listed → none (dict is home-only); main's empty bar → its real
navbar (Blog, UAT Balloon Test, Fashion Boutique). Fix-forward on any of
them: list links in the editor's Nav card and they flow to the balloon.

## The convergence — one store, the pattern that already exists

`TgvV5Nav.Render` reads `props.useSiteLinks ? navData.links : props.links`. Copy
that, don't invent:

1. **mono** — `RfPillNav`: `useSiteLinks?: boolean`; when on, items come from the
   nav dict through `NavDataContext` (`inNav !== false` respected), plus a lever
   in its EditorPanel. Byte-identical whenever `items` is authored, which is
   every caller that predates it.
2. **office SQL** — move her four links from the `navLayers` block into a
   PUBLISHED `navigation` dict row, empty the block's `items`, set
   `useSiteLinks`. Her bar renders the same four; the editor's Nav section can
   now see and edit them. Also `writing.in_nav = false` — her nav does not name
   it.
3. **HQ** — the registry Gio asked for: `src/lib/tenants/navMenuPolicy.ts`
   classifies a nav href as `page` or `utility` (external, bare `#anchor`, and
   the door slugs — login/signup/logout/account/cart/checkout/contact/support).
   `api/dashboard/mobile-nav` seeds and reconciles from **the site's nav dict ∪
   its page rows, minus utility**, so Starseed and Sun Walk are Listed, Contact
   and Login never are, and a nav link with no page row (Sun Walk) arrives as a
   `custom` link rather than being dropped on the floor.
4. **The uncheck** — Gio cannot take Writing off the bar. Read the code end to
   end and every rung looks right (`canCurate` is true for an admin, `enabled` is
   preserved by `reconcile`, the POST is scoped by `?site=`), so this one needs a
   live repro through the authed door with the network panel open before a fix is
   written. Do NOT guess at it.

## Blast radius, checked before proposing it

Only resonantweaver has a stored nav with `items` (nevlo's and the apex's
`navLayers` rows carry none; giocoelho, guardians and refusionist have no row at
all — their bars are DERIVED). So step 3 changes exactly one site's balloon
today, and any site that later authors a nav gets the wiring by construction.
