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

## 4 — Rewire her own app onto the packages

`@tgv/module-journey` and `@tgv/module-starseed` were extracted FROM her app and her app still
runs its own copies. Pointing it at the packages is what proves the extraction from the other
side, and it keeps the rollback path building — a stopped app you cannot rebuild is not a
rollback. Use the tsconfig-alias trick already in place for `@/lib/starseed/*`, so her public
pages do not have to change.

## 4b — The convergence ledger, because nothing measures the gap (Gio, 2026-08-06)

Prompted by a real sighting: her Settings tab still offers **Support** and **Cart**, features
dropped from the shared registry weeks ago. Traced, and the trace matters more than the
symptom — *we had no way to see it, and still have none for anything like it.*

**Where those two come from.** Her app declares them itself.
`clients/resonantweaver.com/src/app/[lang]/dashboard/DashboardWithFeatures.tsx` lists fifteen
`DashboardFeatureDef`s, `support` and `cart` among them, both `defaultVisible: true`.
`mergeFeatureCatalog(hostFeatures)` passes a host's own keys through **unchanged and by
design** — that is the same seam her bespoke `profile` engine rides in on, so it cannot just
be closed. Neither key is in `FEATURE_REGISTRY` (40 keys) any more. Her dashboard is still
served by her own app on :3003, so what she is looking at is her app's list, not the
platform's, and it will keep saying that until the flip.

**Three sources of truth, measured today, and nothing reconciles them:**

| Source | Where | Count |
|---|---|---|
| The canon | `@tgv/module-dashboard/helpers/featureRegistry.ts` | **40** keys |
| Her app's wiring | `DashboardWithFeatures.tsx` | **15** defs |
| Her data | `public.dashboard_features` for her `site_id` | **34** keys |

The three disagree in both directions, and the disagreement is **fleet-wide, not hers**:

- **34 orphan rows** name keys the registry no longer has — `cart` (19), `support` (10),
  `subscriptions` (5) — spread across giocoelho, guardians, nevlo, refusionist AND
  resonantweaver. Pooled tenants are protected by `validRegistryKeys`, which will not place
  an unknown key, so they are inert *there* and would surface anywhere the host declares
  them. **21 more rows carry no `site_id` at all.**
- **Seven registry keys have never been seeded anywhere**: `account`, `seo`, `village-blog`,
  `village-forums`, `village-listing`, `village-reviews`, `village-testimonials`.

**Why we could not see it.** Every guard in this migration family is per-artefact and
one-directional — a string against its source file, a row count against a copy, an asset path
against `public/`. Each answers "did what we ported arrive?" None answers "what does she have
that the platform does not, and what does the platform have that she has not been given?"
The phases track work done, not distance remaining, so a gap that nobody ported *into* is
invisible by construction. Same shape as the miss that put her archived landing in as `home`:
thorough one level below the question.

**So build the ledger, and build it before parity.** One script that reads all three sources
and prints, per site: keys in canon and not in her data (never seeded), keys in her data and
not in canon (orphans to sweep), keys her app declares that canon does not (what the cutover
will silently drop — `support` and `cart` are exactly this), and keys canon has that her app
never wired (what the cutover will silently ADD, which is most of the 34 HQ panels). It is a
read-only report; it belongs beside `generate.mjs --check` and it wants to run for every
tenant, not only for her.

Two things fall out of it immediately and neither should be guessed at:

1. **`support` and `cart` disappear at her cutover** unless HQ carries them. Support is a real
   configured surface for her (the Get Support button); Cart is presence-only with no panel,
   which is a stub she will not miss. Decide each with the ledger in hand, not on the day.
2. **The orphan rows want a sweep**, and it is not RW work — it is plan 29's cleanup with a
   name. A row whose key no longer exists is a toggle that can never do anything.

## 5 — Parity (plan 38, the step that has caught something every single time)

Screenshot every page standalone vs pooled at three viewports and diff. Her own
`FontPreviewSwitch` is a ready-made harness. Render through the LIVE HQ behind a
Host-rewriting proxy, so resonantweaver.com never moves to be tested.

Do not treat "the rows copied" as done. Every defect in this migration family was invisible in
SQL and obvious in a browser: a slug with a slash had no reachable URL, a tenant wore TGV's
nav, a site lost its sky, a home page rendered nothing because one section type was not in the
catalog, six dossier plates 404'd because a package cannot carry an app's `public/`.

Check specifically: every `/images/*` path resolves under `/images/tenants/resonantweaver/`;
her backdrop is present; no banned platform string appears on her domain; `<head>` and the OG
card both say Resonant Weaver, not Tiny Global Village.

## 6 — The cutover

Port anything outward-facing FIRST, deploy it, then flip. That order is what made refusionist's
iCal feed survive.

1. **Check Stripe** for endpoints registered against `resonantweaver.com`. Refusionist's survey
   had this wrong in both directions — one endpoint listed that did not exist, one live that the
   survey never mentioned. Disable rather than delete, so the signing secrets survive.
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

**Sessions cost nothing.** She has her own host-only `rw_member_session`, her own
`WEBAUTHN_RP_ID` and her own Keycloak client — the same shape refusionist had, where the
custom-domain handoff built for giocoelho already covered it. Everyone is signed out once.
That is Marthe.

**URL shape:** confirm `trailingSlash` matches on both sides BEFORE the flip, with a `Host:`
header, not after. It is the check that saved giocoelho's indexed links.

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
