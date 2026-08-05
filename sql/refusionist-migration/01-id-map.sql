-- =========================================================================
-- Refusionist migration — step 1: the identity map.
--
-- Plan 42 feared an id collision: "Refusionist's members.id reuses its legacy
-- users.id, so merging into public.members can collide with ids already
-- there." The reuse is real; the collision is not. Every id in the
-- refusionist schema is absent from public.members. What overlaps is the
-- PERSON, by email — which is a merge, not a rename.
--
-- The ground truth, surveyed 2026-08-04:
--   refusionist_db.public.users        15 rows  (the legacy store)
--   refusionist.members                 2 rows  (the two that were migrated)
--   public.members                     12 rows
--
-- Of the 15 legacy users, 11 are fixtures (demo@example.com x4,
-- active/member/non@example.com, and four @demo.refusionist.com personas
-- generated for chart testing). They own 66 dashboard_features rows and 12
-- of the 33 bookings, and nothing else.
--
-- Rulings taken 2026-08-04:
--   * Gio's two rows merge into the platform identity. One Gio, one login.
--   * The 11 fixtures are left behind. Their bookings still migrate — the
--     rows carry name and email already — with client_user_id nulled, so the
--     booking history survives without inventing 11 platform accounts.
--
-- Re-runnable. Nothing here reads or writes tenant data.
-- =========================================================================

\set ON_ERROR_STOP on

begin;

create table if not exists public.refusionist_migration_map (
    legacy_id   uuid primary key,
    new_id      uuid,
    disposition text not null check (disposition in ('merge','skip')),
    label       text,
    note        text,
    created_at  timestamptz not null default now()
);

comment on table public.refusionist_migration_map is
  'Old refusionist member id -> platform member id. Written by the '
  'Refusionist migration (plan 42); kept afterwards as the rollback key. '
  'disposition=skip means the legacy user does not become a platform member.';

-- -------------------------------------------------------------------------
-- 1.1  The three merges. Hand-written, because each one is a judgment about
--      a person rather than a fact about a row.
-- -------------------------------------------------------------------------
insert into public.refusionist_migration_map (legacy_id, new_id, disposition, label, note) values
  ('a8663be3-5671-48d4-971f-8603f2634973',
   'a0a0a0a0-0000-4000-8000-000000000001',
   'merge',
   'Gio (refusionist admin)',
   'refusionist.members row for connect@refusionist.com, admin. The platform '
   'already carries the same person as username "refusionist". Owns 27 of the '
   '33 bookings, 3 pages, 7 cosmic profiles and every announcement.'),

  ('742ca302-944e-4fc9-a274-97461fd7f8a4',
   '45ab139a-dc88-46fe-9fbb-e856aa94cfce',
   'merge',
   'Marthe Traetli',
   'Same email on both sides — refusionist.members editor and public.members '
   'username "marmar". The one true duplicate identity.'),

  ('1ebc4046-ecc9-41b2-942b-8416ad7d63d6',
   'cee73a09-94ec-4b64-9abc-122c118f5758',
   'merge',
   'Sergio Coelho',
   'Legacy refusionist user (connect@giocoelho.com) who never got a member '
   'row, but is already a platform member. Six bookings ride on this mapping.')
on conflict (legacy_id) do update
  set new_id      = excluded.new_id,
      disposition = excluded.disposition,
      label       = excluded.label,
      note        = excluded.note;

-- -------------------------------------------------------------------------
-- 1.2  Everything else the schema actually references becomes an explicit
--      skip. Discovered rather than listed: every uuid column in the
--      refusionist schema whose name looks like an owner is scanned, so an
--      id nobody remembered cannot slip through as an unnoticed orphan.
-- -------------------------------------------------------------------------
do $$
declare
  r record;
  found integer := 0;
begin
  for r in
    select c.relname as tbl, a.attname as col
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      join pg_type t on t.oid = a.atttypid
     where n.nspname = 'refusionist'
       and c.relkind = 'r'
       and c.relname not like 'zz\_%'
       and t.typname = 'uuid'
       and (a.attname in ('user_id','owner_user_id','client_user_id','host_user_id',
                          'created_by','updated_by','author_id','linked_user_id',
                          'from_user_id','to_user_id','actor_user_id','staff_user_id',
                          'member_id')
            or (c.relname = 'members' and a.attname = 'id'))
  loop
    execute format(
      'insert into public.refusionist_migration_map (legacy_id, disposition, label, note)
         select distinct s.%I, ''skip'', null, ''seen in refusionist.%I.%I''
           from refusionist.%I s
          where s.%I is not null
         on conflict (legacy_id) do nothing',
      r.col, r.tbl, r.col, r.tbl, r.col);
    get diagnostics found = row_count;
    if found > 0 then
      raise notice 'id-map: +% from refusionist.%.%', found, r.tbl, r.col;
    end if;
  end loop;
end $$;

-- -------------------------------------------------------------------------
-- 1.3  Label the skips we know by name, so the map reads as people rather
--      than uuids when someone opens it a year from now.
-- -------------------------------------------------------------------------
update public.refusionist_migration_map m
   set label = v.label,
       note  = coalesce(v.note, m.note)
  from (values
    ('f454e4f9-f6c1-4d82-88db-bc510d92ed41'::uuid, 'Demo Member',      'fixture (demo@example.com)'),
    ('773a96cb-c5d3-4c3d-9970-e8246002bd3e'::uuid, 'Demo Friend',      'fixture (demo@example.com)'),
    ('6c38f965-0dab-4414-a9aa-1249dd8e2cfe'::uuid, 'Demo Patron',      'fixture (demo@example.com)'),
    ('c374cf38-e5c9-4cdd-98cf-aacf1d8ab40b'::uuid, 'Demo Publisher',   'fixture (demo@example.com)'),
    ('f3b680b2-ea9d-40d2-8184-4dcb22b811ba'::uuid, 'Active Member',    'fixture (active@example.com)'),
    ('44de8339-2ed3-45ce-a629-97ca11d69bd6'::uuid, 'Regular Member',   'fixture (member@example.com)'),
    ('ddb24ad8-3ef9-4d66-818f-b0b40ecc90c4'::uuid, 'Blocked User',     'fixture'),
    ('6e3d386b-a17d-46d8-a7b5-5522b242ac41'::uuid, 'Nina Dragon1988',  'fixture (@demo.refusionist.com chart persona)'),
    ('2ecc6777-8f50-433c-b41d-d58c558ca606'::uuid, 'Ava Pig2019',      'fixture (@demo.refusionist.com chart persona)'),
    ('ac7f0641-2059-4f81-b610-f7527d723b90'::uuid, 'Leo Ox1985',       'fixture (@demo.refusionist.com chart persona)'),
    ('9aa6f113-c64c-45bc-8489-32ec02c542b0'::uuid, 'Mia Rabbit2023',   'fixture (@demo.refusionist.com chart persona)'),
    ('1e5358de-3faf-414d-975b-b83f970bb1c6'::uuid, 'Roy Busch',
       'Real person, not a fixture — but a legacy refusionist_db user who never '
       'became a member and owns nothing except six dashboard_features UI prefs. '
       'Nothing of his is lost by skipping him; if he ever signs in to the '
       'platform he arrives as a new member.')
  ) as v(legacy_id, label, note)
 where m.legacy_id = v.legacy_id
   and m.disposition = 'skip';

-- -------------------------------------------------------------------------
-- 1.4  Assertions.
-- -------------------------------------------------------------------------
do $$
declare
  n_merge int; n_skip int; bad text;
begin
  select count(*) filter (where disposition='merge'),
         count(*) filter (where disposition='skip')
    into n_merge, n_skip
    from public.refusionist_migration_map;

  if n_merge <> 3 then
    raise exception 'id-map: expected 3 merges, found %', n_merge;
  end if;

  -- every merge target must exist in public.members
  select string_agg(legacy_id::text, ', ')
    into bad
    from public.refusionist_migration_map m
   where m.disposition = 'merge'
     and not exists (select 1 from public.members p where p.id = m.new_id);
  if bad is not null then
    raise exception 'id-map: merge target missing from public.members for %', bad;
  end if;

  -- no merge may land on an id that is itself a legacy id (no chains)
  select string_agg(legacy_id::text, ', ')
    into bad
    from public.refusionist_migration_map m
   where m.disposition = 'merge'
     and exists (select 1 from public.refusionist_migration_map x where x.legacy_id = m.new_id);
  if bad is not null then
    raise exception 'id-map: chained mapping for %', bad;
  end if;

  -- a skip must never carry a target
  if exists (select 1 from public.refusionist_migration_map
              where disposition='skip' and new_id is not null) then
    raise exception 'id-map: a skip row carries a new_id';
  end if;

  raise notice 'id-map OK — % merges, % skips', n_merge, n_skip;
end $$;

commit;

-- The map, for the record:
--   select disposition, legacy_id, new_id, label from public.refusionist_migration_map
--    order by disposition desc, label nulls last;
