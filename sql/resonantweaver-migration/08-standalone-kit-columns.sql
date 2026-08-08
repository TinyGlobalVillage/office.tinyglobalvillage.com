-- 08 — her STANDALONE schema catches up with the editor kit it already runs.
--
-- Not part of the pooling migration: this fixes the app the ROLLBACK put back.
-- resonantweaver.com's own schema tables were hand-authored before the kit grew
-- two columns — content_overrides.site (kit 0003, W4 per-site chrome,
-- 2026-07-31) and page_models.kind (kit 0004, W5 blog port) — and the Aug 4
-- deploy shipped kit code that queries both unconditionally. Nobody noticed
-- because the editor had been unreachable since 2026-07-26 (the serverSession
-- username bounce): the moment THAT was fixed, /editor/home stopped bouncing
-- and started 500ing on `column content_overrides.site does not exist`.
--
-- Additive only, matching the kit defaults exactly; her app is the sole reader
-- of these schema-local tables. Re-runs to a no-op.

BEGIN;

ALTER TABLE resonantweaver.content_overrides
  ADD COLUMN IF NOT EXISTS site text;

ALTER TABLE resonantweaver.page_models
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'page';

-- Assert the shape the kit queries is now present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'resonantweaver'
       AND table_name = 'content_overrides' AND column_name = 'site'
  ) THEN
    RAISE EXCEPTION 'content_overrides.site still missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'resonantweaver'
       AND table_name = 'page_models' AND column_name = 'kind'
  ) THEN
    RAISE EXCEPTION 'page_models.kind still missing';
  END IF;
END $$;

COMMIT;
