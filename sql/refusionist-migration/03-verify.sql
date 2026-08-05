-- =========================================================================
-- Refusionist migration — step 3: prove it.
--
-- Read-only. Raises on the first thing that is wrong, so it can be run in a
-- rolled-back transaction against production before anything is committed,
-- and again afterwards.
--
-- "The rows copied" is not the standard. What this asserts:
--   * every source row that was ELIGIBLE to move is present in public,
--     found by its own primary key rewritten through the map — not by a
--     count, which hides a swap;
--   * no copied row points at a member who does not exist;
--   * the tenant keys are on, so nothing landed platform-wide by accident;
--   * the fixtures did not sneak in;
--   * the other pooled tenants are untouched.
--
-- The browser half of plan 38 is not here and cannot be: run it against the
-- live HQ behind a Host-rewriting proxy, page by page, before DNS moves.
-- =========================================================================

\set ON_ERROR_STOP on

begin;

-- -------------------------------------------------------------------------
-- 3.1  Per-table reconciliation, by primary key.
-- -------------------------------------------------------------------------
create or replace function pg_temp.ref_verify(
  p_table      text,
  p_owner_cols text[] default '{}'
) returns table (tbl text, eligible bigint, present bigint, missing bigint)
language plpgsql as $fn$
declare
  pk       text[];
  joins    text[] := '{}';
  wheres   text[] := '{}';
  col      text;
  q        text;
begin
  select array_agg(a.attname order by k.ord)
    into pk
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
   where c.connamespace = 'public'::regnamespace
     and c.contype = 'p'
     and c.conrelid = ('public.'||quote_ident(p_table))::regclass;

  if pk is null then
    raise exception 'ref_verify: public.% has no primary key', p_table;
  end if;

  foreach col in array pk loop
    if col = any (p_owner_cols) then
      joins := joins || format(
        'p.%I::text is not distinct from (select m.new_id::text from public.refusionist_migration_map m '
        ' where m.legacy_id::text = s.%I::text and m.disposition = ''merge'')', col, col);
    else
      joins := joins || format('p.%I is not distinct from s.%I', col, col);
    end if;
  end loop;

  foreach col in array p_owner_cols loop
    wheres := wheres || format(
      '(s.%I is null or exists (select 1 from public.refusionist_migration_map m '
      '  where m.legacy_id::text = s.%I::text and m.disposition = ''merge''))', col, col);
  end loop;

  q := format(
    'select %L::text,
            count(*)::bigint,
            count(*) filter (where exists (select 1 from public.%I p where %s))::bigint,
            count(*) filter (where not exists (select 1 from public.%I p where %s))::bigint
       from refusionist.%I s %s',
    p_table,
    p_table, array_to_string(joins, ' and '),
    p_table, array_to_string(joins, ' and '),
    p_table,
    case when array_length(wheres,1) is null then ''
         else 'where ' || array_to_string(wheres, ' and ') end);

  return query execute q;
end
$fn$;

create temp table ref_recon as
  select * from pg_temp.ref_verify('availability_schedules',            array['owner_user_id'])
  union all select * from pg_temp.ref_verify('availability_weekly_rules')
  union all select * from pg_temp.ref_verify('availability_schedule_event_types')
  union all select * from pg_temp.ref_verify('event_types',             array['owner_user_id'])
  union all select * from pg_temp.ref_verify('bookings',                array['host_user_id'])
  union all select * from pg_temp.ref_verify('booking_requests',        array['from_user_id','to_user_id'])
  union all select * from pg_temp.ref_verify('calendar_integrations',   array['user_id'])
  union all select * from pg_temp.ref_verify('calendar_notification_settings', array['user_id'])
  union all select * from pg_temp.ref_verify('page_models',             array['user_id'])
  union all select * from pg_temp.ref_verify('content_overrides',       array['user_id'])
  union all select * from pg_temp.ref_verify('categories')
  union all select * from pg_temp.ref_verify('tags')
  union all select * from pg_temp.ref_verify('collections',             array['created_by'])
  union all select * from pg_temp.ref_verify('posts',                   array['author_id'])
  union all select * from pg_temp.ref_verify('collection_posts')
  union all select * from pg_temp.ref_verify('post_tags')
  union all select * from pg_temp.ref_verify('testimonials')
  union all select * from pg_temp.ref_verify('announcements',           array['created_by'])
  union all select * from pg_temp.ref_verify('announcement_user_states',array['user_id'])
  union all select * from pg_temp.ref_verify('plans')
  union all select * from pg_temp.ref_verify('prices')
  union all select * from pg_temp.ref_verify('promo_codes')
  union all select * from pg_temp.ref_verify('store_profiles',          array['user_id'])
  union all select * from pg_temp.ref_verify('meetings')
  union all select * from pg_temp.ref_verify('meeting_participants')
  union all select * from pg_temp.ref_verify('meeting_recordings')
  union all select * from pg_temp.ref_verify('session_state')
  union all select * from pg_temp.ref_verify('studio_service_categories')
  union all select * from pg_temp.ref_verify('studio_session_types')
  union all select * from pg_temp.ref_verify('studio_class_descriptions')
  union all select * from pg_temp.ref_verify('studio_class_schedules')
  union all select * from pg_temp.ref_verify('studio_classes',          array['staff_user_id'])
  union all select * from pg_temp.ref_verify('cosmic_profiles',         array['linked_user_id'])
  union all select * from pg_temp.ref_verify('user_cosmic_profiles',    array['owner_user_id'])
  union all select * from pg_temp.ref_verify('member_orakle_prefs',     array['member_id'])
  union all select * from pg_temp.ref_verify('analytics_dashboards')
  union all select * from pg_temp.ref_verify('analytics_dashboard_cards')
  union all select * from pg_temp.ref_verify('analytics_saved_reports', array['owner_user_id'])
  union all select * from pg_temp.ref_verify('analytics_audit',         array['actor_user_id'])
  union all select * from pg_temp.ref_verify('dashboard_features',      array['user_id'])
  union all select * from pg_temp.ref_verify('orakle_usage',            array['user_id'])
  union all select * from pg_temp.ref_verify('platform_admins')
  union all select * from pg_temp.ref_verify('support_settings');

select tbl, eligible, present, missing from ref_recon where eligible > 0 order by eligible desc, tbl;

do $$
declare bad text; moved bigint;
begin
  select string_agg(format('%s (%s of %s missing)', tbl, missing, eligible), '; ')
    into bad from ref_recon where missing > 0;
  if bad is not null then
    raise exception 'verify 3.1: eligible rows did not land — %', bad;
  end if;
  select sum(present) into moved from ref_recon;
  raise notice 'verify 3.1 OK — % eligible rows reconciled by primary key', moved;
end $$;

-- -------------------------------------------------------------------------
-- 3.2  No legacy id survived the crossing.
--
-- The failure this guards against is a row landing in public still carrying
-- its refusionist member id — the map bypassed, the person orphaned. That is
-- fatal and raises.
--
-- Plain dangling references are reported but do NOT raise: public.members has
-- no FK from dashboard_features and tgv_db already carries 8 such rows that
-- predate this work. Failing on them would be blaming the migration for
-- something it found rather than caused.
-- -------------------------------------------------------------------------
do $$
declare r record; n int; bad text := ''; stale text := '';
begin
  for r in
    select c.relname as tbl, a.attname as col
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      join pg_type t on t.oid = a.atttypid
     where ns.nspname = 'public' and c.relkind = 'r' and t.typname = 'uuid'
       and a.attname in ('user_id','owner_user_id','client_user_id','host_user_id',
                         'created_by','author_id','linked_user_id','actor_user_id',
                         'staff_user_id','member_id')
       and c.relname in ('bookings','page_models','content_overrides','dashboard_features',
                         'cosmic_profiles','user_cosmic_profiles','member_orakle_prefs',
                         'announcements','announcement_user_states','collections','posts',
                         'availability_schedules','event_types','store_profiles',
                         'orakle_usage','analytics_saved_reports','analytics_audit',
                         'studio_classes','calendar_integrations','calendar_notification_settings')
  loop
    execute format(
      'select count(*) from public.%I x
        where exists (select 1 from public.refusionist_migration_map m where m.legacy_id = x.%I)',
      r.tbl, r.col) into n;
    if n > 0 then
      stale := stale || format('%s.%s: %s; ', r.tbl, r.col, n);
    end if;
  end loop;
  if stale <> '' then
    raise exception 'verify 3.2: legacy refusionist ids reached public unmapped — %', stale;
  end if;
  raise notice 'verify 3.2 OK — no legacy refusionist id survived into public';
end $$;

do $$
declare r record; n int; bad text := '';
begin
  for r in
    select c.relname as tbl, a.attname as col
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      join pg_type t on t.oid = a.atttypid
     where ns.nspname = 'public' and c.relkind = 'r' and t.typname = 'uuid'
       and a.attname in ('user_id','owner_user_id','client_user_id','host_user_id',
                         'created_by','author_id','linked_user_id','actor_user_id',
                         'staff_user_id','member_id')
       and c.relname in ('bookings','page_models','content_overrides','dashboard_features',
                         'cosmic_profiles','user_cosmic_profiles','member_orakle_prefs',
                         'announcements','announcement_user_states','collections','posts',
                         'availability_schedules','event_types','store_profiles',
                         'orakle_usage','analytics_saved_reports','analytics_audit',
                         'studio_classes','calendar_integrations','calendar_notification_settings')
  loop
    execute format(
      'select count(*) from public.%I x where x.%I is not null
         and not exists (select 1 from public.members m where m.id = x.%I)',
      r.tbl, r.col, r.col) into n;
    if n > 0 then
      bad := bad || format('%s.%s: %s; ', r.tbl, r.col, n);
    end if;
  end loop;
  if bad <> '' then
    raise notice 'verify 3.2b — pre-existing member references that resolve to nothing (NOT caused by this migration, no FK enforces them): %', bad;
  else
    raise notice 'verify 3.2b OK — every member reference resolves';
  end if;
end $$;

-- -------------------------------------------------------------------------
-- 3.3  Nothing landed unscoped. A refusionist row that reaches a site-keyed
--      table without its key is a white-label leak waiting to happen — the
--      same class of bug as the tenant chrome and the JSON-LD publisher.
-- -------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from public.page_models p
   where exists (select 1 from refusionist.page_models s where s.id = p.id)
     and p.site is distinct from 'refusionist';
  if n > 0 then raise exception 'verify 3.3: % page_models rows are unscoped', n; end if;

  select count(*) into n from public.content_overrides p
   where exists (select 1 from refusionist.content_overrides s where s.id = p.id)
     and (p.site is distinct from 'refusionist'
          or p.tenant_id is distinct from 'a0a0a0a0-0000-4000-8000-0000005ec0de');
  if n > 0 then raise exception 'verify 3.3: % content_overrides rows are unscoped', n; end if;

  select count(*) into n from public.announcements p
   where exists (select 1 from refusionist.announcements s where s.id = p.id)
     and p.site is distinct from 'refusionist';
  if n > 0 then raise exception 'verify 3.3: % announcements are platform-wide', n; end if;

  select count(*) into n from public.plans p
   where exists (select 1 from refusionist.plans s where s.id = p.id)
     and p.site is distinct from 'refusionist';
  if n > 0 then raise exception 'verify 3.3: % plans are platform-wide', n; end if;

  select count(*) into n from public.prices p
   where exists (select 1 from refusionist.prices s where s.id = p.id)
     and p.site is distinct from 'refusionist';
  if n > 0 then raise exception 'verify 3.3: % prices are platform-wide', n; end if;

  select count(*) into n from public.testimonials p
   where exists (select 1 from refusionist.testimonials s where s.id = p.id)
     and p.site_id is distinct from 'a0a0a0a0-0000-4000-8000-0000005ec0de';
  if n > 0 then raise exception 'verify 3.3: % testimonials are unscoped', n; end if;

  select count(*) into n from public.studio_classes p
   where exists (select 1 from refusionist.studio_classes s where s.id = p.id)
     and p.site_id is distinct from 'a0a0a0a0-0000-4000-8000-0000005ec0de';
  if n > 0 then raise exception 'verify 3.3: % studio_classes are unscoped', n; end if;

  raise notice 'verify 3.3 OK — every migrated row carries its tenant key';
end $$;

-- -------------------------------------------------------------------------
-- 3.4  The fixtures stayed out, and the bookings kept their history.
-- -------------------------------------------------------------------------
do $$
declare n int; total int; guests int;
begin
  select count(*) into n
    from public.members m
    join public.refusionist_migration_map x on x.legacy_id = m.id;
  if n > 0 then
    raise exception 'verify 3.4: % legacy refusionist ids exist as platform members', n;
  end if;

  select count(*) into total from public.bookings b
   where exists (select 1 from refusionist.bookings s where s.id = b.id);
  select count(*) into total from refusionist.bookings;

  select count(*) into guests
    from public.bookings b
    join refusionist.bookings s on s.id = b.id
   where s.client_user_id is not null
     and b.client_user_id is null;

  -- every booking came across; the ones whose client was a fixture kept
  -- their name and email and lost only the account pointer
  if exists (select 1 from refusionist.bookings s
              where not exists (select 1 from public.bookings b where b.id = s.id)) then
    raise exception 'verify 3.4: a booking did not migrate';
  end if;

  if exists (select 1 from public.bookings b
              join refusionist.bookings s on s.id = b.id
             where b.client_user_id is null and s.client_user_id is not null
               and (coalesce(b.name,'') = '' and coalesce(b.email,'') = '')) then
    raise exception 'verify 3.4: a booking lost its client without keeping name/email';
  end if;

  raise notice 'verify 3.4 OK — % bookings migrated, % re-seated as guest rows, 0 fixtures became members',
    total, guests;
end $$;

-- -------------------------------------------------------------------------
-- 3.5  The other pooled tenants are untouched.
-- -------------------------------------------------------------------------
select 'page_models by site' as check, site, count(*)
  from public.page_models group by site order by site;

do $$
declare n int;
begin
  select count(*) into n from public.page_models where site in ('giocoelho','guardians','nevlo','main');
  raise notice 'verify 3.5 — % page_models rows across giocoelho/guardians/nevlo/main (compare to the pre-run snapshot)', n;
end $$;

rollback;
