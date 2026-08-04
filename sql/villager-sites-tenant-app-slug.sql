-- villager-sites-tenant-app-slug.sql — one real key between the two registries.
-- Plan 21 (tenant convergence). Idempotent; safe to re-run.
--
-- WHY
-- `villager_sites` is the registry of villages. `tenant_apps` is the registry of
-- pm2 processes. They shared no key: the only link was a slug buried in
-- `deploy_log`, a text column holding free-form JSON with no index and no
-- constraint. So "does this village have its own app?" was an inference over a
-- blob — and the answer mattered, because it decides whether a village is served
-- by the shared renderer or by a process of its own.
--
-- Under the pooled model (plan 8) the answer is NULL for everything new: one HQ
-- renderer serves N villages by hostname, and creating a village writes rows
-- rather than standing up an app. That is exactly what this column says out loud.
-- NULL = pooled onto HQ. Non-NULL = this village has its own pm2 process, which
-- from here on is a legacy shape, not a thing the signup path can produce.
--
-- ON DELETE SET NULL, deliberately: finalizing a tenant app tears the process
-- down (pm2 delete + nginx rm + row delete). The VILLAGE survives that — it just
-- becomes pooled. Cascading the delete would take a live customer's site with it.
--
--   psql "$DATABASE_URL" -f sql/villager-sites-tenant-app-slug.sql

BEGIN;

ALTER TABLE public.villager_sites
  ADD COLUMN IF NOT EXISTS tenant_app_slug text;

DO $$ BEGIN
  ALTER TABLE public.villager_sites
    ADD CONSTRAINT villager_sites_tenant_app_slug_fkey
    FOREIGN KEY (tenant_app_slug) REFERENCES public.tenant_apps (slug)
    ON UPDATE CASCADE ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'villager_sites_tenant_app_slug_fkey already present';
END $$;

-- Partial + unique. Partial because the column is sparse by design and getting
-- sparser — indexing the NULLs would be indexing the entire table to no purpose.
-- Unique because a pm2 process serves exactly one village; two villages claiming
-- the same app is the drift this column exists to make impossible.
CREATE UNIQUE INDEX IF NOT EXISTS villager_sites_tenant_app_slug_key
  ON public.villager_sites (tenant_app_slug)
  WHERE tenant_app_slug IS NOT NULL;

COMMENT ON COLUMN public.villager_sites.tenant_app_slug IS
  'tenant_apps.slug of this village''s own pm2 process, or NULL when it is pooled '
  'onto the shared HQ renderer (the default since plan 8). Replaces inferring the '
  'link from deploy_log JSON.';

-- Backfill from the two places the link used to hide: the deploy_log blob, and a
-- pm2_name that happens to match a registered app. Both are matched against
-- tenant_apps so a stale name can never satisfy the foreign key.
DO $$
DECLARE n int;
BEGIN
  WITH linked AS (
    UPDATE public.villager_sites v
       SET tenant_app_slug = t.slug
      FROM public.tenant_apps t
     WHERE v.tenant_app_slug IS NULL
       AND t.slug = COALESCE(
             CASE WHEN v.deploy_log IS NOT NULL AND left(btrim(v.deploy_log), 1) = '{'
                  THEN (v.deploy_log::jsonb -> 'tenant' ->> 'slug') END,
             NULLIF(v.pm2_name, ''))
    RETURNING v.id)
  SELECT count(*) INTO n FROM linked;
  RAISE NOTICE 'villages linked to an existing tenant app: %', n;
END $$;

-- Any pm2_name that pointed at nothing is now visible as such rather than reading
-- like a link. Report, don't clear — it is somebody's note about a real process.
DO $$
DECLARE orphan text[];
BEGIN
  SELECT array_agg(domain ORDER BY domain) INTO orphan
    FROM public.villager_sites
   WHERE tenant_app_slug IS NULL AND NULLIF(pm2_name, '') IS NOT NULL;
  IF orphan IS NOT NULL THEN
    RAISE NOTICE 'villages with a pm2_name but no tenant_apps row: %', array_to_string(orphan, ', ');
  END IF;
END $$;

COMMIT;
