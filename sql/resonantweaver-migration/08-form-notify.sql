-- 08-form-notify.sql — her forms mail her own domain, not her TGV account.
--
-- Gio's ruling, 2026-08-11: "RW forms should be sent to connect@rw, period."
--
-- WHY THERE WAS A QUESTION AT ALL. Her standalone app SMTP'd every contact
-- submission to `connect@resonantweaver.com` (its `TO_EMAIL`), the inbox on her
-- own domain that her clients write to. Pooled, `submitResponse` looks up the
-- form OWNER's member row and mails that — `marthe@tinyglobalvillage.com`.
-- Nothing was lost (the response is stored and her in-app inbox is notified
-- too), and it all arrived somewhere else, which for a business inbox is the
-- same as losing it.
--
-- `FormNotify` gained a `to` field for exactly this (see its own comment in
-- `@tgv/module-forms/forms/types/api.ts`): the destination is a property of the
-- FORM, not of whoever owns the row. Absent it still falls back to the owner's
-- account address, so every other form on the fleet is unchanged.
--
-- RE-RUNNABLE. It merges into whatever `notify` already holds rather than
-- replacing it, so a later `email:false` or `inbox:false` set in the studio
-- survives a re-drive.
--
--   psql "$DATABASE_URL" -f 08-form-notify.sql

BEGIN;

UPDATE public.forms f
   SET notify = coalesce(f.notify, '{}'::jsonb)
                || jsonb_build_object('to', 'connect@resonantweaver.com'),
       updated_at = now()
  FROM public.villager_sites v
 WHERE v.id = f.site_id
   AND v.domain = 'resonantweaver.com'
   AND f.status <> 'archived'
   AND coalesce(f.notify->>'to', '') <> 'connect@resonantweaver.com';

DO $$
DECLARE
  n_total int;
  n_wired int;
BEGIN
  SELECT count(*),
         count(*) FILTER (WHERE f.notify->>'to' = 'connect@resonantweaver.com')
    INTO n_total, n_wired
    FROM public.forms f
    JOIN public.villager_sites v ON v.id = f.site_id
   WHERE v.domain = 'resonantweaver.com'
     AND f.status <> 'archived';

  IF n_total = 0 THEN
    RAISE EXCEPTION 'assert: resonantweaver has no live forms — wrong database?';
  END IF;
  IF n_wired <> n_total THEN
    RAISE EXCEPTION 'assert: % of % live forms carry the address', n_wired, n_total;
  END IF;
  RAISE NOTICE 'ok: all % live resonantweaver forms mail connect@resonantweaver.com', n_wired;
END $$;

-- Nobody else moved: a `to` anywhere outside her site would be this file
-- reaching further than it says it does.
DO $$
DECLARE stray int;
BEGIN
  SELECT count(*) INTO stray
    FROM public.forms f
    LEFT JOIN public.villager_sites v ON v.id = f.site_id
   WHERE coalesce(f.notify->>'to', '') = 'connect@resonantweaver.com'
     AND coalesce(v.domain, '') <> 'resonantweaver.com';
  IF stray > 0 THEN
    RAISE EXCEPTION 'assert: % forms outside resonantweaver.com carry her address', stray;
  END IF;
END $$;

COMMIT;
