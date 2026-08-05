-- =========================================================================
-- Refusionist migration — step 0: make `public` able to receive it.
--
-- DDL ONLY. Copies no rows. Re-runnable: every statement is guarded, and a
-- second run is a no-op. Rehearse against refusionist_rehearsal first
-- (see README.md), then apply to tgv_db.
--
-- Plan 41-48 + section F. Rulings taken 2026-08-04 (see 01-id-map.sql for
-- the identity ones):
--   * announcements / plans / prices get a `site` key rather than landing
--     platform-wide. promo_codes comes with them for the same reason: a
--     discount code minted for a refusionist plan must not apply to
--     guardians' checkout.
--   * all seven analytics tables are promoted to public canon, including
--     the three empty fact tables, so the surface has somewhere to write.
-- =========================================================================

\set ON_ERROR_STOP on

begin;

-- -------------------------------------------------------------------------
-- 0.1  The site key.
--
-- A pooled tenant is addressed two ways: villager_sites.subdomain, and the
-- `site` text key on the content tables ('giocoelho', 'guardians', 'nevlo').
-- Refusionist's villager_sites row has never carried a subdomain because it
-- has only ever been reached by its own domain.
-- -------------------------------------------------------------------------
update public.villager_sites
   set subdomain  = 'refusionist',
       updated_at = now()
 where id = 'a0a0a0a0-0000-4000-8000-0000005ec0de'
   and subdomain is distinct from 'refusionist';

-- -------------------------------------------------------------------------
-- 0.2  Enum types the promoted tables need.
--
-- Labels are copied verbatim from the refusionist schema. Every enum shared
-- by a refusionist table and its public twin was checked label-for-label and
-- they are identical, so a cross-schema copy only ever needs ::text::enum.
-- -------------------------------------------------------------------------
do $$ begin
  create type public.analytics_chart_type as enum
    ('sparkline','line','bar','donut','table','metric');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.analytics_audit_kind as enum
    ('report_saved','report_deleted','dashboard_saved','snapshot_captured','config_changed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.studio_purchase_status as enum
    ('pending','paid','failed','refunded');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------------------
-- 0.3  Site scoping for the three unscoped surfaces (+ promo_codes).
--
-- NULL means platform-wide, which is what every existing row is. Only rows
-- written by this migration are tagged, so nothing already live changes
-- meaning. Refusionist's 20 announcements are its own product changelog
-- ("Human Design Engine is Live", "Tarot Birth Card Engine") — fleet-wide
-- they would show up on guardianstuffies.com.
-- -------------------------------------------------------------------------
alter table public.announcements add column if not exists site text;
alter table public.plans        add column if not exists site text;
alter table public.prices       add column if not exists site text;
alter table public.promo_codes  add column if not exists site text;

create index if not exists announcements_site_idx on public.announcements (site);
create index if not exists plans_site_idx         on public.plans (site);
create index if not exists prices_site_idx        on public.prices (site);
create index if not exists promo_codes_site_idx   on public.promo_codes (site);

comment on column public.announcements.site is
  'Pooled-tenant site key; NULL = platform-wide. Added by the Refusionist migration.';
comment on column public.plans.site is
  'Pooled-tenant site key; NULL = platform-wide. Added by the Refusionist migration.';
comment on column public.prices.site is
  'Pooled-tenant site key; NULL = platform-wide. Added by the Refusionist migration.';
comment on column public.promo_codes.site is
  'Pooled-tenant site key; NULL = platform-wide. Added by the Refusionist migration.';

-- -------------------------------------------------------------------------
-- 0.4  platform_config.view_settings_visibility
--
-- The only column refusionist.platform_config holds that public does not,
-- and it is real data: which Human Design chart surfaces the cospro engine
-- renders (bodygraph, mandala, penta, magic square...). Both tables are
-- singletons keyed id=1, so the ROW cannot merge — the column comes across
-- and 02-copy.sql writes the value onto public's existing row.
-- -------------------------------------------------------------------------
alter table public.platform_config
  add column if not exists view_settings_visibility jsonb;

comment on column public.platform_config.view_settings_visibility is
  'Cospro chart-surface toggles, carried from refusionist.platform_config.';

-- -------------------------------------------------------------------------
-- 0.5  The cospro tables (plan 44).
--
-- Structure copied from the refusionist schema; the only change is that the
-- member FKs now point at public.members.
-- -------------------------------------------------------------------------
create table if not exists public.cosmic_profiles (
    id                     uuid primary key default gen_random_uuid(),
    birth_date             text,
    birth_time             text,
    birth_location         text,
    birth_lat              text,
    birth_lon              text,
    hd_type                text,
    raw_chart_data         jsonb,
    life_path_number       integer,
    chinese_zodiac_animal  text,
    chinese_zodiac_element text,
    chinese_zodiac_year    text,
    mayan_day_sign         text,
    mayan_galactic_tone    integer,
    mayan_tzolkin_position integer,
    mayan_data             jsonb,
    natal_chart_tropical   jsonb,
    natal_chart_vedic      jsonb,
    linked_user_id         uuid references public.members(id) on delete set null,
    created_at             timestamptz default now(),
    updated_at             timestamptz default now()
);

create table if not exists public.user_cosmic_profiles (
    id                uuid primary key default gen_random_uuid(),
    owner_user_id     uuid not null references public.members(id) on delete cascade,
    cosmic_profile_id uuid not null references public.cosmic_profiles(id) on delete cascade,
    label             text,
    relation          text,
    is_self           boolean not null default false,
    created_at        timestamptz default now()
);

create unique index if not exists user_cosmic_profiles_owner_profile_unique
  on public.user_cosmic_profiles (owner_user_id, cosmic_profile_id);

create table if not exists public.member_orakle_prefs (
    member_id                           uuid primary key references public.members(id) on delete cascade,
    orakle_enabled                      boolean not null default false,
    cosmic_profile_enabled              boolean not null default false,
    cosmic_profile_birth_data_requested boolean not null default false,
    cosmic_profile_birth_data_opted_out boolean not null default false,
    can_add_extra_charts                boolean not null default false,
    orakle_prefs                        jsonb   not null default '{}'::jsonb,
    created_at                          timestamptz not null default now(),
    updated_at                          timestamptz not null default now()
);

comment on table public.member_orakle_prefs is
  'Refusionist-era cospro per-member prefs. The Office Profile Engines tile '
  'dual-writes refusionist.member_orakle_prefs today; that half retires when '
  'the live app reads this copy instead (plan 44).';

-- -------------------------------------------------------------------------
-- 0.6  Analytics (plan 46 — ruling: promote all seven).
--
-- site_id already carries refusionist's villager_sites id in every row, so
-- these need no rewriting at copy time.
-- -------------------------------------------------------------------------
create table if not exists public.analytics_events (
    id              uuid primary key default gen_random_uuid(),
    site_id         uuid not null,
    dataset         text not null,
    event_type      text not null,
    occurred_at     timestamptz not null default now(),
    actor_id        text,
    subject_id      text,
    amount_cents    integer,
    quantity        numeric,
    dimensions      jsonb not null default '{}'::jsonb,
    props           jsonb,
    idempotency_key text,
    created_at      timestamptz not null default now()
);
create index if not exists analytics_events_scan_idx
  on public.analytics_events (site_id, dataset, occurred_at);
create index if not exists analytics_events_actor_idx
  on public.analytics_events (site_id, dataset, actor_id) where actor_id is not null;
create unique index if not exists analytics_events_idem_idx
  on public.analytics_events (site_id, dataset, idempotency_key) where idempotency_key is not null;

create table if not exists public.analytics_metric_points (
    id          uuid primary key default gen_random_uuid(),
    site_id     uuid not null,
    metric_key  text not null,
    occurred_at timestamptz not null default now(),
    dimensions  jsonb not null default '{}'::jsonb,
    value       numeric not null,
    updated_at  timestamptz not null default now()
);
create index if not exists analytics_metric_points_scan_idx
  on public.analytics_metric_points (site_id, metric_key, occurred_at);
create unique index if not exists analytics_metric_points_natural_idx
  on public.analytics_metric_points (site_id, metric_key, occurred_at, md5(dimensions::text));

create table if not exists public.analytics_snapshots (
    id            uuid primary key default gen_random_uuid(),
    site_id       uuid not null,
    snapshot_kind text not null,
    scope_key     text not null default 'default',
    captured_on   date not null,
    payload       jsonb not null,
    created_at    timestamptz not null default now()
);
create unique index if not exists analytics_snapshots_daykey_idx
  on public.analytics_snapshots (site_id, snapshot_kind, scope_key, captured_on);

create table if not exists public.analytics_dashboards (
    id         uuid primary key default gen_random_uuid(),
    site_id    uuid not null,
    key        text not null default 'main',
    name       text not null default 'Overview',
    sections   jsonb not null default '[]'::jsonb,
    is_default boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create unique index if not exists analytics_dashboards_key_idx
  on public.analytics_dashboards (site_id, key);
create unique index if not exists analytics_dashboards_default_idx
  on public.analytics_dashboards (site_id) where is_default;

create table if not exists public.analytics_dashboard_cards (
    id           uuid primary key default gen_random_uuid(),
    site_id      uuid not null,
    dashboard_id uuid not null references public.analytics_dashboards(id) on delete cascade,
    section_id   text not null default 'main',
    title        text not null,
    query        jsonb not null,
    chart_type   public.analytics_chart_type not null default 'metric',
    "position"   integer not null default 0,
    width        integer not null default 1,
    height       integer not null default 1,
    target       numeric,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    constraint analytics_card_width_ck  check (width  >= 1 and width  <= 4),
    constraint analytics_card_height_ck check (height >= 1 and height <= 2)
);
create index if not exists analytics_dashboard_cards_dash_idx
  on public.analytics_dashboard_cards (dashboard_id, section_id, "position");

create table if not exists public.analytics_saved_reports (
    id            uuid primary key default gen_random_uuid(),
    site_id       uuid not null,
    owner_user_id uuid,
    name          text not null,
    category      text,
    query         jsonb not null,
    chart_type    public.analytics_chart_type not null default 'line',
    is_preset     boolean not null default false,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists analytics_saved_reports_site_idx
  on public.analytics_saved_reports (site_id, is_preset);
create unique index if not exists analytics_saved_reports_preset_idx
  on public.analytics_saved_reports (site_id, name) where is_preset;

create table if not exists public.analytics_audit (
    id            uuid primary key default gen_random_uuid(),
    site_id       uuid not null,
    kind          public.analytics_audit_kind not null,
    actor_user_id uuid,
    details       jsonb,
    created_at    timestamptz not null default now()
);
create index if not exists analytics_audit_site_idx
  on public.analytics_audit (site_id, created_at);

-- -------------------------------------------------------------------------
-- 0.7  studio_purchases — the one hole left in the pooled studio surface.
--
-- Empty in refusionist and absent from public, while every other studio
-- table already has a public twin. Created so the surface is whole; nothing
-- writes it today.
-- -------------------------------------------------------------------------
create table if not exists public.studio_purchases (
    id                uuid primary key default gen_random_uuid(),
    site_id           uuid not null,
    member_id         uuid not null,
    pricing_option_id uuid not null,
    entitlement_id    uuid references public.studio_entitlements(id) on delete set null,
    amount_cents      integer not null default 0,
    currency          text not null default 'usd',
    provider          text not null default 'stripe',
    provider_ref      text,
    status            public.studio_purchase_status not null default 'pending',
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index if not exists studio_purchases_site_idx on public.studio_purchases (site_id);
create index if not exists studio_purchases_user_idx on public.studio_purchases (member_id);

-- -------------------------------------------------------------------------
-- 0.8  Grants. The pooled fleet reads as tgv_tenant_app; Office and HQ as
--      tgv_app. Mirror whatever the sibling tables already hold rather than
--      inventing a policy here (see office/sql/tenant-silo-regroup.sql for
--      the RLS half — new tables are NOT silo'd until that sweep re-runs).
-- -------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'cosmic_profiles','user_cosmic_profiles','member_orakle_prefs',
    'analytics_events','analytics_metric_points','analytics_snapshots',
    'analytics_dashboards','analytics_dashboard_cards','analytics_saved_reports',
    'analytics_audit','studio_purchases'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to tgv_app', t);
    execute format('grant select, insert, update, delete on public.%I to tgv_tenant_app', t);
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- 0.9  Assertions — refuse to commit unless the ground is actually ready.
-- -------------------------------------------------------------------------
do $$
declare missing text;
begin
  select string_agg(t, ', ')
    into missing
    from unnest(array[
      'cosmic_profiles','user_cosmic_profiles','member_orakle_prefs',
      'analytics_events','analytics_metric_points','analytics_snapshots',
      'analytics_dashboards','analytics_dashboard_cards','analytics_saved_reports',
      'analytics_audit','studio_purchases'
    ]) t
   where to_regclass('public.'||quote_ident(t)) is null;
  if missing is not null then
    raise exception 'preflight: tables missing from public: %', missing;
  end if;

  select string_agg(c, ', ')
    into missing
    from (values ('announcements','site'),('plans','site'),('prices','site'),
                 ('promo_codes','site'),('platform_config','view_settings_visibility')) v(t, c)
   where not exists (
     select 1 from information_schema.columns
      where table_schema='public' and table_name=v.t and column_name=v.c);
  if missing is not null then
    raise exception 'preflight: site/config columns missing: %', missing;
  end if;

  if not exists (select 1 from public.villager_sites
                  where id='a0a0a0a0-0000-4000-8000-0000005ec0de'
                    and subdomain='refusionist') then
    raise exception 'preflight: refusionist villager_sites row has no subdomain key';
  end if;

  raise notice 'preflight OK — public is ready to receive refusionist';
end $$;

commit;
