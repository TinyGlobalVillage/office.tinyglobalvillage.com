-- Site version history — site_releases + site_live
--
-- Office runs NO migrations (tgv.com owns drizzle-kit), so this DDL is applied
-- deliberately, like sql/atom-specs.sql:
--
--   psql "$DATABASE_URL" -f sql/site-releases.sql
--
-- Safe to re-run. The read/restore queries live in
-- @tgv/module-page-editor/kit/server/releases.ts, next to the page CRUD they
-- version — keep the two in sync.
--
--
-- WHY A TRIGGER AND NOT A CALL IN THE PUBLISH ROUTE
--
-- Publishing a page is implemented four times over: tinyglobalvillage.com's
-- own publish route (two branches — house pages and per-tenant pages), the
-- editor kit's publishPage that refusionist mounts, the migration engine's
-- page writer, and applyTemplate when a new site is stamped. Wiring history
-- into each is four edits across three repos and three deploys, and it is one
-- forgotten call away from a page whose history has a hole in it.
--
-- Capturing at the table instead makes the guarantee structural: "a published
-- page is never overwritten without being recorded first" becomes true of the
-- database, so every writer — including ones not written yet — inherits it,
-- and no app has to be rebuilt for that to start being true.
--
-- The cost is that the database knows less than the app did. It does not know
-- who clicked Publish, so `author` comes from a `app.actor` session setting
-- when a caller bothers to set one and is NULL otherwise; `source` records the
-- Postgres role, which at least says WHICH SITE published. Both are metadata.
-- The payload — the thing a restore actually replays — is exact.

-- ── the ledger ──────────────────────────────────────────────────────────
-- Every published version of every page and every piece of chrome, forever.
-- Nothing here is ever updated (except `note`, which is a human label, not
-- content) and nothing is ever deleted.
--
--   kind  'page'   → ref is '<lang>/<slug>'      payload is the page model
--         'chrome' → ref is '<lang>/<key>'       payload is the override data
--
-- `site` is the same free-text scope tinyglobalvillage.com keys content on:
-- 'main', 'demo', 'guardians', 'nevlo', … — a subdomain, not a UUID.
CREATE TABLE IF NOT EXISTS public.site_releases (
  site       text        NOT NULL,
  kind       text        NOT NULL,
  ref        text        NOT NULL,
  -- Per (site, kind, ref), starting at 1. Not global — "about v4" should mean
  -- something to the person restoring it.
  version    integer     NOT NULL,
  payload    jsonb       NOT NULL,
  -- The page title as it read at the time, so the history list is readable
  -- even for a page that has since been renamed.
  label      text        NOT NULL DEFAULT '',
  note       text,
  author     text,
  -- The Postgres role that wrote it: tgv_app, refusionist_app, … Provenance
  -- for the rows nobody set an actor on.
  source     text,
  -- Which schema the row came out of. 'public' is the pooled store every
  -- restore can replay into; the four per-tenant schemas are recorded so their
  -- history survives the migration, but they are read-only until they pool.
  src_schema text        NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site, kind, ref, version)
);

-- Re-run safety: the column arrived after the first apply.
ALTER TABLE public.site_releases
  ADD COLUMN IF NOT EXISTS src_schema text NOT NULL DEFAULT 'public';

-- The tile lists a whole site newest-first; the PK can't serve that.
CREATE INDEX IF NOT EXISTS site_releases_site_created_idx
  ON public.site_releases (site, created_at DESC);

-- ── the pointer ─────────────────────────────────────────────────────────
-- Which version is live. Publishing appends a release and moves this; restoring
-- replays a payload and moves this BACK, appending nothing. So the ledger is a
-- record of what was published, and this is a record of what is being served.
CREATE TABLE IF NOT EXISTS public.site_live (
  site       text        NOT NULL,
  kind       text        NOT NULL,
  ref        text        NOT NULL,
  version    integer     NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (site, kind, ref),
  FOREIGN KEY (site, kind, ref, version)
    REFERENCES public.site_releases (site, kind, ref, version)
);

-- ── the capture ─────────────────────────────────────────────────────────
-- SECURITY DEFINER because the writer is whichever tenant role published:
-- refusionist_app has no business holding INSERT on the ledger, but its
-- publishes still have to land in it.
--
-- TG_ARGV[0], when given, overrides the site. The per-tenant schemas carry no
-- `site` column — their whole table IS one site — so the trigger names it.
CREATE OR REPLACE FUNCTION public.capture_site_release() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  row_json  jsonb := to_jsonb(NEW);
  v_site    text;
  v_kind    text;
  v_ref     text;
  v_payload jsonb;
  v_label   text;
  v_live    jsonb;
  v_next    integer;
BEGIN
  -- A restore replays an old payload through this same table. It sets this so
  -- the replay is not mistaken for new work — otherwise going back to v3 would
  -- append v9 and the pointer would never move backwards at all.
  IF coalesce(current_setting('app.release_capture', true), '') = 'off' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'page_models' THEN
    IF row_json->>'mode' <> 'published' THEN RETURN NEW; END IF;
    -- A soft-deleted page has no live version to restore to.
    IF row_json->>'deleted_at' IS NOT NULL THEN RETURN NEW; END IF;
    v_kind    := 'page';
    v_ref     := (row_json->>'lang') || '/' || (row_json->>'slug');
    v_payload := row_json->'model_json';
    v_label   := coalesce(row_json->>'title', '');
  ELSIF TG_TABLE_NAME = 'content_overrides' THEN
    IF row_json->>'mode' <> 'published' THEN RETURN NEW; END IF;
    v_kind    := 'chrome';
    v_ref     := (row_json->>'lang') || '/' || (row_json->>'key');
    v_payload := row_json->'data';
    v_label   := coalesce(row_json->>'key', '');
  ELSE
    RETURN NEW;
  END IF;

  IF v_payload IS NULL THEN RETURN NEW; END IF;

  -- Platform chrome is written with site NULL (it belongs to no tenant); the
  -- site it actually serves is the live one, so that is where it is filed.
  v_site := coalesce(TG_ARGV[0], row_json->>'site', 'main');

  SELECT r.payload INTO v_live
    FROM public.site_live l
    JOIN public.site_releases r
      ON r.site = l.site AND r.kind = l.kind AND r.ref = l.ref AND r.version = l.version
   WHERE l.site = v_site AND l.kind = v_kind AND l.ref = v_ref;

  -- Re-publishing without changing anything is common (a publish promotes the
  -- page AND the chrome, every time). Don't spend a version on it.
  IF v_live IS NOT NULL AND v_live = v_payload THEN RETURN NEW; END IF;

  SELECT coalesce(max(version), 0) + 1 INTO v_next
    FROM public.site_releases
   WHERE site = v_site AND kind = v_kind AND ref = v_ref;

  INSERT INTO public.site_releases (site, kind, ref, version, payload, label, author, source, src_schema)
  VALUES (v_site, v_kind, v_ref, v_next, v_payload, v_label,
          nullif(current_setting('app.actor', true), ''), current_user, TG_TABLE_SCHEMA);

  INSERT INTO public.site_live (site, kind, ref, version)
  VALUES (v_site, v_kind, v_ref, v_next)
  ON CONFLICT (site, kind, ref)
    DO UPDATE SET version = EXCLUDED.version, updated_at = now();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- The ledger records publishing; it must never be able to prevent it. Two
  -- operators publishing the same page in the same instant race on version
  -- numbering, and the loser drops its entry here rather than failing a save
  -- somebody is watching.
  RETURN NEW;
END
$fn$;

-- Attaching the per-tenant triggers below needs the owner of those tables, so
-- this file gets run once as `postgres` — which would leave a SECURITY DEFINER
-- function running as a superuser. It only ever needs to write two tables, so
-- hand it back to the role that owns them.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tgv_app') THEN
    BEGIN
      EXECUTE 'ALTER FUNCTION public.capture_site_release() OWNER TO tgv_app';
    EXCEPTION WHEN OTHERS THEN
      NULL; -- already tgv_app's, or we are not entitled to give it away
    END;
  END IF;
END
$do$;

-- ── attach ──────────────────────────────────────────────────────────────
-- `public` is the pooled store every tenant tinyglobalvillage.com serves reads
-- from. The per-tenant schemas are the four apps not yet pooled; they get
-- history now so that when they are migrated there is something to compare to.
DO $do$
DECLARE
  s   text;
  t   text;
  col text;
  arg text;
BEGIN
  FOREACH s IN ARRAY ARRAY['public','refusionist','resonantweaver','demo_fliring','giocoelho'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = s) THEN CONTINUE; END IF;
    -- public.page_models.site names the site per row; a tenant schema is one site.
    arg := CASE WHEN s = 'public' THEN NULL ELSE quote_literal(replace(s, '_', '-')) END;

    -- A tenant schema's tables are owned by that tenant's role, and only an
    -- owner may put a trigger on them. Attaching is therefore best-effort: the
    -- ones that need another role say so and the rest still land, because a
    -- permission denial on refusionist must not cost `public` its history.
    FOREACH t IN ARRAY ARRAY['page_models','content_overrides'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = s AND c.relname = t AND c.relkind = 'r'
      ) THEN CONTINUE; END IF;

      col := CASE WHEN t = 'page_models' THEN 'model_json, title' ELSE 'data' END;
      BEGIN
        EXECUTE format('DROP TRIGGER IF EXISTS trg_capture_release ON %I.%I', s, t);
        EXECUTE format(
          'CREATE TRIGGER trg_capture_release AFTER INSERT OR UPDATE OF %s '
          || 'ON %I.%I FOR EACH ROW EXECUTE FUNCTION public.capture_site_release(%s)',
          col, s, t, coalesce(arg, ''));
      EXCEPTION WHEN insufficient_privilege THEN
        RAISE NOTICE 'skipped %.% — owned by another role; re-run this file as its owner (or postgres) to record its history', s, t;
      END;
    END LOOP;
  END LOOP;
END
$do$;

-- ── grants ──────────────────────────────────────────────────────────────
-- Only Office reads the history and only Office restores from it. Tenants
-- write to it through the trigger, which runs as its definer, so they need no
-- grant of their own — which is the point: a tenant cannot rewrite its history.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tgv_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_releases, public.site_live TO tgv_app';
  END IF;
END
$do$;
