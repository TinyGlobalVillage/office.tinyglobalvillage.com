-- 05-journey-signups.sql — the festival access page's one table, pooled.
--
-- HAND-WRITTEN, not generated: `generate.mjs` produces page rows out of her
-- content modules, and this is neither content nor a page. `/open-your-journey`
-- is the one part of her funnel that is an APPLICATION — it validates an email,
-- writes a row, sends the access mail and redirects to a private GPT whose URL
-- never reaches the client. A `form-live` section could collect the address; it
-- could not keep the destination secret, because a thank-you link is in the page
-- source for anyone who never typed a word. So the surface is an HQ route behind
-- a SITE_SURFACES grant, and this is the table underneath it.
--
-- CUTOVER-PLAN §2. Two steps, both re-runnable, in one transaction:
--   (a) DDL — `public.journey_signups`, her table plus the tenant key.
--   (b) COPY — her rows, by primary key, forced onto `site='resonantweaver'`.
--
-- APPLY AS THE `postgres` SUPERUSER. It reads the `resonantweaver` schema, which
-- tgv_app cannot; her own table was created the same way (her repo's
-- src/db/journey-signups.sql says so in its header).
--
--   sudo -u postgres psql -v ON_ERROR_STOP=1 -d tgv_db -f 05-journey-signups.sql
--
-- RE-RUN IT AT CUTOVER. Her app keeps taking signups on :3003 until nginx moves,
-- and those land in HER schema, not here. The copy is `ON CONFLICT (id) DO
-- NOTHING` over preserved ids precisely so the second run picks up the window
-- and changes nothing else. Today the window holds 2 rows, both Gio's own tests.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-05-journey-signups', true);

-- ── (a) the table ────────────────────────────────────────────────────────
--
-- Her six columns verbatim (src/db/journey-signups.sql), plus `site`.
--
-- `site` IS `NOT NULL` WITH NO DEFAULT, AND THAT IS THE WHOLE POINT. The trap
-- this migration family already fell into once — refusionist's home page landing
-- as demo content and passing a row-count check — was a forced tenant key that
-- had a DEFAULT to fall back on when it dropped out of a column intersection.
-- A mailing list is the worst possible place to repeat that: an unkeyed row is
-- not merely miscategorised, it is somebody's email address in a stranger's
-- export. With no default, a writer that forgets the key gets an error instead
-- of a silent misfiling, on the platform AND in any future copy.
CREATE TABLE IF NOT EXISTS public.journey_signups (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    site          text NOT NULL,
    email         text NOT NULL,
    source        text NOT NULL DEFAULT 'festival',
    email_status  text NOT NULL DEFAULT 'pending',   -- 'pending' | 'sent' | 'failed'
    email_error   text,                              -- short technical note; never shown to a customer
    created_at    timestamptz NOT NULL DEFAULT now()
);

-- Newest-first per tenant is the only read this table has (the CSV export), so
-- the index carries the site key rather than sitting on created_at alone the way
-- hers does. Hers had one tenant and did not need to say so.
CREATE INDEX IF NOT EXISTS journey_signups_site_created_idx
    ON public.journey_signups (site, created_at DESC);

COMMENT ON TABLE public.journey_signups IS
  'Festival access-page signups (/open-your-journey), one row per email. Site-keyed: '
  'a mailing list must never fall through to the fleet. Pooled from '
  'resonantweaver.journey_signups 2026-08-06 (CUTOVER-PLAN §2).';
COMMENT ON COLUMN public.journey_signups.site IS
  'Owning tenant, matching villager_sites.subdomain. NOT NULL with no default on purpose.';

-- Grants mirror the sibling content tables: HQ and Office read as tgv_app, the
-- pooled fleet as tgv_tenant_app. No RLS, same as page_models / announcements /
-- testimonials — the silo sweep (office/sql/tenant-silo-regroup.sql) is a
-- separate pass and picks up new tables when it re-runs.
ALTER TABLE public.journey_signups OWNER TO tgv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_signups TO tgv_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journey_signups TO tgv_tenant_app;

-- ── (b) her rows ─────────────────────────────────────────────────────────
--
-- Driven off the TARGET's column list intersected with the source's, plus the
-- forced key — the shape `ref_copy` grew after the demo-content trap, written
-- out here because it is one table and a function would be more machinery than
-- migration. The `raise` below is the half that mattered: it refuses to run when
-- a forced key is not a real column of the target, which is how a silent default
-- got a chance to answer in the first place.
DO $$
DECLARE
  cols   text;
  n      int;
BEGIN
  IF to_regclass('resonantweaver.journey_signups') IS NULL THEN
    RAISE NOTICE 'source resonantweaver.journey_signups is gone — nothing to copy (already pooled?)';
    RETURN;
  END IF;

  -- The forced key must exist on the target, or the copy is writing nowhere.
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'journey_signups' AND column_name = 'site';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'copy: forced key "site" is not a column of public.journey_signups';
  END IF;

  SELECT string_agg(quote_ident(t.column_name), ', ' ORDER BY t.ordinal_position)
    INTO cols
    FROM information_schema.columns t
   WHERE t.table_schema = 'public' AND t.table_name = 'journey_signups'
     AND t.column_name <> 'site'
     AND EXISTS (
       SELECT 1 FROM information_schema.columns s
        WHERE s.table_schema = 'resonantweaver' AND s.table_name = 'journey_signups'
          AND s.column_name = t.column_name);

  IF cols IS NULL THEN
    RAISE EXCEPTION 'copy: no columns in common between the two journey_signups';
  END IF;

  EXECUTE format(
    'INSERT INTO public.journey_signups (site, %s) SELECT %L, %s FROM resonantweaver.journey_signups ON CONFLICT (id) DO NOTHING',
    cols, 'resonantweaver', cols);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'copied % new signup row(s) on columns: %', n, cols;
END $$;

-- ── assertions ───────────────────────────────────────────────────────────
DO $$
DECLARE n int; m int;
BEGIN
  -- Every row of hers reconciled by primary key. Row COUNTS are what the
  -- refusionist rehearsal proved you cannot trust; ids are what it checked.
  IF to_regclass('resonantweaver.journey_signups') IS NOT NULL THEN
    SELECT count(*) INTO n
      FROM resonantweaver.journey_signups s
     WHERE NOT EXISTS (SELECT 1 FROM public.journey_signups p WHERE p.id = s.id);
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % of her signup rows did not arrive', n;
    END IF;

    -- ...and arrived as HERS. A copied row wearing another tenant's key, or no
    -- key at all, is the failure this whole file is shaped around.
    SELECT count(*) INTO n
      FROM public.journey_signups p
      JOIN resonantweaver.journey_signups s USING (id)
     WHERE p.site IS DISTINCT FROM 'resonantweaver';
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % copied row(s) do not carry her site key', n;
    END IF;

    -- Content, not just presence: the email and the delivery status are the two
    -- fields the export exists to carry.
    SELECT count(*) INTO n
      FROM public.journey_signups p
      JOIN resonantweaver.journey_signups s USING (id)
     WHERE p.email IS DISTINCT FROM s.email
        OR p.source IS DISTINCT FROM s.source
        OR p.email_status IS DISTINCT FROM s.email_status
        OR p.created_at IS DISTINCT FROM s.created_at;
    IF n <> 0 THEN
      RAISE EXCEPTION 'assert: % copied row(s) differ from the source', n;
    END IF;
  END IF;

  -- Nobody else's list moved. This table is new, so anything not hers is a bug
  -- in this file rather than pre-existing data.
  SELECT count(*) INTO m FROM public.journey_signups WHERE site <> 'resonantweaver';
  IF m <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) belong to a site this migration never touched', m;
  END IF;

  SELECT count(*) INTO n FROM public.journey_signups WHERE site = 'resonantweaver';
  RAISE NOTICE 'assertions passed — % signup row(s) for resonantweaver', n;
END $$;

SELECT site, email_status, count(*) AS rows, min(created_at) AS first, max(created_at) AS last
  FROM public.journey_signups GROUP BY site, email_status ORDER BY site, email_status;

COMMIT;
