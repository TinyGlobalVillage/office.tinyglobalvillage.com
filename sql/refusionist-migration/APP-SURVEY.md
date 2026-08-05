# Refusionist → HQ — the app half, surveyed

Plan 43, 47, 38. **Survey only, 2026-08-04. Nothing built, nothing moved.**

`README.md` in this directory covers the data. This covers the other half: what
happens to refusionist.com's 39 page routes and 241 API routes the moment DNS
points at HQ. The measure is the giocoelho measure — *how much of the site
lives in the database* — and the answer is: almost none of it, but far less of
the rest is missing than 39-vs-4 suggests.

## The headline

**208 of refusionist's 241 API routes already exist in HQ at the identical
path.** Only 33 are refusionist-only, and half of those die on contact with
pooling rather than needing a port.

**7 of the page routes that 404 on a tenant host today are already built in HQ,
byte-for-byte.** `/session/`, `/session/{confirmed,greenroom,holding}/`,
`/meet/[token]/`, `/meet/[token]/host/` and `/performers/` exist in
`tinyglobalvillage.com/src/app/[lang]/` at the same line counts against the same
`@tgv/module-video-calls` and `@tgv/module-performers`. They 404 for one reason:
HQ's proxy does not allowlist them on a custom domain, so it rewrites them into
the `/u/<sub>/` storefront where they are not pages. That is a function in
`src/proxy.ts`, not a port.

## How a custom domain routes today

Verified by probing the live HQ on :3001 with a `Host:` header — read-only GETs,
nothing moved. `giocoelho.com` is the control, because it is a correctly-wired
pooled tenant; `refusionist.com` is the subject.

On a custom domain HQ serves exactly four things and rewrites everything else
into `/u/<subdomain>/<rest>`:

| Allowlist | Routes |
|---|---|
| `isMemberAppRoute` | `/dashboard*`, `/login*`, `/editor*` |
| `isStorefrontRoute` | `/storefront*`, `/testimonial/*`, `/review/*` |
| under `/u/<sub>/` | `[...slug]` page rows, `blog/[postSlug]` |
| skipped outright | `/_next`, `/api`, `/favicon.ico`, `/u/` |

Everything else 404s. Confirmed against giocoelho: `/about/` `/fitness/`
`/gallery/` `/hemp/` `/humandesign/` `/resume/` `/recipes/paodequeijo/` all 200
(they are page rows); `/blog/` `/cart/` `/collections/` `/session/` `/meet/…/`
`/performers/` `/schedule/` `/studio/` `/subscribe/` all 404.

**This is a fleet fact, not a refusionist fact.** The order-of-work note from
giocoelho's cutover said HQ "serves all of these itself" of `blog`,
`collections`, `courses`, `subscribe`, `cart`, `dashboard`, `login`, `editor`,
and flagged them as needing a click-test. The click-test is now done and the
answer is no: on a tenant host only `dashboard`, `login` and `editor` work.
guardians and nevlo have the same gap.

**And refusionist does not resolve as a tenant at all yet.** Its `villager_sites`
row already carries `domain = 'refusionist.com'` and `deploy_status = 'live'`,
but `subdomain` is **NULL** — and the custom-domain branch is gated on
`member?.subdomain`, so the whole tenant path is skipped and the request falls
through to *apex* routing. That is why the refusionist probe returned 200 for
`/session/` and `/meet/…/` where giocoelho returned 404: it was being served
HQ's own apex pages, not tenant pages. `00-preflight.sql` sets the subdomain, so
that line is load-bearing for routing and not only for the data keys.
`resonantweaver.com` is in the same state — latent, harmless while DNS points
elsewhere.

## The 39 page routes, dispositioned

**A — already in HQ; needs a proxy allowlist entry, nothing more (7)**

`/session/`, `/session/confirmed/`, `/session/greenroom/`, `/session/holding/`,
`/meet/[token]/`, `/meet/[token]/host/`, `/performers/`.

Same mounts, same packages, same sizes. `/cart/` very nearly belongs here too —
refusionist's is `@tgv/module-storefront/components/CartContainer` and HQ's
storefront allowlist already keeps a guest cart on the tenant origin — so it is
an allowlist decision about which path spellings count, not a port.

**B — content; author as `page_models` rows, exactly the giocoelho move (10)**

`/about/`, `/fitness/`, `/gallery/`, `/hemp/`, `/humandesign/`, `/resume/`,
`/legal/privacy/`, `/legal/terms/`, `/recipes/paodequeijo/` (+`/print/`).
Every one is a thin `[lang]/<page>/page.tsx` mounting a local
`@/lib/domains/marketing/*` component — 6 to 62 lines of mount over hand-written
React. `/resume/` is a timeline, which is the block nevlo's history already
uses. `/legal/*` are 137 and 150 lines of prose.

**C — HQ owns the module but has no page route on any host (6)**

`/studio/` (`@tgv/module-studio/dashboard/StudioShell`), `/course/[slug]/design/`
(`@tgv/module-course/dashboard/designer`), `/blog-editor/`, `/blog/` (+`[slug]`),
`/collections/` (+`[slug]`). HQ has the API buckets for all of them
(`api/studio` ×7, `api/course`, `api/blog`, `api/user/blog/*`) and its own
`blog-editor` at the apex. These need a page route and a scoping decision, not a
new engine.

**D — genuinely refusionist-local; each needs a ruling (6)**

- `/schedule/` — mounts a local `@/lib/domains/booking/BookingScheduler`. HQ's
  equivalent is `/book/` on `@tgv/module-appointments`. Two different booking
  UIs over data that now lands in the same tables. **Port, replace, or drop.**
- `/portal/birth-data/` — 259 lines, cospro, plus four refusionist-only admin
  API routes (`user/admin/cosmic-profiles*`,
  `user/admin/users/[userId]/can-add-extra-charts`). `@tgv/module-cospro` is
  panel-only today; its schema and queries stay in refusionist deliberately
  until plan 44 moves the tables.
- `/testimonials/` — an open submit form. HQ's `/testimonial/[token]/` is
  token-gated and already allowlisted. Different shapes.
- `/subscribe/` (+`/verify/`) — 15 lines, no imports, inline.
- `/refusionmarketing/` — served on its **own host**,
  `refusionmarketing.refusionist.com`, via a rewrite in refusionist's
  `src/proxy.ts`. A second DNS name that has to go somewhere.
- `/demo/` — one `CurvedTrapezoid` for a developer. Drop.

**E — works already (3):** `/` (the `home` page row), `/[...slug]`,
`/dashboard/`, `/login/`, `/editor/[slug]/`.

## What the database says is actually alive

Recency across every populated refusionist table, which reorders the work:

| surface | rows | last touched |
|---|---|---|
| `connect_charges` | 3 | 2026-08-01 |
| `cosmic_profiles` / `user_cosmic_profiles` | 13 / 8 | **2026-07-28** |
| `meetings` | 14 | **2026-07-17** |
| `announcement_user_status` | 9 | 2026-07-15 |
| `support_settings` | 1 | 2026-07-09 |
| `platform_admins` | 1 | 2026-07-06 |
| `dashboard_features` | 102 | 2026-06-21 |
| `studio_*` | 9+4 | 2026-06-11 |
| `page_models` | 4 | 2026-04-30 |
| `availability_*` / `bookings` | 25 / 33 | 2026-04-15 |
| `session_state` | 66 | 2026-04-10 |
| `posts` / `collections` / `plans` / `prices` | 3 / 1 / 4 / 4 | 2026-02-16 |

**The hot surfaces are cospro and meet.** The booking engine — the second-biggest
lift in plan 45 — has not taken a booking since April. `session_state` is four
months cold. The blog and the store have not moved since February. Category D's
`/schedule/` ruling is therefore much cheaper than its 33 rows imply, and the
cospro portal is the one place where a wrong call is felt this month.

## The 33 refusionist-only API routes

- **Three vanish on pooling** — `connect/managed/[[...path]]`,
  `storefront/[[...path]]`, `wallet/[[...path]]` are proxies *from* refusionist
  *to* HQ, forwarding with `INTERNAL_API_SECRET` so refusionist never holds the
  Stripe key. When the site is HQ there is nothing to forward.
- **One is superseded** — `user/editor/blog/[...op]` is a catch-all over
  create-post / list-posts / update-meta / categories / setup. HQ has all five as
  discrete routes under `user/editor/blog/`.
- **Six are the legacy Stripe booking flow** — `stripe/{checkout,first-session,
  payment-intent,setup-intent,release-holds,validate-promo}`, on refusionist's own
  standalone Stripe account. They ride with the `/schedule/` ruling.
- **Two are dead** — `auth/dev-login` (dev only) and `uploads/[...path]`, which
  reads `UPLOADS_ROOT`; that variable is **not set** in production, so the route
  500s. nginx serves `/uploads/` instead, by `alias` — from
  `/srv/refusion-core/client/uploads/refusionist.com/`, a path that does not
  exist (`client/`, not `clients/`). The real directory holds one empty
  `test.txt`. **There are no uploads to migrate**, and giocoelho's
  broken-image trap does not apply here: none of the four page rows reference
  `/api/uploads/`, `/images/`, or an absolute `refusionist.com` URL.
- **The rest are real** — `analytics` (promoted to canon in the data half, needs
  a reader), `calendar/feed` (a **public iCal subscription** keyed by a secret in
  the query string — external calendar clients hold this URL and it must keep
  answering), `humandesign/{calculate,cosmic-profiles}`, `portal/birth-data`,
  `public/plans`, `subscribers/verify`, `studio/payments` (+`webhook`),
  `user/connect/{charge,charges,webhook}`, `user/upload-image`,
  `user/calendar-sync`, `view-settings-visibility`, `yellow-pages`, and the four
  cospro admin routes.

**Two are webhook endpoints registered in a Stripe dashboard** —
`user/connect/webhook` and `studio/payments/webhook`. If refusionist.com stops
answering them, deliveries fail silently against a 404. They must be repointed or
served, and that is a step in the cutover, not a code port.

## Two URL-shape facts that survive the move

Both apps set `trailingSlash: true`, so `/about/` stays `/about/` — the same
check that saved every indexed giocoelho URL. And both hide the default locale:
refusionist 308s `/en/*` to bare, HQ does the same on a tenant host. The link
shape is unchanged in both directions.

Refusionist's proxy also carries two redirect families HQ does not: the flat-route
308 (`/<lang>/<user>/dashboard` → `/<lang>/dashboard`, for the 2026-06-21
dashboard convergence) and the `/u/` strip. Both exist to unwind history that
pooling makes moot, but the 308s are load-bearing for anything still linking the
old shape.

## What this survey does not answer

The rulings in category D, and the sessions cutover of plan 43 — 2 real accounts
and 6 live sessions behind a host-only `refusionist_member_session` cookie and
refusionist's own Keycloak client, both of which change with the pooling.

And the browser pass (38) stays mandatory. Every defect that mattered while
pooling giocoelho — the unrendered home hero, the broken images, the missing
starfield, the TGV chrome — was invisible at this level and obvious the moment
something rendered.
