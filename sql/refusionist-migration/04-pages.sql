-- 04-pages.sql — refusionist's content pages, authored as page_models rows.
--
-- Step 5 of the app half (APP-SURVEY.md §"The 39 page routes", category B).
-- 02-copy.sql carries the FOUR rows refusionist already had (`home` published,
-- plus two throwaway drafts). Everything else on refusionist.com is a React
-- route, so pooling without this file would simply delete those URLs.
--
-- WHY THIS IS AUTHORING AND NOT A PORT. The pages mount components from
-- `@tgv/module-core/module-marketing` — a SHARED package HQ already declares as
-- a dependency but mounts nothing from. Adding page routes to HQ that mount it
-- would put refusionist's About page on guardianstuffies.com, which is the
-- white-label leak class already logged twice (tenant chrome, tenant JSON-LD).
-- A `page_models` row cannot leak: `site` IS the scope, the tenant-host proxy
-- reads rows for that site only, and Gio can edit the result in the studio
-- instead of in a repo. Same move as giocoelho (`sql/pool-giocoelho-pages.sql`).
--
-- WHAT THE SURVEY FOUND WHILE AUTHORING THIS. giocoelho.com's pooled pages were
-- authored FROM THIS SAME PACKAGE — `about`, `fitness`, `gallery`, `hemp`,
-- `resume`, `recipes/paodequeijo` and `humandesign` all exist as giocoelho rows
-- already, rebranded from "The Refusionist" to "Gio Coelho". One person, one
-- body of content, two front doors. So three of these rows are DERIVED from the
-- giocoelho row in SQL (below) rather than retyped: the recipe and the resume
-- timeline are the same recipe and the same timeline, and a copy-paste of 400
-- lines of JSON would be two things to keep in step forever. Where refusionist
-- has its OWN copy — its i18n dictionary, `src/lib/i18n/en.ts` — that copy wins.
--
-- ASSETS. `/images/*` in the package resolved against refusionist's own app.
-- Twelve files were copied to HQ's tenant home
-- `public/images/tenants/refusionist/` (28 MB → 3.3 MB after resizing a 3.5 MB
-- hero and a 1.2 MB nav logo that renders at ~40px). Same trap and same fix as
-- giocoelho's broken-image sweep; the assertions below refuse an app-relative
-- src.
--
-- ONE JUDGMENT CALL, FLAGGED NOT HIDDEN — /fitness. refusionist's live page is a
-- SCAFFOLD: `ButiHistory` reads "I found Buti through _____ ... I trained with
-- _____ and now teach _____", `YogaHistory` the same, and both render a literal
-- "IMAGE PLACEHOLDER" box. giocoelho's authored `/fitness` is the FINISHED form
-- of that exact page. Carrying the blanks across would publish fill-in-the-blank
-- text onto the new platform; carrying giocoelho's version would move a real
-- weekly teaching schedule onto a second domain, which is a content decision and
-- not a migration step. So this authors the parts that ARE finished — the hero
-- narrative (2006 meditation → 2009 yoga → 2022 Buti, teaching at Healthsport
-- and Movewell), the three offerings and the CTA — and drops the two blank
-- sections. Gio can pull giocoelho's finished Buti/Yoga copy across in the
-- studio in a click if he wants it.
--
-- REFUSION MARKETING IS A SECOND HOST. `/legal/privacy`, `/legal/terms` and
-- `/refusionmarketing` belong to Refusion Marketing Agency (they link to each
-- other and name a separate address and phone). Gio's ruling 2026-08-04 was
-- "author it as a page row and 301 the host", so all three land here as rows
-- under refusionist and `refusionmarketing.refusionist.com` redirects to
-- `refusionist.com/refusionmarketing/` at cutover.
--
-- NOT AUTHORED HERE — these are applications, not content, and are listed in
-- APP-SURVEY.md as real HQ routes gated per tenant:
--   /humandesign/          17 files incl. BookSessionModal (calendar + email)
--   /testimonials/         an open submit form
--   /recipes/paodequeijo/print/   a print-stylesheet app over the same recipe
--   /portal/birth-data/    cospro; moves with the tables at plan 44
--   /schedule/             308s to HQ's /book/ (same @tgv/module-appointments)
--
-- RE-RUNNABLE. Guarded by an explicit null-safe NOT EXISTS on the same tuple
-- page_models_slug_lang_mode_user_site_uq names — the index cannot do this job
-- because published rows carry user_id NULL and NULL is distinct from NULL.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/refusionist-migration/04-pages.sql
--
-- ORDER. Runs AFTER 02-copy.sql (which creates the site key and carries `home`).
-- Independent of 03-verify.sql, which is read-only.

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:refusionist-04-pages', true);

-- The giocoelho rows this file derives from must be present, or the derivation
-- below silently authors nothing and the assertions blame the wrong thing.
DO $$
DECLARE
  n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'giocoelho' AND mode = 'published' AND user_id IS NULL
     AND slug IN ('recipes/paodequeijo', 'resume');
  IF n <> 2 THEN
    RAISE EXCEPTION
      'precondition: expected giocoelho''s recipe + resume rows to derive from, found %', n;
  END IF;
END $$;

CREATE TEMP TABLE _ref_pages (slug text, title text, in_nav boolean, model jsonb)
  ON COMMIT DROP;

-- ── /about ─────────────────────────────────────────────────────────────────
-- Copy verbatim from refusionist's own dictionary (en.ts §about.aboutAboveFold),
-- which is the "The Refusionist is Gio" phrasing giocoelho's row rebranded away
-- from. The map is the same Steinkjer studio as giocoelho's — one address.
INSERT INTO _ref_pages VALUES (
  'about',
  'About',
  true,
  jsonb_build_object(
    'id', 'pm-about',
    'slug', 'about',
    'title', 'About',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-about-intro',
        'type', 'rf-media-copy',
        'label', 'About',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'About',
          'headingLevel', 1,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'The Refusionist is Gio — artist, healer, teacher, and builder. I fuse Human Design, software engineering, and fashion into a single practice. My work aims for coherence: technology that feels alive, aesthetics that serve function, and decisions guided by regenerative ethics.',
            'Whether you’re birthing a new product, aligning a brand, or seeking personal clarity, I help you translate essence into form. Coaching, creative direction, and engineering happen together here — so what we make is beautiful, useful, and true. Want to explore a collaboration or a reading? Reach out.'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-about-map',
        'type', 'rf-embed',
        'label', 'Location map',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'src', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1079.972574785239!2d11.494793172312473!3d64.01700618980672!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x46729b2443ff205f%3A0xed7b859454fde5df!2sKongens%20Gate%2022%2C%207715%20Steinkjer%2C%20Norway!5e1!3m2!1sen!2sse!4v1753953846554!5m2!1sen!2sse',
          'title', 'Map — Kongens Gate 22, 7715 Steinkjer, Norway',
          'heading', '',
          'aspectRatio', '16 / 9',
          'maxWidth', 700,
          'glow', true,
          'glowColor', '#00bfff'
        ))
      )
    )
  )
);

-- ── /gallery ───────────────────────────────────────────────────────────────
-- The live page has NO images — `GalleryWrapper.tsx` contains not one <img>;
-- en.ts carries ten captions and alt texts for a carousel that was never wired
-- to files. Authored as what it is: a heading and the ten captions, so the URL
-- survives and the slots are visible to fill in the studio. (giocoelho's pooled
-- /gallery is the same empty shape for the same reason.)
INSERT INTO _ref_pages VALUES (
  'gallery',
  'Gallery',
  true,
  jsonb_build_object(
    'id', 'pm-gallery',
    'slug', 'gallery',
    'title', 'Gallery',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-gallery-intro',
        'type', 'rf-media-copy',
        'label', 'Gallery',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Gallery',
          'headingLevel', 1,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'A visual tour of Refusionist projects — code, cloth, and concept woven into living systems.'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-gallery-plates',
        'type', 'rf-list',
        'label', 'Plates',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'Selected work',
          'intro', 'Ten studies across software, brand, and fashion. Add an image to any plate in the studio.',
          'notesHeading', '',
          'notes', '[]'::jsonb,
          'items', jsonb_build_array(
            jsonb_build_object('lead', '01', 'text', 'Interface study',   'sub', 'Minimal UI components on dark grid'),
            jsonb_build_object('lead', '02', 'text', 'Anchor portal',     'sub', 'Cyan energy threads forming a circle'),
            jsonb_build_object('lead', '03', 'text', 'Garment concept',   'sub', 'Technical garment sketch with notes'),
            jsonb_build_object('lead', '04', 'text', 'Human Design map',  'sub', 'Abstract chart with channel lines'),
            jsonb_build_object('lead', '05', 'text', 'Brand glyphs',      'sub', 'Monoline icons and symbols in a matrix'),
            jsonb_build_object('lead', '06', 'text', 'Motion test',       'sub', 'Animated lines weaving into a ring'),
            jsonb_build_object('lead', '07', 'text', 'Product wireframe', 'sub', 'Low-fi wireframe frames on a wall'),
            jsonb_build_object('lead', '08', 'text', 'Color system',      'sub', 'Cyan, aqua, and magenta swatches'),
            jsonb_build_object('lead', '09', 'text', 'Type specimen',     'sub', 'Headlines and body styles on black'),
            jsonb_build_object('lead', '10', 'text', 'Prototype view',    'sub', 'Laptop showing a reactive UI prototype')
          )
        ))
      )
    )
  )
);

-- ── /hemp ──────────────────────────────────────────────────────────────────
-- The whole page is one Notion iframe (page.tsx is five lines). Same embed URL
-- giocoelho's row carries — one shared research database, not a copy.
INSERT INTO _ref_pages VALUES (
  'hemp',
  'Hemp',
  false,
  jsonb_build_object(
    'id', 'pm-hemp',
    'slug', 'hemp',
    'title', 'Hemp',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-hemp-notion',
        'type', 'rf-embed',
        'label', 'Hemp research (Notion)',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'src', 'https://tinyglobalvillage.notion.site/ebd/2ab020ae8a6080d5934ddf82d20f8db5?v=2ab020ae8a6080beb876000c17330f49',
          'title', 'Hemp research database',
          'heading', 'Hemp',
          'aspectRatio', '16 / 11',
          'maxWidth', 1100,
          'glow', true,
          'glowColor', '#00bfff'
        ))
      )
    )
  )
);

-- ── /fitness ───────────────────────────────────────────────────────────────
-- The finished half only — see the header note. Hero copy and the three
-- offerings are refusionist's own; the two `_____` sections are dropped.
INSERT INTO _ref_pages VALUES (
  'fitness',
  'Refusion Fitness',
  true,
  jsonb_build_object(
    'id', 'pm-fitness',
    'slug', 'fitness',
    'title', 'Refusion Fitness',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-fitness-hero',
        'type', 'rf-hero',
        'label', 'Hero',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', '#03202f',
          'ink', '#eaf6fb',
          'muted', 'rgba(234,246,251,0.7)',
          'accent', '#00e4fd',
          'amber', '#ffb454',
          'bgImageUrl', '/images/tenants/refusionist/hero/fitness-hero.jpeg',
          'bgAlt', 'Gio teaching Buti',
          'eyebrow', 'Welcome to',
          'heading', 'REFUSION ',
          'headingAccent', 'FITNESS',
          'tagline', 'This page is dedicated to sharing my practice.',
          'minHeight', 560,
          'overlay', 0.72,
          'objectPosition', 'center 35%',
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Book a session', 'href', '/book/', 'variant', 'primary')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-fitness-story',
        'type', 'rf-media-copy',
        'label', 'My practice',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'My practice',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'ctas', '[]'::jsonb,
          'chips', jsonb_build_array('Healthsport', 'Movewell'),
          'paragraphs', jsonb_build_array(
            'My story started with meditation, tai chi, stretching, and weightlifting in 2006. Later I would come to know yoga in 2009 and finally Buti Movement in 2022. Dance and music have also long been an integral part of my mental health, so to my delight when I found Buti, it was the union of everything I had been living all these years, incorporating all the elements of each practice into one. This is why I love it and love to share it.',
            'I’m open to booking all kinds of classes to whatever suits my client. You can book me for 1-on-1 training, online Zoom sessions, join me in one of my group classes, or even schedule me to teach your own private group.',
            '**Locations I teach at right now:** Healthsport and Movewell.'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-fitness-offerings',
        'type', 'rf-accordion',
        'label', 'Offerings',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Offerings',
          'lede', 'Choose your pathway — consistent practice or a single deep reset.',
          'defaultOpen', 0,
          'items', jsonb_build_array(
            jsonb_build_object(
              'name', 'Group Classes',
              'tagline', 'Weekly, in person',
              'body', 'Weekly schedule and style notes. Music-driven, sweaty, empowering.'),
            jsonb_build_object(
              'name', '1:1 Sessions',
              'tagline', 'In person or on Zoom',
              'body', 'Personalized yoga, Buti and mobility, shaped around where you actually are.'),
            jsonb_build_object(
              'name', 'Workshops',
              'tagline', 'By arrangement',
              'body', 'Somatics, strength, breath and embodiment — for your group, at your place.')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-fitness-cta',
        'type', 'rf-linkbar',
        'label', 'Ready to move?',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'align', 'center',
          'links', jsonb_build_array(
            jsonb_build_object('label', 'Book a session', 'href', '/book/'),
            jsonb_build_object('label', 'Join a class', 'href', '/book/')
          )
        ))
      )
    )
  )
);

-- ── /legal/privacy ─────────────────────────────────────────────────────────
-- Refusion Marketing Agency's policy, effective 22 March 2026. Prose lives in
-- the page file today (137 lines); this is that prose, section for section.
INSERT INTO _ref_pages VALUES (
  'legal/privacy',
  'Privacy Policy',
  false,
  jsonb_build_object(
    'id', 'pm-legal-privacy',
    'slug', 'legal/privacy',
    'title', 'Privacy Policy',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-privacy-lead',
        'type', 'rf-media-copy',
        'label', 'Privacy Policy',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Privacy Policy',
          'headingLevel', 1,
          'headingAccent', '',
          'eyebrow', 'Legal',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', jsonb_build_array(
            jsonb_build_object('label', '← Back to Refusion Marketing', 'href', '/refusionmarketing/', 'variant', 'ghost')
          ),
          'paragraphs', jsonb_build_array(
            'This Privacy Policy explains how Refusion Marketing Agency collects, uses, and protects your information when you visit our website, submit an inquiry, or communicate with us through our forms, email, phone, or messaging channels.',
            '**Effective Date:** March 22, 2026'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-privacy-collect',
        'type', 'rf-list',
        'label', '1. Information We Collect',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', '1. Information We Collect',
          'intro', '',
          'notesHeading', '2. How We Use Information',
          'notes', jsonb_build_array(
            'To respond to your inquiry',
            'To provide services and support',
            'To improve our systems and client experience',
            'To send SMS communications where consent has been given'
          ),
          'items', jsonb_build_array(
            jsonb_build_object('text', 'Name'),
            jsonb_build_object('text', 'Email address'),
            jsonb_build_object('text', 'Phone number'),
            jsonb_build_object('text', 'Business information, if provided'),
            jsonb_build_object('text', 'Any message or inquiry details you choose to submit')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-privacy-terms',
        'type', 'rf-steps',
        'label', 'Sections 3–6',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'How we handle your data',
          'attributionLabel', '',
          'attributionHref', '',
          'steps', jsonb_build_array(
            jsonb_build_object('title', '3. SMS Data Use', 'bullets', jsonb_build_array(
              'Your phone number and SMS consent are used only for communications related to your inquiry, appointments, service updates, or other agreed business communications.',
              'We do not sell, rent, or share SMS opt-in data with third parties for their own marketing purposes.')),
            jsonb_build_object('title', '4. Data Sharing', 'bullets', jsonb_build_array(
              'We do not sell personal data. We may share information with trusted service providers, including CRM, hosting, messaging, scheduling, or automation platforms, solely as needed to operate our services.')),
            jsonb_build_object('title', '5. Data Security', 'bullets', jsonb_build_array(
              'We use reasonable administrative, technical, and operational safeguards to protect the information you provide. No method of transmission or storage is guaranteed to be completely secure.')),
            jsonb_build_object('title', '6. Your Rights', 'bullets', jsonb_build_array(
              'You may request access to, correction of, or deletion of your personal information by contacting us directly.'))
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-privacy-contact',
        'type', 'rf-media-copy',
        'label', '7. Contact Information',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', '7. Contact Information',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Terms of Service', 'href', '/legal/terms/', 'variant', 'ghost'),
            jsonb_build_object('label', 'Refusion Marketing', 'href', '/refusionmarketing/', 'variant', 'ghost')
          ),
          'paragraphs', jsonb_build_array(
            '**Refusion Marketing Agency**',
            'Email: refusionmarketing@refusionist.com',
            'Phone: +1 213-838-9082',
            'Address: 905 6th Street, Arcata, CA 95521',
            'Website: refusionmarketing.refusionist.com',
            'Refusion Marketing Agency operates under the Refusionist brand for marketing services and communication workflows.'
          )
        ))
      )
    )
  )
);

-- ── /legal/terms ───────────────────────────────────────────────────────────
INSERT INTO _ref_pages VALUES (
  'legal/terms',
  'Terms of Service',
  false,
  jsonb_build_object(
    'id', 'pm-legal-terms',
    'slug', 'legal/terms',
    'title', 'Terms of Service',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-terms-lead',
        'type', 'rf-media-copy',
        'label', 'Terms of Service',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Terms of Service',
          'headingLevel', 1,
          'headingAccent', '',
          'eyebrow', 'Legal',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', jsonb_build_array(
            jsonb_build_object('label', '← Back to Refusion Marketing', 'href', '/refusionmarketing/', 'variant', 'ghost')
          ),
          'paragraphs', jsonb_build_array(
            'These Terms of Service govern your use of the Refusion Marketing website, contact forms, messaging channels, and related services.',
            '**Effective Date:** March 22, 2026'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-terms-body',
        'type', 'rf-steps',
        'label', 'Sections 1–7',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'The terms',
          'attributionLabel', '',
          'attributionHref', '',
          'steps', jsonb_build_array(
            jsonb_build_object('title', '1. Business Information', 'bullets', jsonb_build_array(
              'Refusion Marketing Agency, operated under Refusionist, provides marketing automation, lead generation systems, communication workflows, and client acquisition support.')),
            jsonb_build_object('title', '2. Services', 'bullets', jsonb_build_array(
              'We provide software-enabled marketing systems and related services designed to help businesses manage leads, streamline communications, and improve conversion processes.')),
            jsonb_build_object('title', '3. SMS Communication and Consent', 'bullets', jsonb_build_array(
              'By submitting your phone number through our website, forms, or other approved opt-in methods, you provide express consent to receive SMS communications related to: appointment scheduling and reminders; account updates; service-related notifications; and promotional offers, where applicable.',
              'Message frequency may vary. Message and data rates may apply.',
              'You may opt out at any time by replying **STOP**. For assistance, reply **HELP**.')),
            jsonb_build_object('title', '4. No Guarantee of Results', 'bullets', jsonb_build_array(
              'We aim to improve your business outcomes, but we do not guarantee specific revenue, lead volume, conversion performance, or financial results.')),
            jsonb_build_object('title', '5. Payments and Trials', 'bullets', jsonb_build_array(
              'Any trial, deposit, payment arrangement, or service agreement will be stated at the point of offer or sale. Refund terms, if any, are governed by the specific agreement presented at that time.')),
            jsonb_build_object('title', '6. User Responsibilities', 'bullets', jsonb_build_array(
              'You agree to provide accurate information, communicate in good faith, and refrain from misusing our services, website, or systems.')),
            jsonb_build_object('title', '7. Limitation of Liability', 'bullets', jsonb_build_array(
              'Refusion Marketing Agency is not liable for indirect, incidental, special, or consequential damages arising from use of the website, messaging systems, or services.'))
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-terms-contact',
        'type', 'rf-media-copy',
        'label', '8. Contact Information',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', '8. Contact Information',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', '',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Privacy Policy', 'href', '/legal/privacy/', 'variant', 'ghost'),
            jsonb_build_object('label', 'Refusion Marketing', 'href', '/refusionmarketing/', 'variant', 'ghost')
          ),
          'paragraphs', jsonb_build_array(
            '**Refusion Marketing Agency**',
            'Email: refusionmarketing@refusionist.com',
            'Phone: +1 213-838-9082',
            'Address: 905 6th Street, Arcata, CA 95521',
            'Website: refusionmarketing.refusionist.com',
            'Use of this website or submission of your information constitutes acceptance of these terms.'
          )
        ))
      )
    )
  )
);

-- ── /refusionmarketing ─────────────────────────────────────────────────────
-- The agency's own landing page, currently served on its own host. The contact
-- MODAL is not recreated (it posts to a live endpoint and is an application);
-- the CTAs point at HQ's own contact route instead, which is the same thing the
-- modal was standing in for.
INSERT INTO _ref_pages VALUES (
  'refusionmarketing',
  'Refusion Marketing',
  false,
  jsonb_build_object(
    'id', 'pm-refusionmarketing',
    'slug', 'refusionmarketing',
    'title', 'Refusion Marketing',
    'chrome', jsonb_build_object('navEnabled', true, 'footerEnabled', true),
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'sec-rm-hero',
        'type', 'rf-media-copy',
        'label', 'Hero',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'Turn attention into ',
          'headingAccent', 'appointments',
          'headingLevel', 1,
          'eyebrow', 'REFUSION MARKETING',
          'eyebrowColor', 'accent',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'chips', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'We build focused lead-generation funnels for service businesses that want a simpler way to capture leads, follow up faster, and book more qualified calls.'
          ),
          'ctas', jsonb_build_array(
            jsonb_build_object('label', 'Get In Touch', 'href', '/contact/', 'variant', 'primary'),
            jsonb_build_object('label', 'Book your strategy call', 'href', '/book/', 'variant', 'amber')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-rm-who',
        'type', 'rf-list',
        'label', 'Who this is for',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'Who this is for',
          'intro', 'Best for service-based businesses selling high-value outcomes and needing a sharper online funnel.',
          'notesHeading', 'What we help you do',
          'notes', jsonb_build_array(
            'Lead capture',
            'Automations',
            'Call booking',
            'Follow-up systems',
            'Conversion-focused pages'
          ),
          'items', jsonb_build_array(
            jsonb_build_object('text', 'Plumbers'),
            jsonb_build_object('text', 'Med spas'),
            jsonb_build_object('text', 'Dentists'),
            jsonb_build_object('text', 'Real estate teams'),
            jsonb_build_object('text', 'Plastic surgeons'),
            jsonb_build_object('text', 'Coaches and consultants'),
            jsonb_build_object('text', 'Teachers, and more!')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-rm-promise',
        'type', 'rf-media-copy',
        'label', 'Core promise',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'heading', 'If your business is good, your funnel should prove it.',
          'headingLevel', 2,
          'headingAccent', '',
          'eyebrow', 'CORE PROMISE',
          'eyebrowColor', 'amber',
          'imageUrl', '',
          'imageAlt', '',
          'imagePosition', 'left',
          'ctas', '[]'::jsonb,
          'chips', '[]'::jsonb,
          'paragraphs', jsonb_build_array(
            'More qualified leads entering your pipeline.',
            'Faster follow-up with automated workflows.',
            'More appointments booked without adding admin chaos.',
            'A cleaner sales process that helps you close higher-ticket work.'
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-rm-how',
        'type', 'rf-steps',
        'label', 'How it works',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'How it works',
          'attributionLabel', '',
          'attributionHref', '',
          'steps', jsonb_build_array(
            jsonb_build_object('title', '1. We map your offer', 'bullets', jsonb_build_array(
              'We identify the service you most want to sell, the client you most want to attract, and the funnel path that gets them to take action.')),
            jsonb_build_object('title', '2. We build the funnel', 'bullets', jsonb_build_array(
              'Landing page, forms, call booking, messaging automation, lead capture, and follow-up sequences are assembled into one coherent system.')),
            jsonb_build_object('title', '3. We help you convert', 'bullets', jsonb_build_array(
              'You get a practical funnel designed to turn interest into booked calls, and booked calls into paying clients.'))
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-rm-pain',
        'type', 'rf-list',
        'label', 'Why this page matches your outreach script',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'bg', 'transparent',
          'heading', 'Why this page matches your outreach script',
          'intro', '',
          'notesHeading', '',
          'notes', '[]'::jsonb,
          'items', jsonb_build_array(
            jsonb_build_object('text', 'Leads slip through the cracks.'),
            jsonb_build_object('text', 'Follow-up is inconsistent.'),
            jsonb_build_object('text', 'You rely too heavily on referrals or manual outreach.'),
            jsonb_build_object('text', 'You know your service is valuable, but your online system does not reflect that.')
          )
        ))
      ),
      jsonb_build_object(
        'id', 'sec-rm-footer',
        'type', 'rf-linkbar',
        'label', 'Agency links',
        'blocks', '[]'::jsonb,
        'enabled', true,
        'config', jsonb_build_object('props', jsonb_build_object(
          'align', 'center',
          'links', jsonb_build_array(
            jsonb_build_object('label', 'Book your strategy call', 'href', '/book/'),
            jsonb_build_object('label', 'Terms of Service', 'href', '/legal/terms/'),
            jsonb_build_object('label', 'Privacy Policy', 'href', '/legal/privacy/')
          )
        ))
      )
    )
  )
);

-- ── /recipes/paodequeijo and /resume — DERIVED, not retyped ────────────────
-- Same recipe, same timeline, same author. giocoelho's rows were authored from
-- refusionist's own `marketing/recipes/paodequeijo.ts` and `styles/resumeItems.ts`,
-- so the honest move is to take those rows and retarget them: asset paths to
-- refusionist's tenant home, and the resume's fourth phase back to the name it
-- carries in refusionist's source ("Refusionist / TGV", which giocoelho's row
-- rebranded to "giocoelho / TGV"). Everything else is byte-identical on purpose
-- — if Gio edits the recipe on one site it should be obvious the other did not
-- change, rather than two copies drifting silently.
INSERT INTO _ref_pages
SELECT 'recipes/paodequeijo',
       'Pão de Queijo',
       true,
       replace(
         model_json::text,
         '/images/tenants/giocoelho/',
         '/images/tenants/refusionist/'
       )::jsonb
  FROM public.page_models
 WHERE site = 'giocoelho' AND slug = 'recipes/paodequeijo'
   AND lang = 'en' AND mode = 'published' AND user_id IS NULL;

INSERT INTO _ref_pages
SELECT 'resume',
       'Resume',
       false,
       replace(
         replace(
           replace(model_json::text, '/images/tenants/giocoelho/', '/images/tenants/refusionist/'),
           'giocoelho / TGV', 'Refusionist / TGV'),
         'Gio Coelho', 'The Refusionist'
       )::jsonb
  FROM public.page_models
 WHERE site = 'giocoelho' AND slug = 'resume'
   AND lang = 'en' AND mode = 'published' AND user_id IS NULL;

-- ── insert ─────────────────────────────────────────────────────────────────

WITH ins AS (
  INSERT INTO public.page_models
    (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
  SELECT r.slug, 'en', 'published', NULL, NULL, r.title, true, r.in_nav, r.model, now(), 'refusionist'
    FROM _ref_pages r
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
SELECT 'pages authored: ' || count(*) FROM ins;

-- ── the site backdrop ──────────────────────────────────────────────────────
-- refusionist.com's void image lives in its own `layout.client.tsx`, so pooling
-- the PAGES alone would leave the site flat black — every word in place and
-- unrecognisable. Exactly giocoelho's "the site had no sky" defect; same fix,
-- the site-scoped `siteBackground` override. Site rows only, no platform rung.
INSERT INTO public.content_overrides (key, lang, mode, user_id, data, updated_at, site)
SELECT 'siteBackground', 'en', 'published', NULL,
       jsonb_build_object(
         'image', '/images/tenants/refusionist/backgrounds/void.avif',
         'color', '#09111c',
         'fit', 'cover',
         'position', '50% 50%'
       ),
       now(), 'refusionist'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.content_overrides
    WHERE site = 'refusionist' AND key = 'siteBackground'
      AND lang = 'en' AND mode = 'published'
      AND user_id IS NOT DISTINCT FROM NULL
 );

-- ── assertions ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  n int;
  expected constant text[] := ARRAY[
    'about', 'gallery', 'hemp', 'fitness', 'resume', 'recipes/paodequeijo',
    'legal/privacy', 'legal/terms', 'refusionmarketing'
  ];
BEGIN
  -- All nine present, public and live, exactly once each.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist' AND lang = 'en' AND mode = 'published'
     AND user_id IS NULL AND deleted_at IS NULL AND is_public
     AND slug = ANY(expected);
  IF n <> array_length(expected, 1) THEN
    RAISE EXCEPTION 'assert: expected % authored pages readable, found %',
      array_length(expected, 1), n;
  END IF;

  SELECT count(*) INTO n
    FROM (SELECT slug FROM public.page_models
           WHERE site = 'refusionist' AND mode = 'published' AND user_id IS NULL
             AND slug = ANY(expected)
           GROUP BY slug HAVING count(*) > 1) d;
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % authored slug(s) duplicated', n;
  END IF;

  -- Every section names a type the shared catalog can render. A typo here is
  -- invisible in SQL and shows up as a blank page — which is how the homeHero
  -- gap presented on giocoelho.
  SELECT count(*) INTO n
    FROM public.page_models p,
         LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'refusionist' AND p.mode = 'published'
     AND p.slug = ANY(expected)
     AND s->>'type' NOT IN (
       'rf-hero', 'rf-media-copy', 'rf-list', 'rf-steps', 'rf-accordion',
       'rf-embed', 'rf-linkbar', 'rf-schedule', 'rf-hotspots', 'story-timeline'
     );
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % authored section(s) name an unexpected type', n;
  END IF;

  -- No asset path that would resolve against refusionist's OWN app. This is the
  -- broken-image trap from giocoelho, and it is only ever caught by a browser
  -- or by this line.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist'
     AND model_json::text ~ '"/images/(hero|logo|backgrounds|recipes|icons|ui|fitness)/';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) carry an app-relative asset path', n;
  END IF;

  -- Nothing derived from giocoelho still points at giocoelho.
  SELECT count(*) INTO n
    FROM public.page_models
   WHERE site = 'refusionist'
     AND model_json::text ILIKE '%giocoelho%';
  IF n <> 0 THEN
    RAISE EXCEPTION 'assert: % row(s) still name giocoelho after derivation', n;
  END IF;

  -- The backdrop is present, and is the ONLY siteBackground row for this site.
  SELECT count(*) INTO n
    FROM public.content_overrides
   WHERE site = 'refusionist' AND key = 'siteBackground'
     AND mode = 'published' AND user_id IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected exactly 1 siteBackground row, found %', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

SELECT slug, title, is_public, in_nav,
       jsonb_array_length(model_json->'sections') AS sections
  FROM public.page_models
 WHERE site = 'refusionist' AND mode = 'published' AND user_id IS NULL
 ORDER BY slug;

COMMIT;
