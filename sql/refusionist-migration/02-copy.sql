-- =========================================================================
-- Refusionist migration — step 2: copy the rows into `public`.
--
-- Runs after 00-preflight.sql and 01-id-map.sql, in ONE transaction.
-- Re-runnable: every insert is ON CONFLICT DO NOTHING, so a second run adds
-- nothing. Copies FROM refusionist.* — the source is never modified, which
-- is what makes rollback `pm2 start` and a DNS line rather than a restore.
--
-- Shape of the thing, surveyed 2026-08-04:
--   * 41 of the 48 populated refusionist tables already have a public twin.
--   * 32 of those 41 are column-for-column identical. The nine that differ
--     differ because public is a SUPERSET (site / site_id / tenant_id / env
--     — the multi-tenant additions).
--   * Exactly one type mismatch exists in the whole schema:
--     connected_accounts.id is uuid in refusionist and integer in public.
--     That table is not copied (see 2.9).
--   * Every shared enum has identical labels on both sides, so a cross-schema
--     copy only ever needs ::text::public.<enum>.
-- =========================================================================

\set ON_ERROR_STOP on

begin;

-- -------------------------------------------------------------------------
-- 2.1  The copier.
--
-- Column list is the INTERSECTION of the two tables, discovered at run time
-- rather than pasted in, so a column added to either side since this was
-- written cannot silently drop rows or fail the run.
--
--   p_owner_cols      member columns rewritten through the map. A row whose
--                     owner is a skip is not copied. NULL owners pass.
--   p_null_if_skipped member columns rewritten where mapped and NULLED where
--                     skipped, keeping the row. Used for bookings.
--   p_set_cols/vals   columns forced to a literal — the tenant keys.
-- -------------------------------------------------------------------------
create or replace function pg_temp.ref_copy(
  p_table           text,
  p_owner_cols      text[] default '{}',
  p_null_if_skipped text[] default '{}',
  p_set_cols        text[] default '{}',
  p_set_vals        text[] default '{}'
) returns integer language plpgsql as $fn$
declare
  cols        text[] := '{}';
  sel         text[] := '{}';
  wheres      text[] := '{}';
  c           record;
  idx         int;
  expr        text;
  forced      text;
  n           int;
begin
  if coalesce(array_length(p_set_cols,1),0) <> coalesce(array_length(p_set_vals,1),0) then
    raise exception 'ref_copy: % forced columns but % values for %',
      coalesce(array_length(p_set_cols,1),0), coalesce(array_length(p_set_vals,1),0), p_table;
  end if;
  if to_regclass('refusionist.'||quote_ident(p_table)) is null then
    raise exception 'ref_copy: refusionist.% does not exist', p_table;
  end if;
  if to_regclass('public.'||quote_ident(p_table)) is null then
    raise exception 'ref_copy: public.% does not exist', p_table;
  end if;

  -- A forced tenant key usually does NOT exist on the source side — `site`,
  -- `site_id` and `tenant_id` are exactly the columns public added and the
  -- tenant schemas never had. So the driving list is the intersection PLUS
  -- any forced column, not the intersection alone.
  --
  -- Getting this wrong is silent and expensive: public.page_models.site
  -- DEFAULTS to 'demo', so a page inserted without its key does not land
  -- unscoped, it lands as somebody else's demo content.
  for c in
    select p.column_name,
           p.udt_schema, p.udt_name,
           (t.typtype = 'e') as is_enum
      from information_schema.columns p
      left join information_schema.columns r
        on r.table_schema='refusionist' and r.table_name=p.table_name
       and r.column_name=p.column_name
      join pg_type t on t.typname = p.udt_name
      join pg_namespace tn on tn.oid = t.typnamespace and tn.nspname = p.udt_schema
     where p.table_schema='public' and p.table_name=p_table
       and (r.column_name is not null or p.column_name = any (p_set_cols))
     order by p.ordinal_position
  loop
    cols := cols || quote_ident(c.column_name);

    idx := array_position(p_set_cols, c.column_name);
    if idx is not null then
      -- forced tenant key
      expr := quote_literal(p_set_vals[idx]) || '::' || quote_ident(c.udt_schema) || '.' || quote_ident(c.udt_name);

    elsif c.column_name = any (p_owner_cols) then
      -- ::text on both sides: a couple of legacy tables hold the member id as
      -- text rather than uuid, and the map must still reach them.
      expr := format(
        '(select m.new_id::text from public.refusionist_migration_map m '
        ' where m.legacy_id::text = s.%I::text and m.disposition = ''merge'')::%I.%I',
        c.column_name, c.udt_schema, c.udt_name);
      wheres := wheres || format(
        '(s.%I is null or exists (select 1 from public.refusionist_migration_map m '
        '  where m.legacy_id::text = s.%I::text and m.disposition = ''merge''))',
        c.column_name, c.column_name);

    elsif c.column_name = any (p_null_if_skipped) then
      expr := format(
        '(select m.new_id::text from public.refusionist_migration_map m '
        ' where m.legacy_id::text = s.%I::text and m.disposition = ''merge'')::%I.%I',
        c.column_name, c.udt_schema, c.udt_name);

    elsif c.is_enum then
      expr := format('s.%I::text::%I.%I', c.column_name, c.udt_schema, c.udt_name);

    else
      expr := format('s.%I', c.column_name);
    end if;

    sel := sel || expr;
  end loop;

  if array_length(cols, 1) is null then
    raise exception 'ref_copy: no shared columns for %', p_table;
  end if;

  -- a forced key that never made it into the column list would leave the rows
  -- on the target's DEFAULT, which is the failure mode described above
  foreach forced in array p_set_cols loop
    if not (quote_ident(forced) = any (cols)) then
      raise exception 'ref_copy: forced column %.% is not a column of public.%',
        p_table, forced, p_table;
    end if;
  end loop;

  execute format(
    'insert into public.%I (%s) select %s from refusionist.%I s %s on conflict do nothing',
    p_table,
    array_to_string(cols, ', '),
    array_to_string(sel, ', '),
    p_table,
    case when array_length(wheres,1) is null then ''
         else 'where ' || array_to_string(wheres, ' and ') end);

  get diagnostics n = row_count;
  raise notice 'copied % -> public.% (% source rows)', n, p_table,
    (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from refusionist.%I', p_table), false, true, '')))[1]::text::bigint;
  return n;
end
$fn$;

-- The tenant keys, once.
--   site      the text key the pooled renderer reads ('giocoelho', 'nevlo'...)
--   site_id   villager_sites.id for refusionist
\set site        '''refusionist'''
\set site_id     '''a0a0a0a0-0000-4000-8000-0000005ec0de'''

-- -------------------------------------------------------------------------
-- 2.2  Identity. Nothing is inserted into public.members — the whole point
--      of the map is that these people are already there.
-- -------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from public.refusionist_migration_map where disposition='merge';
  raise notice '2.2 identity: % legacy members merge onto existing platform rows; 0 inserted', n;
end $$;

-- -------------------------------------------------------------------------
-- 2.3  Scheduling — availability, event types, bookings.
--      Order matters: schedules before the rules that hang off them.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('availability_schedules',            array['owner_user_id']);
select pg_temp.ref_copy('availability_weekly_rules');
select pg_temp.ref_copy('availability_weekly_ranges');
select pg_temp.ref_copy('availability_date_overrides');
select pg_temp.ref_copy('availability_date_override_ranges');
select pg_temp.ref_copy('availability_schedule_event_types');
select pg_temp.ref_copy('event_types',                       array['owner_user_id']);

-- bookings: host is Gio on 27 of 33 and null on the rest, so it maps
-- strictly. client_user_id is where the 11 fixtures live — those rows keep
-- their name and email and lose only the account pointer.
select pg_temp.ref_copy('bookings', array['host_user_id'], array['client_user_id']);
select pg_temp.ref_copy('booking_requests', array['from_user_id','to_user_id']);
select pg_temp.ref_copy('booking_reminder_jobs', array['user_id']);
select pg_temp.ref_copy('calendar_integrations',          array['user_id']);
select pg_temp.ref_copy('calendar_notification_settings', array['user_id']);

-- -------------------------------------------------------------------------
-- 2.4  Content — pages, chrome, posts, testimonials.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('page_models', array['user_id'], '{}', array['site'], array['refusionist']);
select pg_temp.ref_copy('content_overrides', array['user_id'], '{}',
                        array['site','tenant_id'],
                        array['refusionist','a0a0a0a0-0000-4000-8000-0000005ec0de']);

select pg_temp.ref_copy('categories');
select pg_temp.ref_copy('tags');
select pg_temp.ref_copy('collections', array['created_by']);
select pg_temp.ref_copy('posts',       array['author_id']);
select pg_temp.ref_copy('collection_posts');
select pg_temp.ref_copy('collection_tags');
select pg_temp.ref_copy('post_tags');
select pg_temp.ref_copy('post_layouts');

select pg_temp.ref_copy('testimonials', '{}', '{}', array['site_id'],
                        array['a0a0a0a0-0000-4000-8000-0000005ec0de']);

-- -------------------------------------------------------------------------
-- 2.5  Announcements — refusionist's own product changelog, scoped so it
--      does not surface on guardianstuffies.com.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('announcements', array['created_by'], '{}',
                        array['site'], array['refusionist']);
select pg_temp.ref_copy('announcement_user_states', array['user_id']);

-- -------------------------------------------------------------------------
-- 2.6  Commerce. plans/prices/promo_codes are scoped the same way — a plan
--      minted for refusionist must not become a platform plan.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('plans',       '{}', '{}', array['site'], array['refusionist']);
select pg_temp.ref_copy('prices',      '{}', '{}', array['site'], array['refusionist']);
select pg_temp.ref_copy('promo_codes', '{}', '{}', array['site'], array['refusionist']);
select pg_temp.ref_copy('plans_tags');
select pg_temp.ref_copy('subscriptions',  array['user_id']);
select pg_temp.ref_copy('subscribers',    array['user_id']);
select pg_temp.ref_copy('transactions',   array['user_id']);
select pg_temp.ref_copy('token_ledger',   array['user_id']);
select pg_temp.ref_copy('payment_methods',array['user_id']);
select pg_temp.ref_copy('store_profiles', array['user_id']);
select pg_temp.ref_copy('referral_codes', array['owner_user_id']);
select pg_temp.ref_copy('referrals',      array['referrer_user_id','referred_user_id']);

-- -------------------------------------------------------------------------
-- 2.7  Meetings and session state (LiveKit).
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('meetings');
select pg_temp.ref_copy('meeting_participants');
select pg_temp.ref_copy('meeting_recordings');
select pg_temp.ref_copy('session_state');

-- -------------------------------------------------------------------------
-- 2.8  Studio. site_id already carries refusionist's villager_sites id in
--      every source row; it is forced anyway so the copy cannot inherit a
--      stale key. Parents before children.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('studio_service_categories', '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('studio_session_types',      '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('studio_class_descriptions', '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('studio_class_schedules',    '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('studio_classes',            array['staff_user_id'], '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);

-- -------------------------------------------------------------------------
-- 2.9  Cospro (plan 44). cosmic_profiles first — user_cosmic_profiles
--      references it.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('cosmic_profiles',      array['linked_user_id']);
select pg_temp.ref_copy('user_cosmic_profiles', array['owner_user_id']);
select pg_temp.ref_copy('member_orakle_prefs',  array['member_id']);

-- -------------------------------------------------------------------------
-- 2.10 Analytics (plan 46 — promoted to canon). Dashboards before cards.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('analytics_dashboards',      '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_dashboard_cards', '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_saved_reports',   array['owner_user_id'], '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_audit',           array['actor_user_id'], '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_events',          '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_metric_points',   '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);
select pg_temp.ref_copy('analytics_snapshots',       '{}', '{}', array['site_id'], array['a0a0a0a0-0000-4000-8000-0000005ec0de']);

-- -------------------------------------------------------------------------
-- 2.11 Dashboard + misc member surfaces.
-- -------------------------------------------------------------------------
select pg_temp.ref_copy('dashboard_features', array['user_id']);
select pg_temp.ref_copy('orakle_usage',       array['user_id']);
select pg_temp.ref_copy('resume_items',       array['user_id']);
select pg_temp.ref_copy('comments',           array['user_id']);
select pg_temp.ref_copy('likes',              array['user_id']);
select pg_temp.ref_copy('follows',            array['user_id']);
select pg_temp.ref_copy('platform_admins');
select pg_temp.ref_copy('support_settings');
select pg_temp.ref_copy('storage_quotas',     array['user_id']);
select pg_temp.ref_copy('shared_templates');
select pg_temp.ref_copy('newsletter_broadcasts');
select pg_temp.ref_copy('blog_posts');

-- -------------------------------------------------------------------------
-- 2.12 platform_config — singleton on both sides, both keyed id = 1, so the
--      ROW cannot merge. Only the column public lacks comes across, onto the
--      row that is already there.
-- -------------------------------------------------------------------------
update public.platform_config p
   set view_settings_visibility = r.view_settings_visibility
  from refusionist.platform_config r
 where p.id = r.id
   and p.view_settings_visibility is distinct from r.view_settings_visibility;

-- -------------------------------------------------------------------------
-- 2.13 Deliberately NOT copied. Each one is a decision, not an omission.
--
--   members                     merged through the map; see 2.2.
--   member_sessions             plan 43 — the cookie and Keycloak client
--                               change with the pooling, so every session is
--                               invalidated on purpose. Carrying 6 stale
--                               refusionist_member_session rows across would
--                               only make the cutover ambiguous.
--   auth_verification_tokens    ephemeral; same reasoning.
--   connected_accounts          uuid id in refusionist, integer id in public
--                               — the only type mismatch in the schema. And
--                               public already holds a live Connect account
--                               for refusionist's site_id (a different, newer
--                               Stripe account), so a copy would give the
--                               site two.
--   connect_charges             hangs off connected_accounts. Three rows, and
--                               two of them are webhook deliveries for OTHER
--                               sites' accounts — refusionist's app has been
--                               logging the fleet's Connect events into its
--                               own schema. Worth fixing; not by copying.
--   zz_*_preunify (52 tables)   plan 29 archive. Dump and drop separately.
--
-- Every other refusionist table not named in this file is empty (0 rows).
-- -------------------------------------------------------------------------

commit;
