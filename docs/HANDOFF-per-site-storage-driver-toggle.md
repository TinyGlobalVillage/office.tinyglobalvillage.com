# HANDOFF — per-site storage driver: the Office toggle UI (+ optional app sourcing)

**From:** the R2-migration session (metering-cron durability). **Date:** 2026-08-04.
**Status of the backend half: DONE + live-verified.** This doc is the UI half, for whoever owns the
Office "Dashboard Storage" / storage-config lane (the uncommitted WIP already in this checkout:
`DashboardStorageConfigModal.tsx`, `api/admin/storage/fleet`, `VillagersClient.tsx` edits).

## The contract (already live — build against it)

There is a new **per-site** column, `villager_sites.storage_driver`:
- Values: `'r2'` (Cloudflare R2) · `NULL` or `'disk'` (local CDN disk — the default).
- Applied by hand to **tgv_db + tgv_demo + demo_seed** (guest-clone template). Additive/nullable; a
  column add inherits the table's grants + RLS, so no separate GRANT/policy was needed.
- Seeded on tgv_db: `storage_driver='r2'` on **tgv (`tinyglobalvillage.com`), guardians, nevlo** — the
  three tenants served by the tgv app that were flipped to R2 (backfilled, S2 leak closed). Everything
  else is disk.
- Migration file for the record: `utils/scripts/project/2026-08-04-villager-sites-storage-driver.sql`
  (monorepo, commit `23ba372a`).

**Who already reads it:** the two nightly metering crons (`storage-usage-reconcile`, `storage-reaper`)
resolve the driver **per-site** from this column (r2 tenants counted from / reaped from the bucket, disk
tenants from disk, never both). That's the whole reason the column exists — a single global
`STORAGE_DRIVER=r2` would have zeroed disk-tenants' `member_storage_usage` counters. Do **not**
reintroduce a global switch.

**Who does NOT read it yet (your Task 2, optional):** the live app. `tenant.ts:~197` already has the seam
—`const driver = (config.storageDriver ?? process.env.STORAGE_DRIVER ?? "disk")`— but `config.storageDriver`
is not yet sourced from the column. The tgv app currently flips via the **app env** `STORAGE_DRIVER=r2`
in `clients/tinyglobalvillage.com/.env.local` (blankets all tgv-app tenants). Leave that env in place
until Task 2 lands, then remove it so the column is authoritative.

## Task 1 — the per-site Disk/R2 toggle (the visual ask)

Put it on the **per-site** surface, NOT the fleet-global modal. Two distinct Office storage surfaces exist:
- `app/dashboard/storage` → `components/storage/StorageMeteringPanel.tsx` — **per-site list** (each row is a
  villager site w/ usage), backed by `GET /api/admin/storage-metering` → `{ sites, buckets, totals }`.
  **← the toggle goes here (one Disk/R2 switch per row).**
- `components/villagers/DashboardStorageConfigModal.tsx` → shared `FleetStorageSettings` →
  `/api/admin/storage/fleet` — **fleet-GLOBAL** settings (tier caps, dormant pricing, purge timings via
  `FLEET_GLOBAL_KEY`). Orthogonal to a per-site column — don't put the driver here.

Steps:
1. `GET /api/admin/storage-metering` (`app/api/admin/storage-metering/route.ts`) — add `storage_driver`
   to the per-site SELECT so each `sites[]` row carries its current driver.
2. New write route, e.g. `PATCH /api/admin/storage-metering/driver` (or a small `app/api/admin/storage/site-driver`),
   `requireAdmin`-gated: body `{ siteId, driver: 'disk'|'r2' }`, validate `driver ∈ {disk,r2}`, then
   `UPDATE villager_sites SET storage_driver=$1 WHERE id=$2`. Raw SQL via `db.execute` (villager_sites
   isn't in Office's drizzle schema — same pattern as the rest of `/api/admin/storage-metering`).
3. `StorageMeteringPanel.tsx` — per row, a small **Disk / R2** switch (use the shared Lightswitch/DTog
   vocabulary if it fits) that calls the PATCH + optimistically updates. Tooltip the switch.

**Guardrails to surface in the UI (important — flipping the driver does NOT move bytes):**
- Disk → r2: existing files must be **backfilled** to R2 first, else galleries 404 after the app honors
  the column. One-shot backfill: `utils/scripts/project/r2-backfill.ts` (dry-run default, `--live`,
  per-file verify). Consider disabling the r2 option (or warning) until a backfill has run for that site.
- r2 → disk: the reverse (R2 → disk) must exist before flipping back, or reads break. For now the disk
  copies are still present as rollback for the 3 flipped tenants, but don't assume that forever.
- After a flip you may want to run the reconcile once so the usage counter re-syncs from the new store:
  `RECONCILE_DRY_RUN=1` first to preview.

## Task 2 (optional, app-facing) — make the app honor the column

Source `config.storageDriver` in `packages/@tgv/module-core/module-storage/storage/server/tenant.ts` from
`villager_sites.storage_driver` during tenant resolution (it already resolves the active site from the
shared pool — add the column to that query). Then the app flips per-site from the toggle, and you can
**remove `STORAGE_DRIVER=r2` from `clients/tinyglobalvillage.com/.env.local`**. This is a shared-package
change → rebuild dists + redeploy the tgv app (build on Mac). Also add `storage_driver` to the tgv
client's drizzle `villager_sites` schema for type-safety.

## Don't-break notes
- The crons pull R2_* creds from `clients/office.tinyglobalvillage.com/.env.local` on demand (only when a
  site is r2); no R2 secret lives in `ecosystem.config.cjs`. If you move creds, keep that file as the home
  (or set `R2_ENV_FILE`).
- tgv apex slug quirk: the house row (`domain=tinyglobalvillage.com`, empty subdomain) derives slug
  `tinyglobalvillage`, but its CDN/R2 media prefix is `tgv`. It has **0** `member_storage_usage` rows so
  the crons are unaffected, but if house member galleries ever appear, the slug↔prefix mismatch needs
  handling before trusting an r2 count for it.
