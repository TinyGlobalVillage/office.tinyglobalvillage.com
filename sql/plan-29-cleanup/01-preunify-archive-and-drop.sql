-- 01-preunify-archive-and-drop.sql — the 52 `zz_*_preunify` tables go, but not before their rows do.
--
-- WHAT THEY ARE. `@tgv/module-course`'s course unification moved every tenant's own `course_*`
-- copy out of `search_path` resolution so bare names fall through to `public.course_*`. The move
-- was a RENAME, not a drop, precisely so it stayed reversible:
-- `packages/@tgv/module-marketplace/module-course/db/ops/cutover-course-unify.sql` step 2. That was
-- resonantweaver on 2026-06-24 and refusionist + demo_fliring at the P8 cutover. The rename has now
-- held through a pooling, a parity sweep and a cutover plan; nothing has resolved to those names in
-- weeks, and `rcs-stack/postgres.md` still describes the reversal as live. This file ends that.
--
-- THE PREMISE THIS FILE WAS HANDED, AND WHY IT IS WRONG. Plan 29 came in saying "only four are
-- populated, ~22 rows total, all course audit data." Every clause of that is off, and the reason is
-- worth keeping because it is reproducible: whoever measured it read `pg_class.reltuples`, which is
-- an ESTIMATE, and which reads -1 — not 0 — on a table that has never been vacuumed or analyzed.
-- Exactly SEVEN of the fifty-two carry a real number there; the other forty-five read -1 and were
-- taken for empty. The seven are all refusionist's, and four of them are non-zero: `course_audit`
-- 22, `course_enrollments` 1, `course_pages` 1, `course_progress` 1. That is the "four populated"
-- of the report, arrived at by counting the tables Postgres happened to have analyzed, and "~22"
-- is `course_audit` alone read as if it were the total.
--
-- Counted honestly instead — as each owning role, because `relacl` is NULL on all fifty-two and
-- only the owner or a superuser may read them at all — it is TWELVE populated tables and
-- SIXTY-SEVEN rows:
--
--     demo_fliring      18 tables    zz_course_categories_preunify           18 rows
--     refusionist       16 tables    zz_course_audit_preunify                22 rows
--                                    zz_course_certificates_preunify          1
--                                    zz_course_chapters_preunify              1
--                                    zz_course_courses_preunify               1
--                                    zz_course_enrollments_preunify           1
--                                    zz_course_glossary_terms_preunify        1
--                                    zz_course_lessons_preunify               1
--                                    zz_course_pages_preunify                 1
--                                    zz_course_progress_preunify              1
--                                    zz_course_sections_preunify              1
--     resonantweaver    18 tables    zz_course_categories_preunify           18 rows
--
-- The "all course audit data" half falls out of the same measurement: nothing has ever analyzed a
-- single demo_fliring or resonantweaver table, so the thirty-six rows sitting in their two copies of
-- the eighteen-slug category taxonomy were invisible by construction rather than by argument.
-- Nothing here is lost either way, but a cleanup that says twenty-two and destroys sixty-seven is
-- not a cleanup anybody should sign off on. The inventory this file prints before it drops anything
-- is counted, not estimated.
--
-- WHY THE ROWS ARE SAFE TO LOSE — proved, not assumed. Two different arguments, because the two
-- groups got there two different ways.
--
--   refusionist's 31 rows were RESYNCED into `public` by step 1 of the cutover, id for id. Verified
--   here rather than trusted: all 31 ids are present in the matching `public.course_*` table today
--   (`public` in fact holds 33 — one extra audit row and one extra course written since). The
--   archive keeps the tenant-side values anyway, because "public has the id" is not the same claim
--   as "public has the same row", and the cheap copy costs nothing.
--
--   the 36 category rows were DELIBERATELY NOT resynced, and the cutover file says why in its own
--   comment: `course_categories` is a platform-global taxonomy with a globally unique slug, and the
--   tenant copies hold the same eighteen slugs under different uuids, referenced by nothing — their
--   `course_course_categories` junctions are empty, which this file re-checks. Upserting them would
--   have violated `course_categories_slug_idx`. So the check that matters for them is by SLUG, not
--   by id: all eighteen slugs on both sides exist in `public.course_categories`, and zero ids
--   overlap. Confirmed both ways before the drop.
--
-- WHY IT DROPS THE WHOLE SET IN ONE STATEMENT. The fifty-two carry foreign keys AMONG THEMSELVES
-- (pages → lessons, and so on), preserved by the rename. Dropping them one at a time therefore
-- needs CASCADE, and CASCADE is exactly the verb that would quietly take something else with it. A
-- single `DROP TABLE a, b, c, …` over the closed set needs no CASCADE at all: Postgres resolves the
-- mutual references inside the statement, and anything OUTSIDE the set that depends on one of them
-- makes the statement FAIL and name it. That failure is the guardrail, so it is left in place —
-- there are no inbound foreign keys from outside the set and no dependent views today, and the file
-- asserts both before it gets that far rather than discovering it in the error message.
--
-- THIS FILE NEEDS SUPERUSER, which none of its siblings do. `relacl` is NULL on all fifty-two, so
-- reading them and dropping them both require ownership, and the three owners are three different
-- roles. `tgv_app` cannot even `USAGE` two of the three schemas. Run it as postgres:
--
--   sudo -u postgres psql -d tgv_db -X -v ON_ERROR_STOP=1 -f sql/plan-29-cleanup/01-preunify-archive-and-drop.sql
--
-- Re-runnable to zero. A second run finds no `zz_%_preunify` tables, archives nothing, drops
-- nothing, and passes the same assertions. The archive it leaves behind is readable by `tgv_app`,
-- so Office can show it without anybody needing the postgres password.
--
-- REVERSAL, honestly stated: this is the end of the rename's reversibility. `archive_preunify` holds
-- the rows as jsonb and the pg_dump at `/var/backups/course-unify/` holds the real thing; neither is
-- a table you can rename back into place. If the course unification is still on trial, do not run
-- this file.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'plan-29:preunify-archive-and-drop', true);

-- ── 0. what we are about to do, counted rather than estimated ──────────────
-- Printed before anything changes, so the transcript of the run carries the inventory the header
-- describes. `count_rows_of` is temporary and dies with the session; it exists because
-- `pg_class.reltuples` is what got the first inventory wrong.
CREATE OR REPLACE FUNCTION pg_temp.count_rows_of(s text, t text) RETURNS bigint AS $$
DECLARE n bigint;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I.%I', s, t) INTO n;
  RETURN n;
END $$ LANGUAGE plpgsql;

-- Dropped first so the file survives being run twice down the same psql session, which is exactly
-- how somebody rehearsing all three will run them.
DROP TABLE IF EXISTS plan29_preunify_inventory;
CREATE TEMP TABLE plan29_preunify_inventory AS
SELECT n.nspname AS src_schema,
       c.relname AS src_table,
       pg_temp.count_rows_of(n.nspname, c.relname) AS n_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind = 'r'
   AND c.relname LIKE 'zz\_%\_preunify';

SELECT src_schema, src_table, n_rows
  FROM plan29_preunify_inventory
 ORDER BY src_schema, src_table;

-- The `public.course_*` counts as they stand right now. Step 6 compares against these: a drop of
-- tenant archives that changes what `public` holds is a bug however plausible its error message.
DROP TABLE IF EXISTS plan29_public_before;
CREATE TEMP TABLE plan29_public_before AS
SELECT c.relname AS t, pg_temp.count_rows_of('public', c.relname) AS n_rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'course\_%';

-- ── 1. the archive ─────────────────────────────────────────────────────────
-- One schema, one table, jsonb payloads. Twelve populated tables across three schemas have twelve
-- different column lists, and a faithful per-table archive would be twelve DDL statements that
-- nobody will ever query. This is a cold safety net, not a model: `to_jsonb(t)` keeps every column
-- under its own name, which is all anybody restoring from it would need.
CREATE SCHEMA IF NOT EXISTS archive_preunify;

COMMENT ON SCHEMA archive_preunify IS
  'Cold archive of the per-tenant course_* tables retired by the module-course unification (renamed to zz_*_preunify at the P8 cutover, dropped by plan 29 on 2026-08-06). Rows only, as jsonb. The real backup is the pg_dump at /var/backups/course-unify/.';

CREATE TABLE IF NOT EXISTS archive_preunify.course_rows (
  src_schema  text        NOT NULL,
  src_table   text        NOT NULL,
  row_data    jsonb       NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE archive_preunify.course_rows IS
  'One row per row of a dropped zz_*_preunify table. src_table carries the ORIGINAL name (course_audit, not zz_course_audit_preunify) because that is the name public.* still uses.';

CREATE INDEX IF NOT EXISTS course_rows_src_idx
  ON archive_preunify.course_rows (src_schema, src_table);

-- Office reads this without the postgres password; nothing writes to it but this file.
GRANT USAGE ON SCHEMA archive_preunify TO tgv_app;
GRANT SELECT ON archive_preunify.course_rows TO tgv_app;

-- ── 2. refuse if the set is not closed ─────────────────────────────────────
-- Before anything is copied, let alone dropped. Both of these are zero today; if either stops being
-- zero it means something outside the archive set has started depending on it, and that is a
-- conversation, not a migration.
DO $$
DECLARE offenders text[];
BEGIN
  SELECT array_agg(tn.nspname || '.' || tc.relname || ' → ' || fn.nspname || '.' || fc.relname)
    INTO offenders
    FROM pg_constraint c
    JOIN pg_class tc ON tc.oid = c.conrelid JOIN pg_namespace tn ON tn.oid = tc.relnamespace
    JOIN pg_class fc ON fc.oid = c.confrelid JOIN pg_namespace fn ON fn.oid = fc.relnamespace
   WHERE c.contype = 'f'
     AND fc.relname LIKE 'zz\_%\_preunify'
     AND tc.relname NOT LIKE 'zz\_%\_preunify';
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'a live table still references a preunify archive: %', array_to_string(offenders, ', ');
  END IF;

  SELECT array_agg(DISTINCT dn.nspname || '.' || dc.relname)
    INTO offenders
    FROM pg_depend d
    JOIN pg_rewrite rw ON rw.oid = d.objid
    JOIN pg_class dc ON dc.oid = rw.ev_class JOIN pg_namespace dn ON dn.oid = dc.relnamespace
    JOIN pg_class rc ON rc.oid = d.refobjid
   WHERE d.classid = 'pg_rewrite'::regclass
     AND rc.relname LIKE 'zz\_%\_preunify'
     AND dc.relname NOT LIKE 'zz\_%\_preunify';
  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'a view still reads a preunify archive: %', array_to_string(offenders, ', ');
  END IF;
END $$;

-- ── 3. the dump ────────────────────────────────────────────────────────────
-- Delete-then-insert per source table rather than an ON CONFLICT: a jsonb payload has no natural
-- key to conflict on, and re-archiving a table that has somehow gained a row should replace that
-- table's slice rather than double it. On a second run of the whole file the loop finds no source
-- tables and touches nothing.
DO $$
DECLARE r record; n bigint; total bigint := 0;
BEGIN
  FOR r IN SELECT src_schema, src_table FROM plan29_preunify_inventory WHERE n_rows > 0
            ORDER BY src_schema, src_table
  LOOP
    DELETE FROM archive_preunify.course_rows
     WHERE src_schema = r.src_schema
       AND src_table = regexp_replace(r.src_table, '^zz_(.*)_preunify$', '\1');

    EXECUTE format(
      'INSERT INTO archive_preunify.course_rows (src_schema, src_table, row_data)
       SELECT %L, %L, to_jsonb(t) FROM %I.%I t',
      r.src_schema,
      regexp_replace(r.src_table, '^zz_(.*)_preunify$', '\1'),
      r.src_schema, r.src_table);
    GET DIAGNOSTICS n = ROW_COUNT;
    total := total + n;
    RAISE NOTICE 'archived % row(s) from %.%', n, r.src_schema, r.src_table;
  END LOOP;
  RAISE NOTICE 'archived % row(s) in total', total;
END $$;

-- ── 4. prove nothing unique dies ───────────────────────────────────────────
-- The two arguments from the header, executed. Everything except `course_categories` was resynced
-- into public BY ID, so id-presence is the check. `course_categories` was deliberately skipped by
-- the resync (globally unique slug, tenant copies under different uuids), so SLUG-presence is the
-- check and an id overlap would in fact be the surprising outcome.
DO $$
DECLARE r record; missing int; overlap int;
BEGIN
  FOR r IN SELECT DISTINCT src_schema, src_table FROM archive_preunify.course_rows
            WHERE src_table <> 'course_categories'
            ORDER BY 1, 2
  LOOP
    IF to_regclass('public.' || quote_ident(r.src_table)) IS NULL THEN
      RAISE EXCEPTION 'public.% does not exist — the archived %.% rows have nowhere to have landed',
        r.src_table, r.src_schema, r.src_table;
    END IF;
    EXECUTE format(
      'SELECT count(*) FROM archive_preunify.course_rows a
        WHERE a.src_schema = %L AND a.src_table = %L
          AND NOT EXISTS (SELECT 1 FROM public.%I p WHERE p.id::text = a.row_data->>''id'')',
      r.src_schema, r.src_table, r.src_table) INTO missing;
    IF missing <> 0 THEN
      RAISE EXCEPTION '%.% has % row(s) with no counterpart in public.% — the resync did not land',
        r.src_schema, r.src_table, missing, r.src_table;
    END IF;
  END LOOP;

  SELECT count(*) INTO missing
    FROM archive_preunify.course_rows a
   WHERE a.src_table = 'course_categories'
     AND NOT EXISTS (SELECT 1 FROM public.course_categories p WHERE p.slug = a.row_data->>'slug');
  IF missing <> 0 THEN
    RAISE EXCEPTION '% archived category slug(s) are absent from public.course_categories', missing;
  END IF;

  SELECT count(*) INTO overlap
    FROM archive_preunify.course_rows a
   WHERE a.src_table = 'course_categories'
     AND EXISTS (SELECT 1 FROM public.course_categories p WHERE p.id::text = a.row_data->>'id');
  IF overlap <> 0 THEN
    RAISE EXCEPTION '% archived category id(s) DO exist in public — the resync skip was not what the cutover file described', overlap;
  END IF;

  -- The junctions that would have made the tenant taxonomies load-bearing. Empty is the whole
  -- reason the duplicate slugs were harmless; if one is not empty, a tenant course is categorised
  -- against a uuid that is about to stop existing.
  SELECT coalesce(sum(n_rows), 0) INTO overlap
    FROM plan29_preunify_inventory
   WHERE src_table = 'zz_course_course_categories_preunify';
  IF overlap <> 0 THEN
    RAISE EXCEPTION '% tenant course↔category link(s) exist — the duplicate taxonomies are referenced after all', overlap;
  END IF;

  RAISE NOTICE 'pre-drop proof passed — every archived row is represented in public';
END $$;

-- ── 5. the drop ────────────────────────────────────────────────────────────
-- One statement over the closed set, no CASCADE. See the header: the mutual foreign keys resolve
-- inside a single DROP, and anything from outside the set that depends on one of these makes this
-- fail by name instead of being silently swept up.
DO $$
DECLARE stmt text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY n.nspname, c.relname)
    INTO stmt
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r' AND c.relname LIKE 'zz\_%\_preunify';
  IF stmt IS NULL THEN
    RAISE NOTICE 'nothing to drop — already clean';
    RETURN;
  END IF;
  EXECUTE 'DROP TABLE ' || stmt;
  RAISE NOTICE 'dropped: %', stmt;
END $$;

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE n int; found bigint; kept bigint; drifted text[];
BEGIN
  -- Nothing of the shape survives, in any schema — including one this file has never heard of.
  SELECT count(*) INTO n
    FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE c.relname LIKE 'zz\_%\_preunify';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % zz_*_preunify relation(s) still exist', n;
  END IF;

  -- Every row this run counted is in the archive. Stated as a comparison against THIS run's own
  -- inventory rather than against 67, so the file still asserts something true on a second run
  -- (where both sides are zero) and on a database that was never in exactly this state.
  SELECT coalesce(sum(n_rows), 0) INTO found FROM plan29_preunify_inventory;
  SELECT count(*) INTO kept FROM archive_preunify.course_rows;
  IF kept < found THEN
    RAISE EXCEPTION 'assert: counted % source row(s) but the archive holds only %', found, kept;
  END IF;

  -- The blast radius. Dropping tenant archives must not have moved a single row in public.
  SELECT array_agg(b.t || ' ' || b.n_rows || '→' || pg_temp.count_rows_of('public', b.t))
    INTO drifted
    FROM plan29_public_before b
   WHERE pg_temp.count_rows_of('public', b.t) <> b.n_rows;
  IF drifted IS NOT NULL THEN
    RAISE EXCEPTION 'assert: public.course_* changed under the drop: %', array_to_string(drifted, ', ');
  END IF;

  RAISE NOTICE 'assertions passed — % source row(s) archived, % archive row(s) held, 0 preunify tables left', found, kept;
END $$;

SELECT src_schema, src_table, count(*) AS rows_archived
  FROM archive_preunify.course_rows
 GROUP BY 1, 2
 ORDER BY 1, 2;

COMMIT;
