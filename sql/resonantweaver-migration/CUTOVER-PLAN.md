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

## 1 — Bucket B, her commerce funnel

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
giocoelho.

## 2 — The journey signups

`open-your-journey` is not only a page. Its server action validates an email, writes a signup,
sends an access email and redirects to a private GPT whose URL never reaches the client.

- `journey_signups` needs a `site` key in `public` and its 2 rows copied. Drive the copy off
  the TARGET's column list plus the forced keys — the trap that put refusionist's home page in
  as demo content was a forced key falling out of the column intersection, and it passed a
  row-count check.
- The reader is already the right shape: raw `sql` on an injected executor with a bare table
  name, so it resolves through the caller's `search_path` and serves both sites unchanged.
- `STARSEED_GPT_URL` must reach HQ's `.env.local`, along with `STARSEED_ENGINE_URL` and
  `STARSEED_API_TOKEN`. A missing GPT URL is a redirect to nowhere, after the email has sent.
- `/api/admin/journey-signups` is her CSV export, gated by "only Marthe can hold a session
  here" — an assumption that is false the moment she is pooled. It needs an ownership gate,
  not a session gate, or it hands one operator every tenant's list.

## 3 — The ten API routes that are hers alone

Of 116, ten have no HQ twin. Only three are work.

**Vanish on pooling** — `connect/managed/[[...path]]`, `storefront/[[...path]]`,
`villagers/[[...path]]`, `wallet/[[...path]]`. Every one is a proxy that forwards to HQ with
`INTERNAL_API_SECRET`. When she IS HQ there is nothing to forward to; delete, don't port.

**Dead or dev-only** — `auth/csrf` is a NextAuth `signOut()` preflight shim; `starseed-preview`
is unset in production and answers its own 404.

**Real ports** — `meeting/scheduled` (a host's upcoming calls), `user/calendar-sync` (returns
the host's private iCal subscription URL) and `paypal/enabled` (her PayPal faucet's killswitch).
`user/calendar-sync` only MINTS the URL — the feed path itself already exists in HQ — so unlike
refusionist's iCal feed this one is not held by anyone's calendar app. Port it anyway; it is
twenty-seven lines.

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
2. **Env.** `STARSEED_GPT_URL`, `STARSEED_ENGINE_URL`, `STARSEED_API_TOKEN` and her `SMTP_*` /
   `FROM_EMAIL` onto HQ, or the access email sends from the wrong place or not at all.
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
