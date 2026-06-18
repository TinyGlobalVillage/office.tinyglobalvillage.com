-- 0039_platform_feature_flags_member_billing.sql
-- TGV Office P7 (Office member-ops lane) — two additive tables on the shared tgv_db.
-- Canonical design: ~/.claude/checklist/tgv-dashboard-p7-office-lane.md
--
-- Applied via psql (additive + idempotent). NOTE: tinyglobalvillage.com owns the
-- canonical drizzle journal, whose snapshot has DRIFTED (recent migrations
-- 0037/0038 are hand-authored + applied directly, not registered in
-- meta/_journal.json — see memory project_tgvcom_drizzle_snapshot_drift). This
-- file is the Office-lane record; mirror into tgv.com src/db/migrations on
-- coordination. Ends with OWNER TO tgv_app so the app role (which connects as
-- tgv_app) can read/write — a table CREATEd as postgres is owned by postgres and
-- the app would 500 on first access without this.

BEGIN;

-- 1. platform_feature_flags — GLOBAL dashboard feature killswitch (soft-launch gate).
--    A second gate layered on top of the per-member dashboard_features toggle.
--    state: 'off'   = feature hidden for EVERYONE (members AND admins)
--           'admin' = visible ONLY to platform admins (preview/test before launch)
--           'on'    = no global restriction; the per-member dashboard_features
--                     toggle decides (existing behaviour).
--    Enforcement lives in each tenant dashboard's feature resolution (a one-line
--    filter that reads this table — handed to the tgv.com lane). Office only
--    WRITES the flags here. A feature key with NO row is treated as 'on'.
CREATE TABLE IF NOT EXISTS public.platform_feature_flags (
  feature_key text PRIMARY KEY,
  state       text NOT NULL DEFAULT 'on' CHECK (state IN ('off','admin','on')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

-- Seed the launch feature suite at 'on' (no behavioural change until an operator
-- flips one down in the Office Dashboard Config tile). Idempotent; new feature
-- keys can be added later (seed row or the tile's add-feature input).
INSERT INTO public.platform_feature_flags (feature_key, state) VALUES
  ('storefront','on'),
  ('members','on'),
  ('yellowpages','on'),
  ('analytics','on'),
  ('performers','on'),
  ('course','on'),
  ('studio','on'),
  ('domain-console','on'),
  ('payments','on'),
  ('wallet','on')
ON CONFLICT (feature_key) DO NOTHING;

-- 2. member_billing — OPERATOR-SET onboarding/billing INTENT, per person.
--    This is NOT the Stripe/subscription state table. The membership billing
--    ENGINE (tgv.com / billing lane) owns subscription rows + Stripe objects and
--    READS this table as the operator's onboarding contract. Per member_user.
--      plan_interval        monthly | yearly (NULL until chosen)
--      charge_start_at      begin charging on/after this date (NULL = not set)
--      custom_amount_cents  NULL = normal monthly rate; else operator override
--      waiver_until         comp through this date (a waiver of N months/years,
--                           resolved to a date by the operator UI)
--      notify_to_pay        the "needs to be notified to pay by renewal" flag
--    "Member since" is NOT stored here — it is member_users.created_at (display).
CREATE TABLE IF NOT EXISTS public.member_billing (
  member_user_id      uuid PRIMARY KEY
                      REFERENCES public.member_users(id) ON DELETE CASCADE,
  plan_interval       text CHECK (plan_interval IN ('monthly','yearly')),
  charge_start_at     timestamptz,
  custom_amount_cents integer CHECK (custom_amount_cents IS NULL OR custom_amount_cents >= 0),
  waiver_until        timestamptz,
  notify_to_pay       boolean NOT NULL DEFAULT false,
  updated_by          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_feature_flags OWNER TO tgv_app;
ALTER TABLE public.member_billing OWNER TO tgv_app;

COMMIT;
