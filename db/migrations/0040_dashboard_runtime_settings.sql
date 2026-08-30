-- 0040 — dashboard_runtime_settings: staff-tunable runtime values for the
-- member dashboards (Office writes via /api/admin/dashboard-settings; each
-- tenant dashboard reads server-side, same cross-app pattern as
-- platform_feature_flags). KV with jsonb values so new tunables need no DDL.
--
-- Seeded: undo_depth — how many destructive actions a member can reverse with
-- cmd/ctrl+Z in one dashboard session (the invisible undo stack's cap).

CREATE TABLE IF NOT EXISTS public.dashboard_runtime_settings (
  setting_key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

INSERT INTO public.dashboard_runtime_settings (setting_key, value)
VALUES ('undo_depth', '10'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
