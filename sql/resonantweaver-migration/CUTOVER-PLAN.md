# resonantweaver.com — the last actions

> Written 2026-08-06 on Gio's ask: *"plan out the last actions to get rw done."*
> Phase 0's inventory is `PHASE-0-INVENTORY.md`; the generator's runbook is `README.md`.
> This file is only what is LEFT, in the order it has to happen, with the traps named.

## Where she actually stands

Three of her pages are `page_models` rows keyed `site='resonantweaver'` — `home`, `journey`,
`writing`. Her design tokens, her fonts and her void backdrop are `content_overrides` rows.
`/sun-walk` and `/galactic-field-guide` are `@tgv/module-starseed` surfaces mounted on HQ
behind `SITE_SURFACES.resonantweaver`. `villager_sites` carries both her subdomain and her
domain, so the custom-domain branch already resolves her — everything below is testable
through a Host-rewriting proxy without moving a byte of production traffic.

Her schema holds exactly one populated table: `journey_signups`, 2 rows.

**And the API half is nearly free.** 106 of her 116 API routes exist in HQ at the identical
path. That is the number that decides how big this is, and it was measured, not assumed.

## 1 — Bucket B, her commerce funnel — **DONE 2026-08-06, except the two named non-ports**

Fifteen published page rows and two drafts now, all generated. What landed today, on top of
the star landing, the three doors and the six offer detail pages that were already in:

- **`experience/all-products`** — the offering listing every door's "see all" CTA points at,
  which until now was three published pages linking into a 404. Its own words are four lines
  imported from `AllProducts.content.ts`; the nine tiles come from `offersByDoor`, HER filter,
  which drops the three `hidden` offers. That is deliberately a different rule from the offer
  PAGES, which ignore `hidden` because the route reads the catalog by slug — an offer can be
  off the list and still have a live page.
- **`/pearl-chamber`** — the dead CTA below is dead no longer. It lands as a card plus a form
  whose thank-you screen carries the two PayPal links, because her page reveals them only
  after the intention is in hand. That needed `thankyou.ctas` in `@tgv/module-forms`; putting
  the buttons on the page beside the form would have made them reachable without answering.
- **`/starseed`** — fifteen sections from her one typed `content.ts`. It unblocked the two
  held gateway redirects and the `starwoven-journey` tile.

Two catalog gaps were filled by extending existing entries rather than adding new ones, which
is what Phase 0's open question asked for: `rf-offer-card` gained a `media-top` layout (the
photo above the copy, for a card that is one of two or three across and has no room for a
second column) and a `mediaFit`; `rf-list` gained an optional per-item colour, so the eight
star currents keep the WCAG-checked accent the product itself paints them in.

**NOT AUTHORED, and each for a stated reason:**

- **`experience/[product]`** — three pages her own STATUS.md calls the "old safety-net route
  (untouched)", superseded by `offer/[slug]`, with deleting them left as an open question.
  These are not pages she built and never published; they are content she published TWICE —
  the copy is the catalog's `detail` blocks nearly verbatim. Authoring them would put two
  editable copies of the same three offers in the studio to be kept in step by hand forever.
  The three URLs are preserved as `SITE_REDIRECTS` entries to their live twins instead.
- **`landing-star-preview/course`** — an interactive mockup, not content: four tabs of text
  inputs and selects whose own copy says "nothing on this page saves, and no login actually
  gates it yet". Same class as giocoelho's `/playlists` and `/fitnesstools/timer` and it needs
  the same ruling from Gio — port it to HQ, or lose it at cutover.
- **the two waitlist-only offers** (`extended-starseed-profile`,
  `awareness-and-perception-training`) — they render `WaitlistForm`, which needs a
  `public.forms` row of its own. Cheap now that `pagesSql` takes a list of forms.

The rest of this section is the reasoning that got there, kept because it is still the rule
for `open-your-journey` below.

---

The last body of content still living as code, and by far the largest thing left: about
5,500 lines across four route trees.

| Tree | Lines | What it is |
|---|---|---|
| `landing-star-preview/` + `[gateway]`, `course`, `experience/[product]`, `experience/all-products`, `offer/[slug]` | 3,116 | The star landing and everything you can click through to buy |
| `starseed/` | 1,705 | The Starseed Oracle page |
| `open-your-journey/` | 392 | The festival access page — email in, private GPT out |
| `pearl-chamber/` | 310 | The subscription page |

**`/starseed` belongs here, not with the starseed package.** Phase 4 recorded the correction
and it is worth repeating, because the name says otherwise: `StarseedOraclePage.styles.ts` is
built on `LandingStarPreview.styles`, which is built on `OnePage.styles`. It cannot leave
without the funnel's stylesheet leaving with it.

**Author it the way Phase 3 did — generate, don't type.** `src/data/offers/offers.ts` (339
lines) and `types.ts` are the funnel's data, already separated from presentation. Extend
`generate.mjs` rather than starting a second mechanism: it reproduces the runtime hide/collapse
filter, guards every string transcribed out of JSX back against her source, and refuses an
unmapped asset. Both hand-typed migrations before it needed a browser to find what the typing
lost; the generated one did not.

**Expect a catalog gap, and answer Phase 0's open question when it appears.** The offer card
carries a price and a "best for" list; the recommendation on file is to extend an existing
entry where the difference is decoration and add one where the difference is structure. Check
the Atom Library before drawing a chevron, a price or a CTA button.

**One CTA is already dead and stays dead until this lands.** The Pearl Chamber link points at
a path the pooled renderer does not serve — the same knowingly-broken link `/playlists` was on
giocoelho. *(Fixed 2026-08-06 — `/pearl-chamber` is a page row.)*

## 2 — The journey signups — **DONE 2026-08-06**

Commits `50bd11fb` (HQ) + the SQL below. Not deployed, so not render-proven.

`open-your-journey` is not only a page. Its server action validates an email, writes a signup,
sends an access email and redirects to a private GPT whose URL never reaches the client — which
is exactly why it is the ONE page of hers that could not become a `page_models` row. A
`form-live` section can collect the address; its thank-you link is in the page source for
anyone who never typed a word. So it is an app route behind a `SITE_SURFACES` grant, the third
after `/sun-walk` and `/galactic-field-guide` and the first of hers that is a funnel rather
than a star surface.

**The words are still data.** `@tgv/module-journey` was deleted for compiling her copy into the
renderer, and "it must be code" is not a licence to do it again one file over.
`src/lib/journey/config.ts` keys the whole surface by site — every string a visitor reads,
every string the mail carries, the card's palette, the From header, and the NAME of the
environment variable holding the private link. Adding a second site is one entry and no edit
to a component. Only the mechanism is compiled in.

**Naming the env var rather than reading one is load-bearing.** A single `STARSEED_GPT_URL`
read directly is the same shape as `TGV_SITE_OWNER_MEMBER_ID` — one variable, one process, and
the moment tenants pooled every booker offered the same person's time. This fails more quietly:
a second site would hand its visitors somebody else's private link.

**`public.journey_signups`** — `sql/resonantweaver-migration/05-journey-signups.sql`, applied to
production and re-run to a no-op, 2 rows reconciled by primary key. Its `site` is `NOT NULL`
**with no default**, which is the structural version of the trap that put refusionist's home
page in as demo content: there, a forced key fell out of a column intersection and a DEFAULT
answered for it, and it passed a row-count check. With no default a writer that forgets the key
gets an error. **Re-run it at cutover** — her app keeps taking signups on :3003 until nginx
moves, and those land in her schema; the copy is `ON CONFLICT (id) DO NOTHING` over preserved
ids precisely so the second run picks up the window.

**The reader is raw `sql` on HQ's own db**, not the injected-executor shape this plan predicted.
That shape existed to serve `resonantweaver.journey_signups` and `public.journey_signups` from
one file through `search_path`; it went with `@tgv/module-journey`, and there is no second
caller to justify bringing it back — her app keeps its own drizzle copy until it stops.
`scripts/test-journey-reader.mjs` runs all three statements against a real database inside a
rolled-back transaction (29 checks), and it **lifts them out of the module by text** rather than
restating them, so it cannot pass while the module is broken.

**Env.** `STARSEED_GPT_URL`, `STARSEED_ENGINE_URL` and `STARSEED_API_TOKEN` are in HQ's
`.env.local` on RCS (backup beside it, `.bak-pre-journey-20260806`). They take effect at the
next reload. The last two also un-stub `/api/user/starseed/profile`, which has been answering
503 on HQ for want of a token.

**The CSV export changed gate on the way across.** Hers asked "do you have a member session",
which is sound where one person can hold one; pooled, the identical check hands any signed-in
member the export and hands whoever asks the first tenant's list. It now resolves the site from
the host and requires the caller to be in `villager` for it — ownership, not staff, and **no
admin bypass**: an administrator with a real reason has database access, and a route that
quietly answers for every tenant is the shape this gate exists to remove.

Her defences came across unchanged because they were written against real traffic: honeypot,
timing gate, per-IP rate limit — now keyed by site as well, so one tenant cannot spend another's
budget — and one generic error, because a form that explains which defence it tripped teaches a
bot how to get past it.

## 3 — The ten API routes that are hers alone — **DONE 2026-08-06**

Commit `c7a9772e` (HQ). One route ported. The other two turned out not to be ports, and
finding that out was worth more than either would have been.

**Vanish on pooling** — `connect/managed/[[...path]]`, `storefront/[[...path]]`,
`villagers/[[...path]]`, `wallet/[[...path]]`. Every one is a proxy that forwards to HQ with
`INTERNAL_API_SECRET`. When she IS HQ there is nothing to forward to; they go with the app.

**Dead or dev-only** — `auth/csrf` is a NextAuth `signOut()` preflight shim; `starseed-preview`
is unset in production and answers its own 404.

**`user/calendar-sync` — PORTED, and it was a fleet-wide hole rather than a port.**
`@tgv/module-dashboard`'s `CalendarSetupModal` has fetched that exact path since it was
written, and HQ mounts that modal through the shared `SessionsTab` under the `meeting-room`
feature. The route existed only on HER app — so on every other host the one dialog that hands
a villager their calendar link has been opening with two empty URL fields and no error, its
sibling `/api/user/calendar/settings` answering normally beside them. Gated identically to that
sibling on purpose; the origin now comes from the request, because her literal
`resonantweaver.com` fallback would hand a villager on their own domain a subscription URL
pointing at somebody else's site, and a calendar URL once pasted is never corrected. Her own
use of it was nil — `resonantweaver.calendar_integrations` has **0 rows** — so this port is
entirely for everyone else.

**`meeting/scheduled` — NOT PORTED, and it should not be.** It lists a host's upcoming LiveKit
scheduled meetings. Three facts, each independently sufficient:
- HQ passes `scheduleMeetingOpensBooking` to the shared `SessionsTab`, so "Schedule Meeting"
  opens the **appointments** booking flow, not the LiveKit link-ahead modal — the same
  convergence that sent refusionist's `/schedule` to `/book`. HQ therefore never creates a
  LiveKit scheduled meeting, and the list would answer `{meetings: []}` for ever.
- The shared tab has no list UI for them either. Its "Upcoming Appointments" reads the
  appointments engine.
- `resonantweaver.meetings` holds 2 rows and **0 scheduled ones, ever**. Her own list has
  always been empty, so nothing is lost at cutover.
A route that can only answer with an empty array is not a port, it is a decoration. It was
written into `@tgv/module-video-calls` as `meetingScheduled` — the missing sibling of
`meetingCreate`, which has accepted a `scheduledAt` since it was written — and then reverted
on those three facts. If the LiveKit link-ahead flow is ever turned back on, the handler is
fifty lines and this paragraph says where it went.

**`paypal/enabled` — NOT PORTED, and the reason needs Gio's ruling.** The route reports whether
her PayPal faucet is live, per the operator killswitch Office writes to
`/srv/refusion-core/data/paypal/paypal-config.json`. Its only callers are her three PayPal
button COMPONENTS, which hide themselves when it answers false. **None of those components
exists on the pooled renderer** — her funnel is `page_models` rows now, and every payment CTA
in them is a plain `<a href="https://www.paypal.com/...">`: nine of them across the offer
pages, the Pearl Chamber thank-you and the starseed closing card.

So the route has no caller — but the killswitch it served has no reach either. **Office →
Villagers → PayPal can still be switched off for `resonantweaver.com` after cutover, and
nothing will happen.** That is a control that lies, which is worse than a control that is
absent. Two ways out, and it is Gio's call:
1. **Accept it** and mark her rows as not killswitchable, in Office, so the operator sees the
   truth. Cheapest, and honest.
2. **Give the catalog a payment CTA that honours the faucet** — one section type whose link
   renders only when the site's faucet is live. That is the reusable answer, and it would
   cover every tenant who ever pastes a payment link into a page row, which is all of them.

## 4 — Rewire her own app onto the packages — **ALREADY DONE, and this entry was stale**

Commit `1a06ea5` on her `origin/main`: `src/lib/starseed/` is deleted and `@/lib/starseed/*` is
a tsconfig alias onto `@tgv/module-orakle/module-starseed/dist/starseed/engine/*`, so her
twenty-odd public pages, the sun-walk and the field guide are untouched and build against the
package. It shipped with the profile-engines deploy on 2026-08-04.

**There is nothing to do for the journey half.** `@tgv/module-journey` was created and then
deleted (`e65d5143`) — the journey is an `rf-journey` page row, not a package. What remains in
her app is `src/lib/journey/{signups,sendAccessEmail}.ts`, and that is correct: it is the copy
her app reads until it stops, and HQ has its own (§2). No third home, no shared reader with one
consumer.

**One hazard, and it is not ours to fix from this lane.** The Mac's shared
`clients/resonantweaver.com` checkout is on `main` at `ee8569d` — **diverged from `origin/main`
and missing `1a06ea5`** — with another session's uncommitted files in the tree. Her app still
has to BUILD for the rollback path to exist (*"a stopped app you cannot rebuild is not a
rollback"*), so before the flip somebody must reconcile that checkout. Do not do it from a
worktree lane.

## 4b — The convergence ledger — **BUILT 2026-08-06**

`clients/office.tinyglobalvillage.com/scripts/feature-ledger.mjs`, commit `65d804b`. Read-only,
one connection, no writes. Runs for every tenant, not only for her:

```bash
ssh -f -N -L 15432:localhost:5432 rcs
MAC_RCS_ROOT="…/MAC RCS" DATABASE_URL='…' node scripts/feature-ledger.mjs [--site X] [--json]
```

Prompted by a real sighting: her Settings tab still offers **Support** and **Cart**, features
dropped from the shared registry weeks ago. The trace mattered more than the symptom — *we had
no way to see it, and no way to see anything like it.* Every guard in this migration family is
per-artefact and one-directional: a string against its source file, a row count against a copy,
an asset path against `public/`. Each answers "did what we ported arrive?" None answers "what
does this site have that the platform does not, and what does the platform have that this site
has never been given?" A gap nobody ported *into* is invisible by construction.

**What it reads.** Canon (`FEATURE_REGISTRY`, 40 keys) · each app's own `DashboardFeatureDef`
list · `public.dashboard_features`. Per site it prints never-seeded, orphan rows, what a cutover
will drop and what it will add.

**What the first run found.**

| | |
|---|---|
| apps declaring keys canon lacks | **only resonantweaver**, and exactly `support` + `cart` — the sighting, reproduced by measurement |
| orphan rows, fleet-wide | `cart`, `subscriptions`, `support` — on giocoelho, guardians, nevlo and refusionist too |
| never seeded anywhere | `account`, `seo`, and the five `village-*` surfaces |
| rows with **no** `site_id` | **195**, across 13 members and 36 keys — not the 21 this plan estimated |

Wiring counts, for the record: HQ declares 29 of canon's 40, refusionist and resonantweaver 10
each, giocoelho 11, demo-fliring 6.

The unkeyed rows are worse than they read. The unique index is on
`(user_id, COALESCE(site_id, '000…0'), feature_key)`, so a null site is **legal** — and since
the table was re-keyed by site, unreadable. 195 toggles nobody can ever reach. That is plan
29's sweep with a name and a number.

**And it caught its own first draft lying.** `{key, label}` also matches the Settings tab's
`settingsSections`, so run one reported five sub-panels — `sites`, `welcome`, `appearance`,
`neon`, `mobile-bar` — as features every app declared and canon had never heard of. A
five-line finding that was entirely the regex. The match window now has to carry
`defaultVisible` or `panel`, which a settings section (`node:`) never does, and the check is
written into the file rather than quietly fixed: a measuring tool that invents findings is
worse than no tool.

**The two decisions it was built to inform, now answerable rather than guessable:**

1. **`support` and `cart` disappear at her cutover.** They are the only two keys her app
   declares that canon does not. Support is a real configured surface for her (the Get Support
   button); Cart is presence-only with no panel — a stub she will not miss. Gio's call, and it
   is now a two-item decision rather than an unknown.
2. **The orphan sweep is not RW work.** It is plan 29's cleanup, and it has a size: three dead
   keys across five sites, plus the 195 unkeyed rows.

## 5 — Parity — **RUN 2026-08-06. Structurally green; ONE ruling open.**

It caught something again, and the check is now a committed tool rather than whoever happens to
look: `clients/tinyglobalvillage.com/scripts/tenant-parity.mjs` (HQ `212885d3`). It derives its
own work list — pages from `page_models`, granted surfaces lifted BY TEXT out of
`siteSurfaces.ts` — then reads all seventeen URLs through a Host-rewriting proxy against the
LIVE renderer and reports status, the publisher a crawler is told, the OG card, the canonical,
every image path, and any asset outside the tenant's own directory. Against her: **0 findings,
1 note.** It is not RW-specific; run it before every future cutover.

**Three defects found and fixed, all deployed** (mono `3fd2310b`, HQ `212885d3`,
`BUILD_ID=DoJ12hs-dmJIOJfjsZAOd`):

1. **`/starseed/`'s StarBot plate 404'd.** Not a code bug — `mac-deploy` ships only `.next`, so a
   NEW file under `public/` stays missing until the RCS source is pulled and pm2 reloaded. The
   deploy is not finished when the smoke test passes if the commit added a public asset.
2. **Every shared app route told a crawler its publisher was Tiny Global Village** — and not only
   hers. `refusionist.com/book/`, `/testimonials/` and `/portal/birth-data/` were doing it live,
   as were giocoelho's and guardians' `/book/`. `organizationJsonLd.ts` had moved the platform
   block into `app/[lang]/layout.tsx` on the premise that everything in that segment is TGV
   serving itself; the surface-grant work falsified it, because `/book`, `/session`, `/meet`,
   `/performers`, `/studio` and every SITE_SURFACES entry live there AND are allowlisted onto
   customer domains. Resolved per request now. Verified on the live domains: each tenant's
   `/book/` names the tenant, the apex still names TGV.
3. **Her six field-guide plates lived in the platform's `public/images/galacticfieldguide/`.**
   Nothing was broken — the surface is hers alone — which is exactly the shape a leak has before
   it has a second tenant. Moved under `/images/tenants/resonantweaver/fieldguide/`; the package
   gained an optional `plates` prop (her app keeps the old default and typechecks clean), and HQ
   always passes an explicit map, handing `{}` to a site it has no plates for.

**THE RULING CAME BACK — the star landing's look wins. DONE AND DEPLOYED 2026-08-06**
(mono `6d2a4f2c`, HQ `61707476`, office `0c2352c`, `BUILD_ID=PFuIpqR4h7p56iuzJnTl0`).
Her three identity rows now carry Science Gothic over Space Grotesk on `#06111c`, both faces
self-hosted under her own font directory and both verified *loaded* in a browser on the live
deploy, with the star landing's two static ellipses in place of OnePage's drifting circles.
`/journey/` loses its serif, which the ruling accepted. Cormorant stays loaded but unnamed, so
per-page typography is one row away rather than a re-run.

Three things the fix needed that the SQL alone would not have given:
`SiteBackdropOrb` learned `width`/`height` (a `66% 36%` wash has no circular equivalent);
`readSiteBackground.cleanOrbs` had to learn them too, because it names every field it keeps —
the row said ellipse, the reader dropped it, and the page drew a circle, which no typechecker
can see; and the generated SQL had to start UPDATING, because insert-only meant the correction
was a silent no-op against rows that already existed.

**One more trap, worth more than this migration.** HQ's first build after the package change
silently bundled the OLD dist — webpack's cache in `.next/cache` did not invalidate on a
changed `@tgv/*` dist, and the browser showed new DATA through old CODE. `rm -rf .next/cache`
before any build that must carry a package change; a green build is not proof it took.

*The finding, for the record:*
Measured on her live app: `/` and `/starseed/` wear **scienceGothic + Space Grotesk** over
`#050a0c`; `/journey/` wears **Cormorant Garamond** at 110px/19px. `generate.mjs` read
`SERIF` out of her `tokens.ts` and made Cormorant the whole site's theme, with
`hsl(165,60%,6%)` → `#061814` (green) from `OnePage.styles.ts` as the ground.

Every one of those values is genuinely hers — but they are **OnePage's** identity, and the
pooled home is the **star landing**, whose own default is the tech face over `#06111c` (blue).
Cormorant appears there only under `&[data-font-preview="original"]`, i.e. the alternative
Marthe was previewing. So `/journey/` ports pixel-faithfully and the home and `/starseed/`
come up serif and green where she is gothic and blue.

Not a bug — a brand decision, and not ours: (a) leave one coherent serif identity across the
pooled site, (b) re-theme to the star landing's tech face + blue ground, which matches her live
home and `/starseed/` and leaves `/journey/` the odd one out, or (c) per-page typography. The
fix belongs in `generate.mjs`, never in `01-theme.sql`, which is generated.

**Also verified:** mobile 390 / tablet 768 / desktop 1440 with no horizontal overflow and no
console errors; her backdrop renders (ground + both drifting orbs); `/journey/` matches her live
page exactly; the field-guide plates decode at 1400px from her own directory.

**One note, for a person not a patch:** `/starseed/` invites contact at
`marthe@tinyglobalvillage.com`. That is her real mailbox and it is her copy, editable in the
studio — whether a customer on her domain should be sent to a platform address is Marthe's call.

**§5 verdict: parity is green.** Seventeen surfaces, 0 findings, 1 note, re-run against the live
deploy. The cutover is not blocked on appearance.

### 5c — Two findings the parity pass missed, both at tablet — FIXED 2026-08-07

Mono `912ebeb2`. Gio reported the hub's door image looking cropped on a tablet. It was, and the
line above — *"tablet 768 … with no horizontal overflow"* — was wrong on the same viewport. A
per-width sweep (390 → 1920, `scratchpad/hero-sweep.mjs`, run against her live site as the
baseline) is what turned a glance into a number.

- **A one-column door card cropped 33% off its own artwork.** `rf-door-card`'s `ratioStacked` is
  documented as *"the proportion once the row is a single column"* and was implemented as
  `@media (max-width: 600px)`. Those coincide only for a multi-up row, which collapses at the
  breakpoint; her row holds ONE door, and the render clamps `columns` to the item count, so it is
  a single column at every width and the stacked ratio could never fire. The card stayed 2:3 and
  `object-fit: cover` ate the sides of a 1:1 photograph. **Not a tablet bug** — the sweep shows a
  cliff at 601px and a flat 33% loss from there to 1920, on her live site today. Tablet is only
  where it is impossible to miss, because the card fills two-thirds of the screen.
  Fixed by honouring the documented contract; her data already carried the right value (`1 / 1`
  for a square image), so no page row changed. 0% cropped at every width now.
- **The hero halo scrolled the page sideways at 768.** `rf-split-hero`'s `Halo` is `inset: -30%`
  on purpose and nothing clipped the bleed; in the two-column layout, which holds down to 768px,
  the mark sits at the grid's right edge and its halo ran 61px past the viewport. `overflow-x:
  clip` on the section (not `hidden`, which would make it a scroll container). **This one IS a
  pooling regression** — her own site does not scroll sideways at any width, and the pooled
  render did.

Blast radius fleet-wide: one `rf-door-card` section, on her `home` row, which is not cut over —
so nothing live changed. Render harness 117/117.

### 5d — DEPLOYED 2026-08-07

`gitrefuse` in the mandated order: mono lane rebased onto `origin/main` (5 commits of another
session's work) and pushed → RCS `git pull --ff-only` + `turbo run build --filter=@tgv/*`
(50/50) → HQ pushed → office pushed → `mac-deploy tinyglobalvillage.com --no-git-sync` from THIS
lane, so the build ran on the Mac and **RCS did zero app build**. `BUILD_ID=DjVYXhoMD9wHByOJWAZNM`
at mono `a6888e13`. RCS source pulled clean on both clients.

**Re-proven on the live deploy** behind the Host proxy, since her domain still points at :3003:
`/landing-star-preview/course/` renders all four tabs with the same field counts as her live site,
wearing `og:site_name` **Resonant Weaver** and her own canonical, `noindex` intact, zero console
messages; the five siblings beside it still serve their page rows and `/landing-star-preview/
courses/` 404s. The gate holds on the real domains — the course 404s on the apex, giocoelho,
guardianstuffies and refusionist. The door-card sweep re-run against the deploy: **0% cropped at
all ten widths, no width scrolls sideways.**

Fleet smoke green: TGV, Office, giocoelho, guardians, nevlo, refusionist (+ `/book/` and the
birth-data portal), demo, stepcenter. `resonantweaver.com` is still served by her own pm2 app on
:3003 — nothing about this deploy moved her. `starseed.resonantweaver.com` answers 404 at the
root **by its own nginx config** (`return 404`; only the FastAPI paths on :3009 are proxied),
which is what it did before.

## 5b — Gio's four rulings, taken 2026-08-06

Answered in the same batch as the typography. **Three of four are done; ruling 3 is the one
left.**

1. **PayPal — a payment CTA that honours the faucet — DONE 2026-08-07.** Mono `49dcd0df`
   (`@tgv/module-page-editor/editor/helpers/paymentLinks.ts`) + HQ `bf78af58`
   (`src/lib/tenants/paymentFaucet.ts`). Built one layer BELOW a CTA kind, and that is the
   whole design: her nine payment links live in three different shapes across two tables
   (`rf-offer-card` `items[].ctaHref` ×6, `rf-media-copy` `ctas[].href` ×1, and the Pearl
   Chamber form's `thankyou.ctas` ×2), so a new section type would have covered none of them
   without re-cutting her pages. The gate runs on the MODEL, server-side, before the renderer —
   which is what makes it cover every tenant who ever pastes a payment link into a page row.
   - **Shape-aware, because "remove the link" has two right answers.** A bare CTA object leaves
     its array (RfMediaCopy maps `ctas` through with no href guard, so deleting the href alone
     draws a labelled anchor pointing at the current page); a CTA that is FIELDS on a richer
     object loses those fields and keeps the item, because the offering still reads without a
     buy button.
   - **Fail-OPEN, explicit-kill-only** — the inverse of `@tgv/module-paypal`'s own fail-CLOSED
     primitive, and copying that would have been a quiet catastrophe. Fail-closed is right for a
     NEW faucet; it is exactly wrong for a link a tenant already published on a live page.
     Carried across from her app's `lib/paypal-enablement.ts`, which has enforced it on this
     exact config since it was written.
   - **`publicFormView` became async** so the form thank-you gates too. In the projection, not
     in each of its six call sites, so a seventh surface cannot serve a killed link.
   - Verified against production, read-only: all 7 links in her 14 published pages and both 2 in
     the Pearl Chamber form reached, 0 survive, every offering's title/body/price and the
     thank-you copy survive, no other pooled tenant has a payment link in a page row. Faucet open
     ⇒ every model returned by identity. 11 unit + 13 render-harness assertions (117/117).
     **Her faucet is ON today, so the cutover changes nothing a visitor sees — only that the
     switch now switches.**
2. **The two waitlist-only offers — DONE 2026-08-07.** Office `e780f0b`. Two `public.forms`
   rows and two page rows, generated like everything else; 17 pages / 4 forms now. One form per
   offer, because her `waitlistTopic` is what told them apart on a single `/api/contact/`
   endpoint and the FORM is what carries that distinction once pooled.
   **What deliberately did not travel is the important half:** both entries hold a
   `[[placeholder — …]]` paragraph and notes she wrote to herself, and `OfferWaitlist` never
   renders `offer.paragraphs` — so they are not on her live site and must not arrive on it via
   the migration. Applied to production, re-run to zero, `--check` clean. Rendered in a browser
   against the live HQ behind the Host proxy and the door was proven to LAND, not merely to
   draw: submitted, thank-you shown, answers in `form_responses` keyed to the right form,
   fixture deleted. `STATUS_LABEL` stopped being an unguarded literal on the way past.
3. **`landing-star-preview/course` — port it. DONE 2026-08-07.** HQ `src/app/[lang]/
   landing-star-preview/course/` + the `SITE_SURFACES` grant. The interactive mockup comes to
   HQ rather than 404ing at cutover the way giocoelho's `/playlists` did.
   **It is a route because it cannot be a row, and that is the only decision here.** Fifteen of
   its siblings under `/landing-star-preview/` ARE rows — the doors, the offers, the archive —
   because they are content. This one is four tabs of text inputs and selects over React state,
   and a row holds no state. So it takes the shape the catalog reserves for exactly that: an app
   route named beside the one site allowed to serve it, gated twice (the proxy routes, the route
   re-checks so the apex 404s).
   **Granted at the LEAF, deliberately.** `siteMayServe` matches a grant as a prefix, so
   `/landing-star-preview` would have swallowed every door and every offer she has — including
   `offer/galactic-initiation`, which this page's own Back link returns to. The harness asserts
   that: the grant 200s, the five siblings beside it still fall through to the storefront, and
   `/landing-star-preview/courses/` 404s.
   **Three files copied, two import lines changed.** `content.ts` is byte-identical (sha
   verified); `Course.styles.ts` differs only in reaching `@tgv/module-starseed/starseed/ui/
   tokens` and `@tgv/module-component-library/styles/hudCardSurface` instead of her local
   `@/styles/*` — both were already canon, so the port added no dependency. `CoursePage.tsx`
   takes `fontClassName` as a prop rather than importing `next/font` itself, matching /sun-walk,
   and drops the `lang` it never read. **L0 on the §7 ladder, and the file says so.**
   **Verified against her LIVE site, tab by tab.** Same fingerprint on both: The Threshold
   (1 textarea, 687 chars), Day One (3 selects, 7 inputs, 1179), Day Two (5 textareas, 849),
   Day Three (8 textareas, 928), every field label identical. Computed styles match too — the
   same Science Gothic / Space Grotesk / Space Mono / Ubuntu Mono chain, `--product-accent`
   `rgb(183, 138, 119)`, the same two radial washes over `#06111c`. Zero console messages.
   Gated correctly: 200 on her host, 404 on giocoelho, refusionist and the apex.
   **ONE PARITY DELTA, and it is not new.** The port has no nav bar and no footer, because on
   HQ **no granted app surface carries the tenant chrome** — `/testimonials`, `/sun-walk`,
   `/galactic-field-guide` and `/open-your-journey` are all bare today, and only page rows get
   the bar. So this page loses her floating nav pill and her "© Resonant Weaver / Powered by
   Tiny Global Village" footer, exactly as `/sun-walk` did when it shipped. Its own "← Back to
   the offer" link still lands. Fixing it is a fleet-wide change to how granted surfaces are
   wrapped, touching five live surfaces — worth doing, not worth doing inside this ruling.
   **Proven on a real production build** (`next build` on the Mac, `next start`, Host-rewriting
   proxy) — NOT dev mode, which does not hydrate behind the proxy at all: `/sun-walk`'s current
   filter is equally dead there, which is what proved the first failed tab click was the harness
   and not the port. Typecheck: the same 12 errors in the same 12 files as baseline.
4. **`support` and `cart` — APPLIED TO PRODUCTION 2026-08-07**, ahead of the cutover, because
   the reason for holding it back turned out to be false. `06-cutover-features.sql`: `DELETE 2`,
   35 → 33 rows, assertions green, re-run is `DELETE 0`. The ledger now prints `orphan rows —`
   for her where it read `cart, support`.
   **The correction is the useful part.** This file's first header said run it at the cutover:
   *"deleting the rows while :3003 serves her would take two working tabs off a live
   dashboard."* That assumed her app reads `public.dashboard_features`. It does not.
   `resonantweaver_app` carries `search_path=resonantweaver, public` as a **per-database** role
   setting — `pg_db_role_setting`, not `pg_roles.rolconfig`, which is where the first look went
   and found nothing — and `resonantweaver.dashboard_features` exists with 62 rows across 10
   members. Her `readFeatureState` queries the bare relation name, so every tab her live
   dashboard draws comes from HER schema's copy, and the rows deleted here were only ever read
   by HQ.
   **Which answered a question this migration had never asked:** do those 10 members lose their
   toggles when she pools? No — all 62 rows are `visible = true` (nobody has ever hidden a tab)
   and HQ's defs are `defaultVisible`, so the pooled dashboard shows the same thing without
   them. The 35 rows in `public` were one member's, Marthe's, seeded platform-side.
   `cart` is presence-only with no panel; `support` was real for her, and HQ serves Get Support
   through `/api/forms/get-support` rather than a dashboard key — the capability moves, the
   toggle goes. The other tenants' orphans (giocoelho, guardians, nevlo, refusionist) are
   deliberately untouched: those are plan 29's, not hers. The two deleted rows are kept as a
   CSV beside the run, so the undo is an INSERT rather than a restore.

## 6 — The cutover — **DONE 2026-08-07. resonantweaver.com is served by the pooled renderer.**

Port anything outward-facing FIRST, deploy it, then flip. That order is what made refusionist's
iCal feed survive.

**What ran, in order.** nginx split three ways (backup at
`sites-available/resonantweaver.com.pre-pool-2026-08-07`; `nginx -t`; reload) → verified live
through Cloudflare with her app STILL RUNNING, so a rollback was one command the whole time →
`pm2 stop resonantweaver.com` + `pm2 save` → re-ran `05-journey-signups.sql`.

**The flip was proven to have actually happened, not assumed.** Refusionist's first flip silently
did nothing because `sites-enabled` held a regular file; hers is a real symlink, and the check
that settles it either way is the RESPONSE, not the config: `/landing-star-preview/course/` now
returns the title **"Galactic Initiation — Course Preview — Resonant Weaver"** — the site-name
suffix only HQ's `tenantAppMetadata` appends, which her own app never emitted — and every
response carries `x-tgv-subdomain: resonantweaver`, the header HQ's proxy stamps. After
`pm2 stop`, **nothing listens on :3003** and all eleven surfaces still answer 200. That is the
proof: the old app cannot be the one serving.

**www is its own block now.** `www.resonantweaver.com` 301s to the apex preserving the path
(`/starseed/` → `resonantweaver.com/starseed/`). Without it HQ — which matches
`villager_sites.domain` exactly — would have found no site for `www.` and served Tiny Global
Village on her domain. The cert already covered both names (SAN checked before editing).

**URL shape survived:** `/starseed` still 308s to `/starseed/`, as it did on her app.

**Sessions (plan 43) needed no work, exactly as predicted.** `/dashboard/`, `/login/`,
`/editor/home/` and `/studio/` all 302 to `resonantweaver.tinyglobalvillage.com/api/auth/handoff`,
and the chain completes into the Keycloak login carrying its `returnTo` — the custom-domain
handoff built for giocoelho already covers her. Everyone is signed out once.

**Step 8 found an empty window.** `05-journey-signups.sql` re-run: **0 new rows** — nobody signed
up between the first run and the flip — 2 rows total, assertions green. The `ON CONFLICT (id) DO
NOTHING` over preserved ids is what made a second run safe to do rather than reason about.

**Fleet green on the same pass:** TGV, Office, giocoelho, guardianstuffies, neverendinglogic,
refusionist (+ `/book/`), demo, stepcenter — and her gated surfaces still 404 everywhere else
(`/sun-walk/` on the apex, `/galactic-field-guide/` on giocoelho, the course on guardianstuffies,
`/open-your-journey/` on refusionist). `starseed.resonantweaver.com` untouched on :3009, still
404-at-root by its own nginx `return 404`. RAM did not move measurably — her app was idle.

**Rollback remains one file and one command:** restore the backup beside the config, reload
nginx, `pm2 start resonantweaver.com`. And now — unlike this morning — a rollback followed by a
code fix also works, because the Mac's shared checkout was reconciled and proven to build first.

1. ~~**Check Stripe** for endpoints registered against `resonantweaver.com`.~~ **DONE 2026-08-07 —
   there are none, and there is no account of hers to check.** Her `.env.local` holds **zero**
   `STRIPE_*` keys, so unlike refusionist she never had a legacy account of her own. The platform
   account carries four endpoints and all four name `tinyglobalvillage.com`, except refusionist's
   `user/connect/webhook`, already disabled at its own cutover. Nothing to disable, nothing to
   repoint. (Checked read-only against the live Stripe API from RCS, so the key never moved.)
2. **Env — DONE 2026-08-06.** `STARSEED_GPT_URL`, `STARSEED_ENGINE_URL` and `STARSEED_API_TOKEN`
   are in HQ's `.env.local` (backup `.bak-pre-journey-20260806`); they take effect at the next
   reload. Her `SMTP_*` needed no move: HQ and her app authenticate to the SAME account, verified
   by hash, so the mail can still go out as `connect@resonantweaver.com` — which is what
   `src/lib/journey/config.ts` sets it to send as.
3. **nginx.** Hers is a real symlink into `sites-available` — check anyway, because
   refusionist's was a regular file and the first flip silently did nothing. Split the block
   three ways rather than editing one line:
   - `resonantweaver.com` → `proxy_pass` :3003 → **:3001**
   - `www.resonantweaver.com` → **301 to the apex**. HQ matches `villager_sites.domain`
     exactly, so `www.` would fall through and serve Tiny Global Village on her domain.
   - the `/recordings/` alias points at `/srv/refusion-core/data/recordings/resonantweaver/`,
     which is **empty**. Dead, like refusionist's `/uploads/`. Leave it exactly as it is — a
     cutover changes one thing.
4. **`starseed.resonantweaver.com` is a different app on :3009** and is not part of this. Do
   not touch it; confirm it still answers after the flip.
5. **Verify on the live domain through Cloudflare** before stopping anything: every page 200
   wearing her own name, `/sun-walk` and `/galactic-field-guide` still gated to her host and
   still 404 on the apex, giocoelho, guardians and refusionist.
6. **`pm2 stop resonantweaver.com` + `pm2 save`.**
7. ~~**`06-cutover-features.sql`**~~ — **ALREADY DONE, 2026-08-07.** It was held for this step
   on a premise that did not survive being checked (§5b ruling 4): her live app reads
   `resonantweaver.dashboard_features`, not `public`, so the delete could never have touched a
   live tab. Applied, re-run to zero, ledger confirms `orphan rows —`. Nothing to do here.
8. **Re-run `05-journey-signups.sql`** (carried from §2).

**Sessions cost nothing.** She has her own host-only `rw_member_session`, her own
`WEBAUTHN_RP_ID` and her own Keycloak client — the same shape refusionist had, where the
custom-domain handoff built for giocoelho already covered it. Everyone is signed out once.
That is Marthe.

**URL shape — CONFIRMED 2026-08-07, before the flip.** Five paths (`/starseed`, `/journey`,
`/writing`, `/pearl-chamber`, `/landing-star-preview/receive`) asked without a trailing slash on
her live app and on HQ behind a `Host:` header: **308 to the same slashed target on both sides,
every time.** Every indexed link keeps its shape. This is the check that saved giocoelho's.

**nginx is a real symlink** (`sites-enabled/resonantweaver.com` → `../sites-available/…`), so the
trap that made refusionist's first flip silently do nothing does not apply — but re-verify at the
moment of the edit rather than trusting this line.

### Pre-flight state, 2026-08-07 — everything is ready except one judgment call

Steps 1, 2, 4, 7 are done; 3 (nginx), 5 (verify), 6 (`pm2 stop`) and 8 are the flip itself.

**The rollback is in better shape than §4's hazard note implies, and the note needs correcting.**
It says her app "still has to BUILD for the rollback path to exist" and points at the Mac's
shared `clients/resonantweaver.com`, which is on `main` at `ee8569d`, **5 behind** `origin/main`,
with **nine** modified tracked files of another session's work — including the very
`LandingStarPreview.{tsx,styles.ts,content.ts}` this migration reads from. That is all true.
But it is not what rollback runs on. **RCS's checkout is clean, at `origin/main` (`ad3c91b`, 0
behind, 0 dirty), and carries a completed `.next` (`BUILD_ID=KxgUKv9FIrl1E3sWZiaUC`) — the build
serving her site right now.** Rollback is `pm2 start` against that plus the nginx backup: no
build, no Mac checkout, no dependency on anybody's dirty tree.

So the accurate statement of the risk is narrower: **an immediate revert works today; a revert
followed by a code FIX would need the Mac's shared checkout reconciled first**, because RCS must
never build.

**GIO'S RULING: clear it first. DONE 2026-08-07 — and there was nothing to lose.** The nine dirty
files looked like another session's in-flight work; **eight of them were byte-identical to
`origin/main`**. That session had already committed and pushed from somewhere else; this checkout
simply never advanced, so unchanged content read as "modified" against a stale `ee8569d`. The
ninth was `next-env.d.ts`, differing by the one line Next itself writes on a local build, in a
file whose own header says it should not be edited.

Verified before touching anything (`git diff origin/main -- <file>` per file, all empty), copied
the whole dirty set to the session scratchpad anyway, then `git checkout --` and
`git merge --ff-only origin/main`. **No `git stash`** — forbidden on the shared tree, and the
overlap made a plain ff impossible without first discarding, which the identity check is what
made safe. The untracked `src/app/api/auth/dev-login/` is somebody's and was left alone.

**The rebuild path is now proven, not assumed:** shared checkout at `ad3c91b` (= RCS = origin),
`pnpm install --frozen-lockfile` green from the FULL workspace with the lockfile untouched, `@tgv`
dists FULL TURBO at `a6888e13`, and `next build` **compiled successfully** —
`BUILD_ID=2h-sLzOKhmF5NLP1xza1f`. The root install was re-run unfiltered afterwards so the
`--filter` prune did not leave the workspace short for another session.

Her site never moved: still 200 on :3003 throughout.

**Rollback** is the nginx backup beside the config plus `pm2 start`, exactly as it has been
for the two before her.

## 7 — Then the conversion track

Only after the flip. Record each component's level (L0 Ported → L1 Content freed → L2
Parameters declared → L3 Choreography wired → L4 Canon) and climb one rung at a time.
`journey/tokens.ts` and `starseed/ui/tokens.ts` are byte copies of her palette because the
components interpolate it into `rgba()` a few hundred times; turning that into `color-mix` is
the first rung, and it has to be done against screenshots rather than in the same commit as a
file move.

## What is deliberately NOT in this plan

`home-classic` — her kept-aside old landing, the same way `retiredDoors` keeps the two doors
she took off the hub. It is hers to bring back, not ours to port.
