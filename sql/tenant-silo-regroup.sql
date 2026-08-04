-- tenant-silo-regroup.sql — every %_tenant_silo policy targets the GROUP role.
-- Plan 20 (tenant convergence). RE-RUNNABLE: run it after any migration that adds
-- a silo table, and run it before pooling a new tenant.
--
-- WHY THIS EXISTS
-- RLS is fail-closed. A policy's role list is member-of, not equals — so a policy
-- written `TO tgv_tenant_app` covers every role granted into that group, forever,
-- including roles that don't exist yet. A policy written `TO refusionist_app,
-- giocoelho, resonantweaver_app, demo_fliring_app` covers those four and nobody
-- else: a newly pooled tenant matches no policy and reads NOTHING. Not an error —
-- an empty result set, which is worse, because it looks like an empty tenant.
--
-- The deploy-engine emitted this once as a one-time prereq (buildPolicyRegroupPrereq
-- in @tgv/deploy-engine/src/provision-db.ts, applied by hand 2026-07-13, 85 policies).
-- It came back: the nine module-storage silo tables added afterwards (0106, 0107,
-- 0118, 0119, 0120) were each written against the four-role list again, so by
-- 2026-08-03 nine of ninety-four were stranded. A one-time fix cannot hold a rule
-- that every future migration has to keep. This file is that fix made repeatable,
-- and its assertions at the bottom are what turns "we should remember" into "it
-- fails loudly if we forget".
--
-- The source migrations were fixed too (0106/0107 now write TO tgv_tenant_app);
-- 0118–0120 live on a branch this lane doesn't carry and are noted in the plan.
--
-- WHAT IT DOES NOT DO
-- It does NOT widen table privileges. The group already holds DML on every silo
-- table, and two of them (member_storage_quota, member_storage_usage) deliberately
-- withhold DELETE — those are accounting rows a tenant must never remove. Step 3
-- therefore only fills tables the group holds NOTHING on; it never adds a verb to
-- a table that already has one. RLS still silos every row it can reach.
--
--   psql "$DATABASE_URL" -f sql/tenant-silo-regroup.sql

BEGIN;

-- 1 ── Membership. The legacy per-tenant roles keep working through the group
--      (member-of semantics), so nothing about their access changes here.
--      Skipped when the role is already a member, which is what lets the everyday
--      re-run go through as tgv_app: granting a role needs ADMIN OPTION, and only
--      the first (superuser) application ever has anything to do here.
DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['refusionist_app', 'giocoelho', 'resonantweaver_app', 'demo_fliring_app']
  LOOP
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = r)
       AND NOT pg_has_role(r, 'tgv_tenant_app', 'MEMBER') THEN
      EXECUTE format('GRANT tgv_tenant_app TO %I', r);
    END IF;
  END LOOP;
END $$;

-- 2 ── Re-point every silo policy at the group. ALTER POLICY … TO leaves USING and
--      WITH CHECK untouched, so no predicate is rewritten and nothing is dropped.
DO $$
DECLARE p record; n int := 0;
BEGIN
  FOR p IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname LIKE '%\_tenant\_silo'
       AND NOT ('tgv_tenant_app' = ANY (roles))
  LOOP
    EXECUTE format('ALTER POLICY %I ON public.%I TO tgv_tenant_app', p.policyname, p.tablename);
    RAISE NOTICE 'regrouped %.% → tgv_tenant_app', p.tablename, p.policyname;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'policies regrouped: %', n;
END $$;

-- 3 ── Gap-fill only. A silo table the group cannot touch at all would pass RLS and
--      then fail on plain table permission — the 2026-07-13 half-2 finding. Tables
--      that already carry a deliberate subset are left exactly as they are.
DO $$
DECLARE t record; n int := 0;
BEGIN
  FOR t IN
    SELECT DISTINCT tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname LIKE '%\_tenant\_silo'
  LOOP
    CONTINUE WHEN has_table_privilege('tgv_tenant_app', format('public.%I', t.tablename), 'SELECT')
               OR has_table_privilege('tgv_tenant_app', format('public.%I', t.tablename), 'INSERT')
               OR has_table_privilege('tgv_tenant_app', format('public.%I', t.tablename), 'UPDATE')
               OR has_table_privilege('tgv_tenant_app', format('public.%I', t.tablename), 'DELETE');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO tgv_tenant_app', t.tablename);
    RAISE NOTICE 'granted DML on % (group held nothing)', t.tablename;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'tables gap-filled: %', n;
END $$;

-- Sequences owned by a silo table: an INSERT that can't nextval() fails at run time
-- with a permission error rather than an empty read, so this one is cheap to keep
-- blanket — USAGE on a sequence grants nothing but the next number.
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT seq.relname AS seqname
      FROM pg_class seq
      JOIN pg_depend d ON d.objid = seq.oid AND d.deptype IN ('a', 'i')
      JOIN pg_class tbl ON tbl.oid = d.refobjid
      JOIN pg_namespace n ON n.oid = seq.relnamespace
     WHERE seq.relkind = 'S'
       AND n.nspname = 'public'
       AND tbl.relname IN (SELECT DISTINCT tablename FROM pg_policies
                            WHERE schemaname = 'public' AND policyname LIKE '%\_tenant\_silo')
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO tgv_tenant_app', s.seqname);
  END LOOP;
END $$;

-- 4 ── Assert. This is the part that makes the file worth re-running: if a later
--      migration reintroduces a hardcoded role list, this refuses to commit and
--      names the offenders instead of leaving a tenant silently blind.
DO $$
DECLARE stranded text[]; ungranted text[]; t record;
BEGIN
  SELECT array_agg(tablename || '.' || policyname ORDER BY tablename)
    INTO stranded
    FROM pg_policies
   WHERE schemaname = 'public'
     AND policyname LIKE '%\_tenant\_silo'
     AND NOT ('tgv_tenant_app' = ANY (roles));
  IF stranded IS NOT NULL THEN
    RAISE EXCEPTION 'silo policies still not on tgv_tenant_app: %', array_to_string(stranded, ', ');
  END IF;

  -- Looped, not a single SELECT: has_table_privilege() in a WHERE clause over
  -- pg_policies can be evaluated before the schema filter narrows the scan, and
  -- then trips over a toast relation that has no name to resolve.
  ungranted := ARRAY[]::text[];
  FOR t IN
    SELECT DISTINCT tablename
      FROM pg_policies
     WHERE schemaname = 'public' AND policyname LIKE '%\_tenant\_silo'
     ORDER BY 1
  LOOP
    IF NOT has_table_privilege('tgv_tenant_app', format('public.%I', t.tablename), 'SELECT') THEN
      ungranted := ungranted || t.tablename;
    END IF;
  END LOOP;
  IF array_length(ungranted, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'silo tables the group cannot read: %', array_to_string(ungranted, ', ');
  END IF;

  RAISE NOTICE 'OK — every public %%_tenant_silo policy targets tgv_tenant_app and the group can read every silo table';
END $$;

COMMIT;
