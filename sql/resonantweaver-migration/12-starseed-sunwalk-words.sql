-- 12-starseed-sunwalk-words.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.
--
-- The Sun Walk's writing, into the row 11-starseed-rows.sql already seeded.
--
-- The eight currents' descriptions and the two reference essays (the ★
-- anchor-week explainer and the week-types comparison) were compiled into
-- @tgv/module-starseed until W9. They are content — Marthe's words — so they
-- belong in a row she can edit, and this is the migration that moves them.
-- What did NOT move, and never will: `SUN_WALK`, the 52-week grid. It is
-- Swiss Ephemeris output. A current's name and its star's crossing date are
-- astronomy; a current's description is writing.
--
-- Idempotent and non-destructive. The merge is <shipped words> || <the row's
-- own props>, so a key the row already carries wins: re-running changes
-- nothing, and a value she has since rewritten is never clobbered.
--
-- Nothing on screen changes when this runs. The component falls through per
-- field to the same shipped words, so the page said all of this already — the
-- difference is only that from now on it says it because the row does.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/12-starseed-sunwalk-words.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-sunwalk-words', true);

UPDATE public.page_models p
   SET model_json = jsonb_set(
         p.model_json,
         '{sections}',
         (SELECT jsonb_agg(
                   CASE WHEN s->>'type' = 'rf-sun-walk'
                        THEN jsonb_set(
                               s,
                               '{config,props}',
                               $rwss${
  "currents": {
    "Royal Mission": {
      "definition": "Power, visibility, fate-pressure, integrity tests, leadership under consequence.",
      "use": "Use for leadership, public role, destiny pressure, power tests.",
      "distortion": "Can inflate into status-hunger, revenge, obsession, false nobility."
    },
    "Catalytic": {
      "definition": "Action, initiation, protection, teaching, clean force, movement into form.",
      "use": "Use for movement, embodied force, teaching, defense, decision.",
      "distortion": "Can distort into domination, conquest, extraction, spiritualized control."
    },
    "Receptive": {
      "definition": "Field intelligence, fertility, beauty, dignity, gestation, nourishment, subtle perception.",
      "use": "Use for creativity, intuition, subtle sensing, devotion, embodied holding.",
      "distortion": "Can collapse into over-absorbing, helplessness, rescue-patterns, flooding."
    },
    "Coherence": {
      "definition": "Translation, weaving, reconciliation, liberation, integration between worlds.",
      "use": "Use for integration, star-to-earth translation, polarity weaving, synthesis.",
      "distortion": "Can fracture into split identity, inflation, over-translation, lack of residence."
    },
    "Threshold": {
      "definition": "Instinct, wound, obsession, projection, crisis, taboo, unconscious material needing integration.",
      "use": "Use for challenges, distortions, initiation points, trauma-to-power alchemy.",
      "distortion": "Can become projection, crisis-loop, obsession, harmful force if unowned."
    },
    "Pathfinding": {
      "definition": "Announcement, travel, navigation, quest, signal-carrying, go-first energy.",
      "use": "Use for mission, message, travel, exploration, future path, calling.",
      "distortion": "Can scatter into restlessness, premature movement, performative broadcasting."
    },
    "Mystic Intelligence": {
      "definition": "Prophecy, sacred science, art, encoded knowledge, visionary perception, magical cognition.",
      "use": "Use for star-mind, art, vision, ritual, healing, high perception.",
      "distortion": "Can distort into glamour, abstraction, mystification, bypass, disembodiment."
    },
    "Ancestral": {
      "definition": "Lineage, underworld, ancient patterning, soul memory, death/rebirth, pre-incarnational resonance.",
      "use": "Use for roots, underworld, inherited patterns, old soul memory, deep time.",
      "distortion": "Can create heaviness, fatalism, fixation on past or lineage burdens."
    }
  },
  "reference": {
    "anchorWeeks": {
      "chrome": {
        "ariaLabel": "About anchor weeks",
        "index": "Planning layer / 24 markers",
        "title": "Anchor weeks"
      },
      "sections": [
        {
          "label": "Definition",
          "blocks": [
            {
              "kind": "p",
              "text": "An anchor week occurs when the Sun crosses a marquee star: a prominent, recognisable star whose current can hold a larger moment."
            },
            {
              "kind": "p",
              "text": "The star may be important because it is:"
            },
            {
              "kind": "ul",
              "items": [
                "one of the major stars in the framework",
                "culturally, mythically or astronomically prominent",
                "a particularly clear expression of one of the eight currents",
                "strong enough thematically to support a launch, campaign, event or major piece of teaching"
              ]
            },
            {
              "kind": "p",
              "text": "The star becomes the week’s centre of gravity. The surrounding stars add detail, but the anchor star provides the main doorway."
            },
            {
              "kind": "p",
              "text": "The ★ therefore marks editorial and planning importance. It is not a separate astronomical category or a claim that the universe guarantees better results that week."
            }
          ]
        },
        {
          "label": "What does the anchor star represent?",
          "blocks": [
            {
              "kind": "p",
              "text": "The anchor star represents the clearest principle of the week."
            },
            {
              "kind": "p",
              "text": "It gives the week:"
            },
            {
              "kind": "ul",
              "items": [
                "a central current",
                "a recognisable archetype or story",
                "a question to orient around",
                "a practical direction for action"
              ]
            },
            {
              "kind": "p",
              "text": "For example, an anchor star associated with pathfinding might support beginning, announcing or testing something. One associated with visibility might suit being seen, publishing or stepping forward. One concerned with discernment might be better used for decisions, refinement or drawing a line."
            }
          ]
        },
        {
          "label": "How to use anchor weeks for planning?",
          "blocks": [
            {
              "kind": "p",
              "text": "Anchor weeks are the natural places to put greater weight in a calendar:"
            },
            {
              "kind": "ul",
              "items": [
                "launches and offer openings",
                "important announcements",
                "campaigns or themed content series",
                "workshops, ceremonies or live events",
                "major decisions or visible milestones"
              ]
            },
            {
              "kind": "p",
              "text": "The surrounding anchor week arc:"
            },
            {
              "kind": "sequence",
              "steps": [
                {
                  "label": "Before the anchor:",
                  "text": "preparation, introduction, anticipation"
                },
                {
                  "label": "During the anchor:",
                  "text": "the main action, release or focal event"
                },
                {
                  "label": "After the anchor:",
                  "text": "integration, follow-through and response"
                }
              ]
            }
          ]
        }
      ]
    },
    "weekTypes": {
      "chrome": {
        "ariaLabel": "How the three kinds of week differ",
        "index": "Calendar structure / three week types",
        "title": "How the three kinds of week differ"
      },
      "cards": [
        {
          "heading": "Anchor week",
          "blocks": [
            {
              "kind": "p",
              "text": "The Sun crosses a marquee star capable of carrying a larger moment."
            },
            {
              "kind": "p",
              "text": "This is the strongest planning peg: a flagship theme, campaign, launch, event or substantial teaching."
            }
          ]
        },
        {
          "heading": "Ordinary star week",
          "blocks": [
            {
              "kind": "p",
              "text": "The Sun crosses one or more stars, but none has been marked as a major anchor."
            },
            {
              "kind": "p",
              "text": "There is still a real and specific stellar current to explore. These weeks suit regular Sun Walk posts, smaller offerings, reflection questions, focused practices and continuing work. When several stars appear, the weekly spine usually comes from the current carried by the most stars, with the brightest star breaking a tie unless the particular combination suggests otherwise."
            },
            {
              "kind": "p",
              "text": "“Ordinary” does not mean unimportant. It simply means the week does not need to bear the weight of a major calendar moment."
            }
          ]
        },
        {
          "heading": "Bridge week",
          "blocks": [
            {
              "kind": "p",
              "text": "The Sun does not make one of the listed exact star crossings during that seven-day period."
            },
            {
              "kind": "p",
              "text": "Rather than inventing a new current, the week carries forward what has already been opened. It can be used for:"
            },
            {
              "kind": "ul",
              "items": [
                "integration and embodiment",
                "a practice connected to the previous current",
                "its shadow or distortion",
                "questions, discussion or community reflection",
                "tarot or oracle material",
                "recap, rest and preparation for the next crossing"
              ]
            },
            {
              "kind": "p",
              "text": "A bridge week is therefore not an empty week. It is the connective tissue between star passages."
            }
          ]
        }
      ],
      "summary": "So the rhythm is essentially: ordinary weeks develop the journey, anchor weeks mark its major moments, and bridge weeks allow the journey to settle and turn."
    }
  }
}$rwss$::jsonb || (s->'config'->'props')
                             )
                        ELSE s END
                   ORDER BY ord)
            FROM jsonb_array_elements(p.model_json->'sections')
                 WITH ORDINALITY AS t(s, ord))
       ),
       updated_at = now()
 WHERE p.site = 'resonantweaver' AND p.slug = 'sun-walk' AND p.lang = 'en'
   AND p.mode = 'published' AND p.user_id IS NOT DISTINCT FROM NULL
   AND p.deleted_at IS NULL
   AND EXISTS (
     SELECT 1 FROM jsonb_array_elements(p.model_json->'sections') s
      WHERE s->>'type' = 'rf-sun-walk'
   );

-- Assert the row can now say the whole page by itself. This is the check that
-- would have caught a merge that landed the words one level too deep.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'sun-walk' AND p.mode = 'published'
     AND s->>'type' = 'rf-sun-walk'
     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'currents')) = 8
     AND jsonb_array_length(s->'config'->'props'->'reference'->'anchorWeeks'->'sections') = 3
     AND jsonb_array_length(s->'config'->'props'->'reference'->'weekTypes'->'cards') = 3
     AND length(s->'config'->'props'->'reference'->'weekTypes'->>'summary') > 40;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-sun-walk section carrying 8 currents and both reference essays, found %', n;
  END IF;
  RAISE NOTICE 'assertions passed';
END $$;

COMMIT;
