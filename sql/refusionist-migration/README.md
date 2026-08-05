# Refusionist → `public` — the data migration

Plan 41–48. **Rehearsed and green 2026-08-04.**

**`00-preflight.sql` IS APPLIED TO PRODUCTION** (2026-08-05, plan 44). It is DDL
only — eleven empty tables, four `site` columns, one `platform_config` column and
the `villager_sites.subdomain` key — and it went in early because the cospro app
half reads those tables: code written against a table that does not exist cannot
be verified, and unverified is how the last three defects reached production.
A `pg_dump -n public -Fc` was taken first, at
`/srv/backups/tgv_db-public-pre-plan44-*.dump` on RCS. Re-running it is a no-op;
it was re-run twice to prove that. **`01`, `02` and `03` are still unapplied** —
they move ROWS, and rows wait for the cutover.

This is the *data* half of pooling refusionist.com onto the shared renderer:
every row that belongs to the site moves from the `refusionist` schema into
`public`, keyed to the tenant, with the identities reconciled. The app half —
sessions, chrome, routes — is surveyed in **`APP-SURVEY.md`** next to this file
and not yet built; see also "What this does NOT do".

```
rehearse.sh          rebuild a throwaway copy of tgv_db, run 00→03 against it
00-preflight.sql     DDL: site keys, the cospro + analytics tables, enums
01-id-map.sql        legacy member id → platform member id
02-copy.sql          the copy, in FK order, ON CONFLICT DO NOTHING
03-verify.sql        assertions; read-only, ends in ROLLBACK
```

All four are re-runnable. `02-copy.sql` reads `refusionist.*` and never writes
it, which is what keeps rollback cheap: the source schema is still sitting
there, and the old app is still installed.

## Run it

Rehearsal (on RCS — the database is loopback-only):

```bash
bash sql/refusionist-migration/rehearse.sh
```

Drops and rebuilds `refusionist_rehearsal` from a `pg_dump` of `tgv_db`, runs
the three steps, verifies, and prints a before/after row-count diff. `tgv_db`
is read once and never written. Takes about a minute; the database is 47 MB.

Production, when the app half is ready (`00` is already in — re-running it is
harmless and it stays in the list so the sequence reads whole):

```bash
psql -v ON_ERROR_STOP=1 tgv_db -f 00-preflight.sql
psql -v ON_ERROR_STOP=1 tgv_db -f 01-id-map.sql
psql -v ON_ERROR_STOP=1 tgv_db -f 02-copy.sql
psql -v ON_ERROR_STOP=1 tgv_db -f 03-verify.sql     # ends in ROLLBACK
```

`03-verify.sql` is a *post*-copy check — run before the copy it will correctly
report every eligible row as missing.

## What the survey found

Plan 42 called identity the risk: *"Refusionist's `members.id` reuses its
legacy `users.id`, so merging into `public.members` can collide with ids
already there."* The reuse is real. The collision is not — **not one id in the
refusionist schema exists in `public.members`.** What overlaps is the *person*,
by email, which is a merge rather than a rename.

The population is also far smaller than the plan assumed:

| | rows |
|---|---|
| `refusionist_db.public.users` (the legacy store) | 15 |
| `refusionist.members` (the two that were migrated) | 2 |
| of the 15, fixtures (`@example.com`, `@demo.refusionist.com`) | 11 |
| of the 15, real people | 4 |

Three of the four real people are already platform members. The fourth,
Roy Busch, never became a refusionist member and owns nothing but six
`dashboard_features` UI prefs, so he is skipped — see the map's note.

Structurally it is in better shape than the plan feared too. 41 of the 48
populated refusionist tables have a `public` twin; **32 of those are
column-for-column identical**, and the nine that differ differ only because
`public` is a superset (`site` / `site_id` / `tenant_id` / `env`). Every shared
enum has identical labels. There is exactly **one** type mismatch in the whole
schema — `connected_accounts.id`, uuid here and integer there — and that table
is not copied.

Rehearsal result: **309 eligible rows reconciled by primary key, 0 missing.**

## The rulings this encodes

Taken 2026-08-04. Each is a decision about people or money, not about rows.

- **Gio's two identities merge.** `connect@refusionist.com` folds onto the
  platform row (username `refusionist`). One Gio, one login, one dashboard. It
  carries 27 of the 33 bookings, 3 pages, 7 cosmic profiles and every
  announcement with it.
- **The 11 fixtures stay behind, but their bookings come.** The rows already
  carry name and email; `client_user_id` is nulled and they land as guest
  bookings. Nine of the 33 are re-seated this way. Nobody invents 11 platform
  accounts to preserve test data.
- **announcements, plans, prices and promo_codes get a `site` key.** Refusionist's
  20 announcements are its own product changelog ("Human Design Engine is
  Live"); unscoped they would surface on guardianstuffies.com. `promo_codes`
  rides along for the same reason — a discount minted for a refusionist plan
  must not apply to another tenant's checkout. `NULL` still means
  platform-wide, so nothing already live changes meaning.
- **All seven analytics tables are promoted to canon**, including the three
  empty fact tables, so the surface has somewhere to write.

## What the rehearsal caught

Two things that a row-count check would have called green:

1. **`public.page_models.site` DEFAULTS to `'demo'`.** The first copy forced
   `site = 'refusionist'`, but `site` does not exist on the *source* table —
   it is one of the columns `public` added — so the forced value fell out of
   the intersection and the pages inserted on the default. Refusionist's home
   page landed as demo content, silently, and the row count was correct.
   `ref_copy` now drives off the public column list plus the forced keys, and
   raises if a forced key is not a column of the target.
   The same trap applies to `content_overrides.tenant_id` and
   `testimonials.site_id`, and to any future tenant pooling.

2. **8 rows in production `public.dashboard_features` point at members who do
   not exist.** Pre-existing, nothing to do with this work — that table has no
   FK to `members`. `03-verify` reports them as a notice rather than failing,
   because failing would be blaming the migration for what it found.

## What this does NOT do

The data is the easy half. Before refusionist.com's DNS can move:

- **Sessions cut over (plan 43).** `member_sessions` and
  `auth_verification_tokens` are deliberately *not* copied — the cookie
  (`refusionist_member_session`, host-only) and the Keycloak client change with
  the pooling, so every session is invalidated on purpose. That is 2 real
  accounts and 6 live sessions, so the "announce it, do it off-peak" of plan 43
  is smaller than it sounded, but the app-side rewiring is still real work.
- **`connected_accounts` / `connect_charges` are not copied.** The id type
  differs, and `public` already holds a live Connect account for refusionist's
  `site_id` — a newer Stripe account than the legacy one in the schema. Copying
  would give the site two. Worth a look on its own: two of the three
  `connect_charges` rows are webhook deliveries for *other* sites' accounts, so
  refusionist's app has been logging the fleet's Connect events into its own
  schema.
- **`platform_config` does not merge** — both sides are singletons keyed
  `id = 1`. Only the column `public` lacked comes across
  (`view_settings_visibility`, the cospro chart-surface toggles), onto the row
  that is already there.
- **`zz_*_preunify` (52 tables)** are plan 29's archive. Dump and drop
  separately.
- **The app.** refusionist.com is 39 page routes and 241 API routes, against 4
  `page_models` rows. **Now surveyed — see `APP-SURVEY.md`.** The short version:
  208 of the 241 API routes already exist in HQ at the identical path, and 7 of
  the page routes that 404 on a tenant host are already built in HQ byte-for-byte
  and blocked only by a proxy allowlist. Ten more are content to author as page
  rows; six need a ruling.
- **The browser.** Plan 38 is mandatory and cannot live in SQL: render the
  pooled rows through the live HQ behind a `Host`-rewriting proxy, diff page by
  page against refusionist.com, and only then repoint nginx and stop the pm2
  app. Both defects found while pooling giocoelho were invisible at the SQL
  layer.

## Rollback

Nothing is destroyed, so rollback is subtraction, and `public.refusionist_migration_map`
is kept afterwards as the key.

```sql
-- every migrated row is still identifiable by its own primary key
delete from public.page_models where site = 'refusionist';
delete from public.announcements where site = 'refusionist';
-- ...and so on; or restore public from the pre-run dump.
```

Take a `pg_dump` of `public` immediately before the production run. The
refusionist schema itself is untouched either way, and the old pm2 app is still
installed — so the site can go back to serving itself with a `pm2 start` and one
nginx line, exactly as with giocoelho.
