-- profile-engine-grants.sql — who may see a bespoke Profile tab (plan 31/32).
--
-- WHY THIS EXISTS. The profile engines (cospro, starseed) stop being one app's
-- private code this week and become packages the SHARED renderer can mount. The
-- moment that is true, "which member gets the Cosmic Profile tab" is no longer
-- answered by which app they logged into — it has to be a row. Without one, a
-- pooled tenant's member would inherit whatever the renderer happens to import.
--
-- TWO LAYERS, AND ONLY ONE OF THEM IS HERE. Plan 32: visibility is being a
-- member of the site at all; UNLOCK is this table. The catalog in
-- @tgv/module-dashboard/profile-engines/catalog.ts is a third, harder gate above
-- both — it says which SITES may hand out which engine, in code, so a row
-- naming an engine a site isn't allowed to offer is inert.
--
-- ONE ROW PER (member, engine), NOT PER (member, engine, site). A member holds an
-- engine once; `site` records who granted it (and scopes the read), which keeps
-- the unique constraint honest and makes "revoke everywhere" a single update.
--
-- UNTICKING KEEPS THE ROW. `enabled = false` rather than DELETE, so the audit
-- (who granted, when, who took it away) survives — the same reasoning as the
-- atom specs and site releases: nothing is overwritten, nothing disappears.
--
-- RE-RUNNABLE: every statement is IF NOT EXISTS or a guarded ALTER.
--
--   psql -d tgv_db -f sql/profile-engine-grants.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:profile-engine-grants', true);

CREATE TABLE IF NOT EXISTS public.member_profile_engines (
  member_id  uuid        NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  engine     text        NOT NULL,
  site       text        NOT NULL,
  enabled    boolean     NOT NULL DEFAULT true,
  granted_by text,
  granted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_profile_engines_pkey PRIMARY KEY (member_id, engine),
  -- Free text would let a typo ("starsed") sit in the table looking granted.
  -- The catalog is the real authority; this is the cheap backstop that keeps a
  -- fat-fingered API call out of the store entirely.
  CONSTRAINT member_profile_engines_engine_known CHECK (engine IN ('cospro', 'starseed'))
);

-- The renderer's read is (member_id, site) on every dashboard load; the Office
-- picker's is (site, engine). The PK serves the first, this serves the second.
CREATE INDEX IF NOT EXISTS member_profile_engines_site_engine_idx
  ON public.member_profile_engines (site, engine)
  WHERE enabled;

COMMENT ON TABLE public.member_profile_engines IS
  'Per-member unlock for a bespoke Profile engine (plan 31/32). The catalog in @tgv/module-dashboard/profile-engines decides which sites may grant which engine; this decides who has it. enabled=false is a withdrawn grant, kept for audit.';

-- ── RLS: the fleet default (plan 20) — tenant apps read through the group role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tgv_tenant_app') THEN
    EXECUTE 'ALTER TABLE public.member_profile_engines ENABLE ROW LEVEL SECURITY';
    EXECUTE 'GRANT SELECT ON public.member_profile_engines TO tgv_tenant_app';
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
       WHERE schemaname = 'public' AND tablename = 'member_profile_engines'
         AND policyname = 'member_profile_engines_tenant_silo'
    ) THEN
      -- Read-only for the app role: grants are made by an operator in Office
      -- (which connects as the owner), never by a tenant's own runtime.
      EXECUTE $p$CREATE POLICY member_profile_engines_tenant_silo
                 ON public.member_profile_engines
                 FOR SELECT TO tgv_tenant_app
                 USING (true)$p$;
    END IF;
  END IF;
END $$;

-- ── assertions ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'member_profile_engines';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: member_profile_engines was not created';
  END IF;

  -- The check constraint has to be present, or the backstop above is a comment.
  SELECT count(*) INTO n
    FROM pg_constraint
   WHERE conrelid = 'public.member_profile_engines'::regclass
     AND conname = 'member_profile_engines_engine_known';
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: engine CHECK constraint missing';
  END IF;

  -- A member can hold an engine once. Prove it rather than trusting the DDL.
  BEGIN
    INSERT INTO public.member_profile_engines (member_id, engine, site, granted_by)
    SELECT id, 'cospro', '__assert__', 'assert' FROM public.members
     WHERE deleted_at IS NULL LIMIT 1;
    INSERT INTO public.member_profile_engines (member_id, engine, site, granted_by)
    SELECT id, 'cospro', '__assert__', 'assert' FROM public.members
     WHERE deleted_at IS NULL LIMIT 1;
    RAISE EXCEPTION 'assert: duplicate (member, engine) was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;  -- expected
  END;
  DELETE FROM public.member_profile_engines WHERE site = '__assert__';

  RAISE NOTICE 'assertions passed';
END $$;

SELECT 'grants: ' || count(*) FROM public.member_profile_engines;

COMMIT;
