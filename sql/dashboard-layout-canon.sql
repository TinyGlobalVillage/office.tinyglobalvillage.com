-- dashboard-layout-canon.sql — one dashboard layout for the whole fleet.
--
-- Gio's instruction, 2026-08-05, in two halves:
--
--   "I don't want you to leave anyone's arrangement in tact, I want you to reset it so that every
--    tenant has the same dashboard right now."
--   "…and I want to be able to finalize the dashboard layout for HQ once so that every change I
--    make next applies to everyone. …a toggle between overwritten (which resets all users to the
--    default settings of their dashboard) and custom, and right now we'll keep it on overwritten."
--
-- WHAT WAS ACTUALLY WRONG. `member_dashboard_layout` held TWO rows in the entire fleet — Gio's and
-- Marthe's, both against TGV's own site_id — and every other dashboard read NULL. That is not a
-- fleet of arrangements to reconcile; it is drift. But it had a consequence nobody had connected:
-- a dashboard WITHOUT a row falls through to the host's container panels, which is where the
-- curated Build/Community/Reach ADDMs live, while a dashboard WITH a row gets the layout builder
-- and "Organize tiles" and a flat grid. So "only TGV has the edit tab and organize tile features,
-- yet all the rest of the tenants have ADDM of the tiles organized" was one feature split by an
-- accident of who had a row — not two features to merge.
--
-- The fix is mostly CODE, not data: the categories moved into the feature registry
-- (`FeatureDef.group`), `buildCanonicalLayout()` turns them into `kind:"section"` nodes, and every
-- dashboard now renders that tree. This file adds the one thing code cannot hold — the switch, and
-- the operator-published tree it points at.
--
-- WHAT THIS TABLE IS. A singleton (id = 1, enforced):
--   • mode = 'overwritten'  — the canon wins on EVERY dashboard. A member's own row is IGNORED,
--                             not deleted, so flipping to 'custom' hands everyone their
--                             arrangement back. This is the current setting, by instruction.
--   • mode = 'custom'       — a member's own row wins where they have one; the canon is the floor
--                             they start from.
--   • layout                — the tree an operator PUBLISHED from HQ. NULL means "use the built-in
--                             canonical layout", so a fresh database and a rolled-back canon behave
--                             identically and there is no seed to keep in step with the registry.
--
-- The personal rows are deliberately NOT deleted. Under 'overwritten' they render nothing, which
-- satisfies "reset it so that every tenant has the same dashboard right now" without making the
-- switch a one-way door.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/dashboard-layout-canon.sql
--
-- Re-runnable. Running it twice changes nothing the second time.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:dashboard-layout-canon', true);

CREATE TABLE IF NOT EXISTS public.dashboard_layout_canon (
  -- Singleton. The CHECK is what makes it one, rather than a convention in the routes.
  id          integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode        text NOT NULL DEFAULT 'overwritten' CHECK (mode IN ('overwritten', 'custom')),
  -- NULL = the registry-built canon. A jsonb ARRAY of LayoutNode when an operator has published.
  layout      jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

COMMENT ON TABLE public.dashboard_layout_canon IS
  'Singleton: which dashboard layout the fleet renders. mode=overwritten → the canon wins everywhere and member_dashboard_layout rows are ignored (not deleted); mode=custom → a member''s own row wins. layout NULL = the layout built from the feature registry. Office → Dashboard Config owns the switch.';

-- A published tree must be a jsonb ARRAY or the dashboard has nothing to render. Checked here so a
-- bad write is refused at the table rather than discovered at paint time on every dashboard at once.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.dashboard_layout_canon'::regclass
       AND conname = 'dashboard_layout_canon_layout_is_array'
  ) THEN
    ALTER TABLE public.dashboard_layout_canon
      ADD CONSTRAINT dashboard_layout_canon_layout_is_array
      CHECK (layout IS NULL OR jsonb_typeof(layout) = 'array');
  END IF;
END $$;

-- The row itself. `DO NOTHING` so a re-run never resets a mode an operator has since changed.
INSERT INTO public.dashboard_layout_canon (id, mode, layout, updated_by)
VALUES (1, 'overwritten', NULL, 'migration:dashboard-layout-canon')
ON CONFLICT (id) DO NOTHING;

-- ── assertions ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  n int;
  m text;
BEGIN
  SELECT count(*) INTO n FROM public.dashboard_layout_canon;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: the canon is a singleton, found % row(s)', n;
  END IF;

  SELECT mode INTO m FROM public.dashboard_layout_canon WHERE id = 1;
  IF m NOT IN ('overwritten', 'custom') THEN
    RAISE EXCEPTION 'assert: unknown mode %', m;
  END IF;

  -- The instruction is explicit that this is where the fleet sits today. A re-run must not change
  -- it (DO NOTHING above), so this only NOTICEs — it is a report, not a gate.
  IF m <> 'overwritten' THEN
    RAISE NOTICE 'canon mode is %, not overwritten — an operator changed it, leaving it alone', m;
  END IF;

  -- Nothing here deletes a member's arrangement. Say what survives, so the reversibility of the
  -- switch is a stated fact rather than an assumption.
  SELECT count(*) INTO n FROM public.member_dashboard_layout;
  RAISE NOTICE 'personal layouts kept (ignored while overwritten, restored on custom): %', n;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT id, mode, (layout IS NOT NULL) AS has_published_layout, updated_by, updated_at
  FROM public.dashboard_layout_canon;

COMMIT;
