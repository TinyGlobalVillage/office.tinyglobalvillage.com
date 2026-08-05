-- 05-funnels.sql — /humandesign, authored as a page row instead of ported.
--
-- Step 5 of the app half, the part 04-pages.sql listed as "NOT AUTHORED HERE —
-- these are applications, not content". Two of those three still are, and are
-- built as real HQ routes gated per site (see the SITE_SURFACES catalog in
-- clients/tinyglobalvillage.com/src/lib/tenants/siteSurfaces.ts):
--   /testimonials                 the open submit form
--   /recipes/paodequeijo/print    the print view over the same recipe
-- This file is the third, and it turned out NOT to be an application at all.
--
-- WHY /humandesign CHANGED CATEGORY. It reads as the biggest funnel on the site:
-- nine marketing sections plus a "Book your first Human Design session" modal
-- with email, calendar and payment steps. The modal is a PLACEHOLDER. Its
-- calendar has no calendar — `BookSessionModal` offers a button labelled
-- "Choose a placeholder time" that sets the start to now + 24h;
-- `BookSessionStepCalendar` (which the modal does not even import — it is dead
-- code, along with `BookSessionStepEmail`) says in as many words "This is the
-- scheduling placeholder step. Next build: Big React Calendar + your
-- availability + Google/iCal sync". From there `/api/stripe/first-session`
-- charges a fixed STRIPE_PRICE_ID_SESSION against a time nobody picked.
--
-- HQ already runs the real thing: /book on @tgv/module-appointments — event type
-- → live availability → hold → Stripe → confirm — which is the SAME engine
-- refusionist's own /schedule page mounts. Gio's ruling 2026-08-04: point the
-- CTA at /book and do not carry the placeholder across. So the nine sections
-- become content like every other page, and every "Book your first session"
-- button on them links to the booker that works. Nothing is lost that worked:
-- what is dropped is a fake calendar and a charge attached to it.
--
-- WHAT THAT RULING MADE UNTRUE, AND SO EDITED. Three strings in the dictionary
-- described the placeholder as a promise. Carrying them verbatim would ship copy
-- that lies about the product in the other direction:
--   offer.card.disclaimer  "Checkout + scheduling will appear in the next build
--                           step (Stripe + calendar + session link)."
--   faq "How do I book?"   "...you'll see a placeholder modal. Payments +
--                           scheduling are next."
--   finalCta.trustNote     "Everything WILL live on refusionist.com..."
-- Each is rewritten below to describe what now actually happens. Everything else
-- is refusionist's own copy from `src/lib/i18n/en.ts` §humandesign, verbatim.
--
-- ONE THING DELIBERATELY NOT CARRIED — the intro VIDEO. `HDIntroVideoSection`
-- renders a box captioned "Intro video placeholder (upload later)"; there is no
-- file. The section is authored as its heading, its body and its three bullets,
-- which is what is real. Gio can drop an rf-embed above it in the studio the day
-- there is a video.
--
-- /book HAD TO BE MADE REACHABLE FOR ANY OF THIS TO BE TRUE, and it was not:
--   • the proxy never allowlisted it, so refusionist.com/book was rewritten into
--     /u/refusionist/book, which is not a page → 404. (04-pages.sql's /fitness
--     row already links there, so that CTA has been dead since it was authored.)
--   • /api/public/event-types resolved the site owner from TGV_SITE_OWNER_MEMBER_ID
--     — ONE env var, and therefore one owner per PROCESS. Correct while every
--     tenant had its own; pooled, it means every tenant's booker offers the same
--     person's time. It now resolves the owner from the HOST via the `villager`
--     ownership join, and fails towards an EMPTY list rather than towards
--     somebody else's calendar.
-- Both fixes are in the HQ commit that accompanies this file.
--
-- RE-RUNNABLE, same null-safe NOT EXISTS guard as 04.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/refusionist-migration/05-funnels.sql
--
-- ORDER. After 04-pages.sql. Independent of 03-verify.sql.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:refusionist-05-funnels', true);

-- 04 must have run: this file is the tenth page of the same site, and if the
-- other nine are missing the assertions below would blame the wrong step.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist' AND mode = 'published' AND user_id IS NULL
     AND slug IN ('about', 'fitness', 'recipes/paodequeijo');
  IF n <> 3 THEN
    RAISE EXCEPTION 'precondition: 04-pages.sql has not run (found % of 3 sentinel pages)', n;
  END IF;
END $$;

CREATE TEMP TABLE _ref_funnels (slug text, title text, in_nav boolean, model jsonb)
  ON COMMIT DROP;

-- ── /humandesign ───────────────────────────────────────────────────────────
INSERT INTO _ref_funnels VALUES (
  'humandesign',
  'Human Design',
  true,
  jsonb_build_object(
    'id', 'pm-humandesign',
    'slug', 'humandesign',
    'title', 'Human Design',
    'chrome', jsonb_build_object(
      'navEnabled', true,
      'footerEnabled', true,
      'meta', jsonb_build_object(
        'title', 'Human Design | Refusionist – Readings & Coaching',
        'description', 'Discover your unique Human Design with The Refusionist. Book readings and coaching sessions to align with your true self and life path.'
      )
    ),
    'sections', jsonb_build_array(

      -- 1 · above the fold
      jsonb_build_object(
        'id', 'sec-hd-hero',
        'type', 'rf-hero',
        'label', 'Above the fold',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', '#03202f',
          'ink', '#eaf6fb',
          'muted', 'rgba(234,246,251,0.7)',
          'accent', '#00e4fd',
          'amber', '#ffb454',
          'bgImageUrl', '',
          'bgAlt', '',
          'eyebrow', 'Human Design',
          'heading', 'Your Inner ',
          'headingAccent', 'Operating System',
          'tagline', 'A grounded, practical introduction—plus a pathway to your first personalized reading.',
          'minHeight', 520,
          'overlay', 0.6,
          'objectPosition', 'center center',
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Book your first session', 'href', '/book/', 'variant', 'primary')
          )
        ))
      ),

      -- 2 · orientation (the video placeholder itself is not carried)
      jsonb_build_object(
        'id', 'sec-hd-orientation',
        'type', 'rf-media-copy',
        'label', 'A 2-minute orientation',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'A 2-minute orientation',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', jsonb_build_array(
            'What your chart is (and what it’s not)',
            'How to use type + strategy in real life',
            'Why authority matters more than advice'
          ),
          'paragraphs', jsonb_build_array(
            'In this short intro, you’ll learn what Human Design is, what a chart reveals, and how a reading can translate insight into daily decisions.',
            'Private, one-on-one sessions hosted directly on refusionist.com. No third-party meeting links required.'
          ),
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Book your first session', 'href', '/book/', 'variant', 'primary')
          )
        ))
      ),

      -- 3 · what it is
      jsonb_build_object(
        'id', 'sec-hd-whatis',
        'type', 'rf-list',
        'label', 'What is Human Design?',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'What is Human Design?',
          'intro', 'Human Design is a synthesis model that turns your birth data into a chart of energetic traits and decision-making mechanics.',
          'notesHeading', '',
          'notes', '[]'::jsonb,
          'items', jsonb_build_array(
            jsonb_build_object('text', 'A map for how you best make decisions (your Authority)'),
            jsonb_build_object('text', 'A strategy for reducing friction and burnout (your Type + Strategy)'),
            jsonb_build_object('text', 'Themes you’re here to master (profiles, channels, and gates)'),
            jsonb_build_object('text', 'A practical framework—useful when applied, not just understood')
          )
        ))
      ),

      -- 4 · how a reading works
      jsonb_build_object(
        'id', 'sec-hd-howitworks',
        'type', 'rf-accordion',
        'label', 'How a reading works',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'How a reading works',
          'lede', 'We keep it simple: clarify your chart, translate it into real choices, and leave with an action plan.',
          'defaultOpen', 0,
          'items', jsonb_build_array(
            jsonb_build_object(
              'name', 'Before',
              'tagline', 'What you send me',
              'body', 'You share your birth data and your top questions (work, relationships, health, creativity).'),
            jsonb_build_object(
              'name', 'During',
              'tagline', 'The session itself',
              'body', 'We walk through your Type, Strategy, Authority, and key themes—then apply them to your real life.'),
            jsonb_build_object(
              'name', 'After',
              'tagline', 'What you leave with',
              'body', 'You receive a recap and next steps so you can practice your design with clarity.')
          )
        ))
      ),

      -- 5 · who it is for
      jsonb_build_object(
        'id', 'sec-hd-whofor',
        'type', 'rf-list',
        'label', 'Who this is for',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'Who this is for',
          'intro', 'If you’re ready to stop forcing and start aligning, a first session will give you immediate traction.',
          'notesHeading', '',
          'notes', '[]'::jsonb,
          'items', jsonb_build_array(
            jsonb_build_object('text', 'Burnout recovery',
              'sub', 'Build a decision process that reduces pressure, overwork, and confusion.'),
            jsonb_build_object('text', 'Career clarity',
              'sub', 'Make choices that fit your mechanics—especially around visibility and energy use.'),
            jsonb_build_object('text', 'Relationships',
              'sub', 'Understand dynamics without blame—and communicate your needs cleanly.'),
            jsonb_build_object('text', 'Creative direction',
              'sub', 'Find your rhythm: when to initiate, wait, respond, or refine.'),
            jsonb_build_object('text', 'Sensitive nervous systems',
              'sub', 'Learn what’s yours vs what you’re absorbing—and how to reset.'),
            jsonb_build_object('text', 'A new chapter',
              'sub', 'Big transitions feel lighter when you know your internal compass.')
          )
        ))
      ),

      -- 6 · about Gio
      jsonb_build_object(
        'id', 'sec-hd-aboutgio',
        'type', 'rf-media-copy',
        'label', 'About Gio',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'About Gio',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'right',
          'chips', jsonb_build_array(
            'Clear, practical explanations (no mysticism required)',
            'Decision-making you can actually practice',
            'A supportive, direct style that respects your sovereignty'
          ),
          'ctas', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'My approach blends Human Design with grounded coaching. We translate insight into practices that change how you live—day by day.',
            'Note: this is guidance and coaching—meant to empower your choices, not replace professional medical or legal advice.'
          )
        ))
      ),

      -- 7 · the offer
      jsonb_build_object(
        'id', 'sec-hd-offer',
        'type', 'rf-list',
        'label', 'Start here',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'Start here',
          'intro', 'Book a first session to get oriented, decode your chart, and leave with a simple alignment plan. A private 1:1 reading hosted on refusionist.com with a clean follow-up plan.',
          'notesHeading', 'First Human Design Session',
          -- Rewritten: the original disclaimer promised checkout and scheduling
          -- as a future build step. They exist now, on /book.
          'notes', jsonb_build_array(
            'Pick a time from my live availability and pay to confirm — booking, payment and your session link all happen on refusionist.com.'
          ),
          'items', jsonb_build_array(
            jsonb_build_object('text', 'Type + Strategy + Authority overview'),
            jsonb_build_object('text', 'Key themes and friction points'),
            jsonb_build_object('text', 'Real-life application to your top 1–2 questions'),
            jsonb_build_object('text', 'Next steps for practice')
          )
        ))
      ),

      -- 8 · the CTA between the offer and the FAQ
      jsonb_build_object(
        'id', 'sec-hd-offer-cta',
        'type', 'rf-linkbar',
        'label', 'Book',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'align', 'center',
          'links', jsonb_build_array(
            jsonb_build_object('label', 'Book your first session', 'href', '/book/')
          )
        ))
      ),

      -- 9 · FAQ
      jsonb_build_object(
        'id', 'sec-hd-faq',
        'type', 'rf-accordion',
        'label', 'FAQ',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'FAQ',
          'lede', '',
          'defaultOpen', -1,
          'items', jsonb_build_array(
            jsonb_build_object('name', 'Do I need my exact birth time?',
              'body', 'Exact time is ideal. If you’re unsure, we can still do a helpful orientation and discuss options for refining accuracy later.'),
            jsonb_build_object('name', 'Is this a religion or belief system?',
              'body', 'No. You can treat it as a reflective framework—use what’s useful, ignore what isn’t.'),
            jsonb_build_object('name', 'What will I get out of the first session?',
              'body', 'Clarity on your decision mechanics and a practical way to apply your design to a real-life focus area.'),
            jsonb_build_object('name', 'Do you record sessions?',
              'body', 'We can add replay access once the video stack is enabled. For now, you’ll get a structured recap.'),
            jsonb_build_object('name', 'Can I bring relationship or career questions?',
              'body', 'Yes—those are the most common. Bring your current situation and what choice you’re facing.'),
            -- Rewritten: the original answer described the placeholder modal.
            jsonb_build_object('name', 'How do I book?',
              'body', 'Press “Book your first session”. You’ll choose a time from my live availability, pay to confirm, and get your session link straight away.')
          )
        ))
      ),

      -- 10 · final CTA
      jsonb_build_object(
        'id', 'sec-hd-finalcta',
        'type', 'rf-media-copy',
        'label', 'Ready to align?',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Ready to align?',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'Book your first session and start practicing your design with clarity and confidence.',
            -- Rewritten: "Everything WILL live on refusionist.com" — it does.
            'Everything lives on refusionist.com: booking, payment and your session link.'
          ),
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Book your first session', 'href', '/book/', 'variant', 'primary')
          )
        ))
      )
    )
  )
);

WITH ins AS (
  INSERT INTO public.page_models
    (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
  SELECT r.slug, 'en', 'published', NULL, NULL, r.title, true, r.in_nav, r.model, now(), 'refusionist'
    FROM _ref_funnels r
   WHERE NOT EXISTS (
     SELECT 1 FROM public.page_models p
      WHERE p.site = 'refusionist'
        AND p.slug = r.slug
        AND p.lang = 'en'
        AND p.mode = 'published'
        AND p.user_id IS NOT DISTINCT FROM NULL
   )
  RETURNING 1
)
SELECT 'funnel pages authored: ' || count(*) FROM ins;

-- ── assertions ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist' AND slug = 'humandesign' AND lang = 'en'
     AND mode = 'published' AND user_id IS NULL AND deleted_at IS NULL AND is_public;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected exactly 1 readable humandesign row, found %', n;
  END IF;

  -- Same catalog check as 04: an unrenderable type is invisible here and blank
  -- in a browser.
  SELECT count(*) INTO n
    FROM public.page_models p,
         LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'refusionist' AND p.mode = 'published' AND p.slug = 'humandesign'
     AND s->>'type' NOT IN (
       'rf-hero', 'rf-media-copy', 'rf-list', 'rf-steps', 'rf-accordion',
       'rf-embed', 'rf-linkbar', 'rf-schedule', 'rf-hotspots', 'story-timeline'
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % humandesign section(s) name an unexpected type', n;
  END IF;

  -- Every CTA on this page must reach the booker that works. A stray
  -- /humandesign?book=1 or /schedule/ would be the placeholder coming back in.
  SELECT count(*) INTO n
    FROM public.page_models p,
         LATERAL jsonb_array_elements(p.model_json->'sections') s,
         LATERAL jsonb_array_elements(
           coalesce(s->'config'->'props'->'ctas', '[]'::jsonb)
           || coalesce(s->'config'->'props'->'links', '[]'::jsonb)
         ) c
   WHERE p.site = 'refusionist' AND p.mode = 'published' AND p.slug = 'humandesign'
     AND c->>'href' <> '/book/';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % humandesign CTA(s) point somewhere other than /book/', n;
  END IF;

  -- The three rewritten strings must not have crept back in.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist' AND slug = 'humandesign'
     AND (model_json::text ILIKE '%placeholder%'
       OR model_json::text ILIKE '%next build step%');
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: humandesign still describes the placeholder booking flow';
  END IF;

  -- Same app-relative asset trap as 04.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist' AND slug = 'humandesign'
     AND model_json::text ~ '"/images/(hero|logo|backgrounds|recipes|icons|ui|fitness)/';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: humandesign carries an app-relative asset path';
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT slug, title, is_public, in_nav,
       jsonb_array_length(model_json->'sections') AS sections
  FROM public.page_models
 WHERE site = 'refusionist' AND mode = 'published' AND user_id IS NULL
 ORDER BY slug;

COMMIT;
