-- Published atom specs — atom_spec_releases + atom_spec_live
--
-- Office runs NO migrations (tgv.com owns drizzle-kit; see src/lib/db-drizzle.ts),
-- so this DDL is applied deliberately rather than by a migration runner:
--
--   psql "$DATABASE_URL" -f sql/atom-specs.sql
--
-- Safe to re-run. The runtime definition lives in the shared package at
-- @tgv/module-component-library/atoms/store.ts — keep the two in sync.
--
-- WHY IT IS IN tgv_db AND NOT IN OFFICE'S FILES: publishing an atom has to
-- repaint tinyglobalvillage.com and refusionist.com too, and they cannot read
-- Office's disk. They already hold a connection to this database for
-- member-auth, so the specs travel the path the sessions already travel.
--
-- Drafts do NOT live here. The Atom Library saves those to Office's
-- data/atom-lab/, where they stay private until someone publishes them.

-- Every publish, forever. Nothing in this table is ever updated or deleted:
-- reverting points `atom_spec_live` at an older row instead, so the undo costs
-- one statement and the history of a three-site repaint stays intact.
CREATE TABLE IF NOT EXISTS public.atom_spec_releases (
  atom_key   text        NOT NULL,
  -- Per atom, starting at 1. Not global — "tile v4" should mean something.
  version    integer     NOT NULL,
  -- A full AtomSpec, already through clampSpec on the way in.
  spec       jsonb       NOT NULL,
  note       text,
  author     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (atom_key, version)
);

-- Which release each atom is serving. One row per published atom; an atom with
-- no row here renders the spec baked into the bundle, which is also what every
-- tenant falls back to when this database is unreachable.
CREATE TABLE IF NOT EXISTS public.atom_spec_live (
  atom_key   text        PRIMARY KEY,
  version    integer     NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (atom_key, version)
    REFERENCES public.atom_spec_releases (atom_key, version)
);

-- ── grants ──────────────────────────────────────────────────────────────
-- Every tenant READS this on render; only Office (tgv_app) publishes. The read
-- is covered by the primary key on (atom_key, version), so there is no second
-- index to keep — the whole live set is a handful of rows.
DO $do$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['public_app','refusionist_app','demo_fliring_app','resonantweaver_app','tgv_app','tgv_tenant_app'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('GRANT SELECT ON public.atom_spec_releases, public.atom_spec_live TO %I', r);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tgv_app') THEN
    EXECUTE 'GRANT INSERT, UPDATE, DELETE ON public.atom_spec_releases, public.atom_spec_live TO tgv_app';
  END IF;
END
$do$;
