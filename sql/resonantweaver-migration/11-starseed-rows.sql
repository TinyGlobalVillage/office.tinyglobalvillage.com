-- 11-starseed-rows.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.
--
-- The Sun Walk and the Galactic Field Guide as page_models rows, at the exact
-- slugs they already answer on: `/sun-walk` and `/galactic-field-guide`. No
-- redirect and no parallel address, because the addresses are hers and were
-- never up for renaming.
--
-- THESE ROWS DO NOT ANSWER THOSE URLS YET, and that is the plan. Both paths
-- are in resonantweaver's SITE_SURFACES grant, so the proxy hands them to the
-- app routes under `app/[lang]/**` and never rewrites to the tenant path. The
-- route wins while the grant exists. W13 drops the grant and the routes in one
-- commit, and these rows answer the same URLs on the next request — nothing
-- else has to change, which is the point of seeding them public now.
--
-- They ARE public (`is_public = true`), which is how they can be walked at
-- /u/resonantweaver/<slug> for the parity pass before the cutover. That does
-- not double-list them: the sitemap route builds one Map keyed by path, fills
-- it from published+public rows, and only then adds a `SITEMAP_SURFACES` entry
-- `if (!seen.has(...))` — and both sides normalise to a trailing slash, so the
-- row and the grant line collapse onto the same key.
--
-- Idempotent: re-running inserts nothing. Safe to run before a verify pass.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/11-starseed-rows.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-starseed-rows', true);

-- sun-walk — one rf-sun-walk section carrying every word on the page.
INSERT INTO public.page_models
  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
SELECT 'sun-walk', 'en', 'published', NULL, NULL, 'Sun Walk', true, false,
       $rwss${
  "id": "pm-rw-sun-walk",
  "slug": "sun-walk",
  "title": "Sun Walk",
  "chrome": {
    "navEnabled": true,
    "footerEnabled": true
  },
  "sections": [
    {
      "id": "sec-sun-walk",
      "type": "rf-sun-walk",
      "label": "The Sun Walk",
      "blocks": [],
      "enabled": true,
      "config": {
        "props": {
          "eyebrow": "Perpetual calendar",
          "title": "The Sun Walk",
          "lead": "Each week of the year, the Sun walks through a fixed-star gateway — one of eight star currents. The walk is the same every year: a perpetual map of which current is singing now, and which star anchors it.",
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
        }
      }
    }
  ]
}$rwss$::jsonb, now(), 'resonantweaver'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.page_models
    WHERE site = 'resonantweaver' AND slug = 'sun-walk' AND lang = 'en'
      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL
 );

-- galactic-field-guide — one rf-field-guide section carrying 3 plate pairs, 42 dossiers, 62 star cards.
INSERT INTO public.page_models
  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
SELECT 'galactic-field-guide', 'en', 'published', NULL, NULL, 'Galactic Field Guide', true, false,
       $rwss${
  "id": "pm-rw-field-guide",
  "slug": "galactic-field-guide",
  "title": "Galactic Field Guide",
  "chrome": {
    "navEnabled": true,
    "footerEnabled": true
  },
  "sections": [
    {
      "id": "sec-field-guide",
      "type": "rf-field-guide",
      "label": "Galactic Field Guide",
      "blocks": [],
      "enabled": true,
      "config": {
        "props": {
          "theme": "nocturne",
          "readingSize": 1,
          "plates": {
            "lyra": {
              "subject": "/images/tenants/resonantweaver/fieldguide/lyra-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/lyra-habitat.jpg"
            },
            "pleiades": {
              "subject": "/images/tenants/resonantweaver/fieldguide/pleiades-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/pleiades-habitat.jpg"
            },
            "sirius": {
              "subject": "/images/tenants/resonantweaver/fieldguide/sirius-subject.jpg",
              "habitat": "/images/tenants/resonantweaver/fieldguide/sirius-habitat.jpg"
            }
          },
          "prose": {
            "systems": {
              "lyra": {
                "note": "The eldest stock — the cradle of the humanoid template",
                "inhabitants": "The eldest human stock currently remembered in this lore. There are two lineages woven through one sky. The leonine are the fire-bodied ones. Golden-eyed, and crowned with manes. They have the stillness of great cats. They are watchful, warm-blooded, and sovereign. They do not rush to prove themselves. They enter a space knowing who and what they are. The avian are the sky-boned ones. Feathered, swift, and made for distance. Their attention is not fixed only on the room they stand in. With bird’s-eye perspective, they read the currents around it, and the horizon beyond it. As if they are always listening for the next passage between worlds..",
                "landscape": "Lyra is an ancient place that carries the weight of its age. Its halls were built for many. Only a handful live in them now. The architecture still remembers the crowds: wide thresholds, long corridors, gathering rooms, and hearths made to warm more bodies than are left to sit beside them. This is where many of the other lineages are said to have set out from. The old rooms and corridors still whisper the names of those who walked them. It is grand, worn, and much too quiet. Like a house whose children all moved away. The few who stayed keep the hearths lit. Partly from duty. Partly from love. Mostly, perhaps, from stubbornness.",
                "traits": "They are proud, sovereign, and abundant by nature. The Lyrans carry the current of pioneers and originators. They know how to begin. They know how to open a path where there was no path before. There is a founder’s restlessness in them, and often a founder’s wound as well: the ache of being first, of carrying the first fire, of watching others inherit what they began. They are not always the ones who stay to complete the structure. Their gift is ignition. They start things, awaken things, and set things in motion. Finishing them, they often leave to others.",
                "mission": "They came to seed new life, new cultures, and new paths. But they also came to recover what was lost when the first Lyran civilization fractured and its lineages scattered. Their work is not only to create something new. It is also to remember the source behind it.",
                "mythology": "Orpheus's lyre, hung in the heavens after the music nearly emptied the underworld.",
                "frequency": "A single plucked golden string. The note rings longer than expected. Clear, bright, and steady. As it holds, it begins to feel like more than one note. Almost as if the whole song is folded inside it.",
                "passage": "Before the many, there was the first. Lyra is where the old stories begin, and where half the galaxy still finds its ancestry.",
                "margin": "Will mention, unprompted, that they were here first. Infuriatingly, the genealogy does back them up."
              },
              "pleiades": {
                "note": "An open cluster of young blue suns — the sacred sorority",
                "inhabitants": "They are most often described as tall, fair humanoids with a luminous quality to them. In some strands of contactee lore, this is the type often called Nordic. Their eyes are large and almond-shaped, usually pale blue, grey, or the colour of glacial meltwater. Their skin has a soft opalescent sheen, as if lit faintly from somewhere within. They tend to appear calm, graceful, and composed. Their presence is gentle, but not weak. There is often something quietly attentive about them, as if they are listening not only to what is being said, but also to what is being felt.",
                "landscape": "The Pleiades are remembered as a young sky. Seven blue suns share the same heavens, wrapped in the pale mist the cluster is always trailing. Everything here carries the brightness of a place not long made. Light comes from every side, silvered by the veil, so nothing casts a single clean shadow. The edges of things stay soft. Distance is hard to judge. It is beautiful, but also a little disorienting, as if the whole landscape were lit like a memory.",
                "traits": "They are gentle empaths and healers by nature. They tend toward tenderness, care, and emotional attunement. They know how to sit with feeling, how to soothe, and how to help what is hurt begin to soften. But that gentleness can tip into self-forgetting. They often carry an old homesickness they cannot quite name, and some part of their art, healing, and emotional devotion seems to grow from that place. They make beauty, and they midwife feeling, not only for others, but also to ease the ache they carry themselves.",
                "mission": "Their mission is to teach the intelligence of the heart. The Pleiadians work through emotional healing, tenderness, and care. Not as softness without strength, but as a way of knowing. They remind Earth that feeling is not a weakness to be outgrown. It is one of the ways a being learns what is true. Their work is to help what has gone numb begin to feel again. To restore gentleness where survival has made people hard. To make tenderness usable, not decorative.",
                "mythology": "The Pleiades appear in many human traditions under different names: the Seven Sisters, Subaru, Matariki, Krittika. Again and again, they are remembered as a small bright gathering in the sky. In this lore, they are the elder sisters who went ahead. Not to rule from above, but to leave a light others could steer by.",
                "frequency": "A warm chord, held in rose-gold. It does not arrive sharply. It opens gently, and fills the space before you quite notice it. The feeling is soft, steady, and deeply human. Like a hand being held before you remembered to ask for it.",
                "passage": "We did not come to save you. We came to remind you that you were never as alone as you feared.",
                "margin": "Statistically the most likely to weep at your wedding, at strangers’ weddings, and at adverts for telephone companies."
              },
              "sirius": {
                "note": "The Dog Star and its unseen companion — keepers of the blueprint",
                "inhabitants": "Two lineages are usually named under Sirius. The first are blue-toned humanoids, tall and graceful, with a strong connection to water. Their presence feels calm, intelligent, and precise. Like deep water held in a carved stone basin. The second are an elder feline or leonine people. Regal, watchful, and unhurried. They carry themselves with old authority, but with less fire than the Lyrans. Their strength feels colder, more contained, and more disciplined. Both lineages are often described with eyes that hold an older light than the sun outside. Clear, bright, and slightly distant. As if they are not only looking at what is in front of them, but measuring it against something much older.",
                "landscape": "Sirius runs on order. It is the brightest hall in the sky, and the whole place seems to know it. White light. Clean lines. Distances measured carefully. Nothing placed without reason. The great archives sit at the centre. Temple-cities, observatories, and schools built to outlast the people who raised them. They were made for memory, not display. Even the ornament has purpose. Even the silence feels arranged. Below the bright star is its dim companion. Small, heavy, and difficult to see until someone points it out. But once you know it is there, the whole system makes more sense. It holds weight. It keeps the arrangement honest. Nothing here feels casual. Even the light seems to arrive on schedule.",
                "traits": "They are builders and engineers of the sacred. The Sirians understand structure. They know how to make a system hold: a temple, a school, a ritual, an archive, a lineage of knowledge. Their gift is not only intelligence, but precision. They notice where the weight falls. They notice what will collapse later if it is not aligned now. They are disciplined, exacting, and deeply loyal to the work. They are not usually casual with trust, or with knowledge. What they keep, they keep carefully. What they build, they expect to last. But that devotion can become rigid. The Sirian shadow is the belief that if something is not ordered, it is not safe. They can mistake control for protection, and structure for truth. At their best, they do not imprison mystery. They give it a vessel strong enough to survive.",
                "mission": "Their mission is to carry and protect knowledge. The Sirians are keepers of structure: temples, archives, mathematics, ritual systems, and mystery schools. They understand that knowledge does not survive on inspiration alone. It needs form. It needs protection. It needs someone to remember where each piece belongs. They are custodians of the blueprint, not the owners of it. Their work is not to build every house themselves, but to preserve the principles that make building possible. At their best, they do not hoard knowledge. They keep it intact long enough for others to use it well.",
                "mythology": "Sirius has been watched for a very long time. In ancient Egypt, its heliacal rising marked the season of the Nile flood and helped anchor the calendar. The star was not just bright. It arrived with timing, water, fertility, and return. The Dogon of Mali also hold traditions connected to Sirius and its hidden companion. In modern star lore, this became part of the Sirian mystery: the bright star everyone can see, and the dense, difficult companion that has to be known before it can be found. So the mythology fits the current. Sirius is light, timing, water, hidden weight, and knowledge kept carefully across generations.",
                "frequency": "A deep sustained drone in indigo and silver. It is not loud, but it is exact. The sound holds steady beneath everything else, like a great engine running true. You feel it more in the bones than in the ears. A low hum of order, pressure, and purpose.",
                "passage": "Knowledge is a flood. We did not dam it for you. We taught you to raise the banks, so you could drink without drowning.",
                "margin": "Will redesign your filing system entirely uninvited and, more infuriatingly still, will turn out to have been right."
              },
              "arcturus": {
                "note": "An orange giant — physicians and engineers of consciousness",
                "inhabitants": "Arcturians are usually described as small and slender, blue-green in hue, with large dark eyes and fine-boned bodies. Their hands are often shown with three long fingers, giving them a look that is delicate, precise, and slightly otherworldly. But just as often, they are not perceived as solid bodies at all. People describe them more as fields of ordered light: calm, present, and quietly aware. As if a being had condensed just enough to be seen, but not enough to feel fully physical. Their presence is patient, steady, and unusually still. They do not tend to feel warm in the Pleiadian way, or regal in the Lyran or Sirian way. They feel attentive. Clinical, almost. Not cold exactly, but so calm and so precise that it can take a moment to realize you are the thing being gently examined.",
                "landscape": "Arcturus keeps the quietest sky in the catalogue. An old orange giant casts warm light over halls that feel more like an infirmary than a kingdom. Clean, low-lit, and hushed. Not empty, but carefully still, the way a room goes quiet when someone is being tended. Souls in transit are said to pass through here. They stop, are tuned, and are moved on. Because of that, the whole place carries a feeling of passing-through. Nothing clings. Nothing asks you to stay longer than you need to. The stillness is total. It settles on you before you have decided whether you like it.",
                "traits": "They are physicians and engineers of consciousness. Arcturians work with systems most beings barely notice: subtle bodies, energetic pathways, thought-forms, fields, thresholds, and the architecture of awareness itself. They do not tend to heal by warmth or comfort first. They heal by finding the distortion and correcting the pattern. They are calm, precise, and serene to a degree that can feel unnerving. Their intelligence is highly ordered, but not heavy like Sirius. It is cleaner, lighter, more geometric. They think in structure, but the structure is made of frequency. Their gift is refinement. They can tune what has gone noisy, clear what has become tangled, and help a being return to its own signal. Their shadow is detachment. They can become so focused on the pattern that they forget the person inside it. At their best, their precision is not cold. It is care made exact.",
                "mission": "Their mission is to tend the higher mind. Arcturians work with the energetic architecture of worlds: the fields, pathways, and subtle systems that shape how consciousness moves. They are not here to build temples in the Sirian sense. They work further upstream, with the pattern beneath the form. They are guardians of transition. Souls in transit are said to pass through their halls, to be cleared, tuned, and moved cleanly into the next state of being. Their work is not dramatic. It is precise. They help consciousness move without tearing.",
                "mythology": "Arcturians are named as one of the most advanced civilizations in the galaxy. Not because they build the loudest empires, but because they understand the quiet mechanics of consciousness itself. Arcturus is their way-station. A quiet hall where souls pause, are tended, and are sent on.",
                "frequency": "A clean high tone in aquamarine. It sounds like a crystal just after it has been struck. Not the first sharp note, but the silence inside it a half-second later. Clear, suspended, and exact. The kind of stillness that makes every distortion easier to hear.",
                "passage": "Pain is information that has arrived badly. Be still. Let us tune the receiver, and listen again.",
                "margin": "Bedside manner independently rated “flawless; very faintly terrifying.”"
              },
              "orion": {
                "note": "The Hunter — site of the old war, and its long reconciliation",
                "inhabitants": "Many peoples, not one. Tall warrior-castes of polished grey; scholar-castes pale and quiet and watchful. A constellation that has known both empire and, at long last, reconciliation — and wears the history in its bearing.",
                "landscape": "Orion wears its history in the open. This was the site of the long war, and the ground still shows it — old fortifications, monuments raised and half-reclaimed, the belt of three bright stars laid across the middle like a border nobody defends anymore. The peoples here rebuilt in the ruins rather than clearing them, so victory and wreckage stand in the same street. It's a working sky now, busy and rebuilt. But the scale of what happened is impossible to miss, and no one pretends otherwise.",
                "traits": "Driven and brilliant, and still contending openly with the old polarity of power and service. Orion starseeds wrestle the question of duality more nakedly than most, because their home asked it first.",
                "mission": "To resolve the long war between light and dark by integrating it rather than winning it — to prove, in a single life if they can, that strength and surrender were never opposites.",
                "mythology": "The Hunter strides every winter sky, his belt laid in line with pyramids and temples the world over. Lore names this the site of an ancient galactic conflict — and of the slow, unglamorous healing that came after.",
                "frequency": "A struck bronze bell in crimson and slate — tension, held a long moment, resolving at last into a chord.",
                "passage": "We learned the true cost of conquest by paying it in full. Ask us anything you like; we have already lost it once.",
                "margin": "Contains multitudes, several of which are still, even now, not entirely on speaking terms."
              },
              "andromeda": {
                "note": "The chained princess, unchained — keepers of freedom",
                "inhabitants": "Blue-skinned beings of great height and greater stillness. Some are described as barely embodied at all — more a presence that has agreed, for the moment, to stand where you can see it than a body in the ordinary sense.",
                "landscape": "There are no walls in Andromeda, and that's a choice, not an accident. The sky opens in every direction with nothing built to close it — no gates, no borders, no rooms that lock. Wind moves through the whole of it unobstructed. The people are hard to see and harder to hold, more presence than body, and their country is the same: wide, unfenced, quietly daring you to try to contain any part of it. Stand in it long enough and the openness stops feeling empty and starts feeling like the point.",
                "traits": "Freedom-keepers, allergic to cages of every kind — political, mental, spiritual, emotional. Fiercely independent and quietly rebellious; devoted, above almost all else, to liberty.",
                "mission": "To free trapped consciousness wherever they find it; to dismantle systems of control, and to model what self-governance without domination might actually look like, in case anyone wished to try.",
                "mythology": "Andromeda the princess, chained to the rock as a sacrifice and freed by Perseus — a myth the Andromedans are said to take rather personally, and to have taken to heart.",
                "frequency": "A wide open fifth in cobalt — wind moving freely through a place that has no walls left to stop it.",
                "passage": "Every chain we ever broke, we first mistook for the simple shape of the world. So, for a while, will you.",
                "margin": "Do not, under any circumstances, attempt to fence one in. It has been tried. It went very poorly indeed — for the fence."
              },
              "antares": {
                "note": "The burning heart of the Scorpion — alchemists of the shadow",
                "inhabitants": "A water-people of deep tones — teal, violet, oxblood — smooth and faintly serpentine in their movement. Their eyes have wept, plainly and often, and they have decided not to hide it from you.",
                "landscape": "Antares burns red at the heart of the Scorpion, and its country runs downward. This is a descending sky — stairs and deep rooms and warm dark water, everything tending toward the underworld the Antarians made their home a long time ago. It isn't grim. They've lit the whole descent, lamp by lamp, so the dark is warm rather than frightening, oxblood and gold in the low light. It's the one place in the catalogue built for grief. You go down into it, and something in you unclenches.",
                "traits": "Alchemists of emotion. They go willingly where feeling is hardest — into grief, into shame, into the underworld of the psyche — and they come back up the stairs carrying it, transmuted, like a lamp.",
                "mission": "Emotional and shadow alchemy. They teach, by demonstration, that the wound is the doorway and not the wall; that descent, properly undertaken, is also a direction of travel.",
                "mythology": "The Scorpion's burning heart — the star the ancients tied to death, to sex, and to rebirth, the great trinity of transformation, and named the rival of Mars for the red fire of it.",
                "frequency": "A low cello drawn slowly in oxblood and gold — the particular warmth that arrives only just after weeping.",
                "passage": "We do not flinch from your dark. We made our home down there long ago, and we have lit all the lamps for your coming.",
                "margin": "The one being you can tell anything to at three in the morning without its face once changing in the candlelight."
              },
              "aldebaran": {
                "note": "The red eye of the Bull — stewards of the long, slow good",
                "inhabitants": "Steady, broad-framed beings the colour of fired clay, and entirely unhurried. To meet a gaze of theirs is like being regarded by a patient landscape that has watched many weathers come and decline to stay.",
                "landscape": "Aldebaran is farmland, more or less. The red eye of the Bull throws a low ochre light over worked ground — fields tended in long slow rotations, orchards planted by people who won't live to pick from the oldest trees and planted them anyway. Nothing hurries here. The whole sky runs on the patience of the season, on the understanding that the good things take as long as they take. It smells of warm soil after rain. The most unspectacular country in the catalogue, and the most reliable.",
                "traits": "Stewards and providers. Patient, grounded, generous; builders of the long, slow good. The quiet custodians of abundance and the harvest, who measure a life in seasons rather than in days.",
                "mission": "To anchor — to teach Earth-bound souls the half-forgotten art of staying: how to tend a place, how to make it fruitful, and how, against every restless instinct, not to flee it the moment it asks something of you.",
                "mythology": "The red eye of the Bull, following the Pleiades forever across the sky; for many ancient peoples the marker of the harvest seasons and the slow, reliable turning of the year.",
                "frequency": "A grounded root note in ochre — the low hum of warm soil in the hour after rain has finished falling.",
                "passage": "Heaven is also a thing you grow. Kneel down. Tend it. Wait through the season that looks like nothing. It comes.",
                "margin": "Keeps a garden in every single life — even the lives that did not, on paper, appear to have room for one."
              },
              "regulus": {
                "note": "The Little King — a Royal Star, the lion's heart",
                "inhabitants": "Radiant and upright, sun-touched, with the unstudied bearing of natural sovereigns. They carry a warmth that draws a room toward them without their ever once having to ask it to.",
                "landscape": "Regulus keeps a bright open court, and unlike most royal country it isn't cold. The lion's heart sits almost exactly on the Sun's own road, so morning light falls across everything gold and level, and the halls are built to be walked into rather than approached on your knees. There are thrones here, but they face outward, toward the people they answer to. It's grand without being forbidding — a sky that carries its rank lightly, and expects you to meet it standing up.",
                "traits": "Leaders, protectors, performers of the sacred kind. Generous and proud, and slowly learning the hardest royal lesson — that true authority serves the people it stands in front of, rather than ruling them.",
                "mission": "To model noble leadership: courage offered in service, the heart that leads from the front precisely so that it can shield the small and the unready who follow behind it.",
                "mythology": "One of the four Royal Stars of Persia, the Watcher of the North; the lion's heart, lying almost exactly upon the ecliptic as though set there to crown the Sun's own road through the year.",
                "frequency": "A bright fanfare, held unexpectedly soft, in gold and white — the sound of a great door swinging open onto morning.",
                "passage": "A crown is only a circle of responsibility you have agreed to wear in the one place where everybody can see it.",
                "margin": "Will give you the literal coat off its back, and then quietly worry for a week that the gesture was too much. It was not."
              },
              "eridanus": {
                "note": "The End of the River — crisis current, passage, and the mouth where movement becomes consequence",
                "landscape": "No one keeps a house on the lower Eridanus. The upper river runs calm enough that you stop watching your footing, which is the mistake. Nearer the mouth the water gathers speed, then debris, then the reflection of a fire burning somewhere downstream that no map accounts for. Whatever the banks once held has gone under the silt — you pass the shapes of it without stopping. The field notes end where the current does.",
                "rumour": "Rivermen talk of a people at the mouth who never come upstream and never speak first. You leave what you're carrying on a flat stone and walk on; by morning it's taken, or it isn't. No one has met one face to face and come back to say so. Treat it as rumour — the river is hard on anyone who goes looking for the end of it.",
                "traits": "Fast-moving and calm under pressure, the kind that reads the water instead of panicking at it. This is not a reflective country. It watches what's breaking, what can still be moved, what the fire has already reached — and acts before the moment closes.",
                "mission": "To meet the end of the river without becoming the flood. Eridanus is about response: naming what's happening, taking the next real action, standing down once the water drops. Its work turns crisis into something useful, then lets the body rest.",
                "mythology": "In Greek myth this is the river that caught Phaëthon: he took his father's sun-chariot, lost the reins, and set the sky on fire — until Zeus struck him down and he fell burning into Eridanus, and the water closed over the flame. His sisters wept on the banks until they became the trees that shade it. Achernar marks the river's end, where fire and flood arrive and are met with clean action.",
                "frequency": "Blue-white water moving fast, with heat flickering across it — riverlight under lightning, the body alert enough to move and still sure of the ground.",
                "passage": "When the river rises, don't become the flood. Keep your feet under you, find the next solid rock, move to it. When the water drops, get back to the bank.",
                "margin": "Superb in a crisis. Visibly uneasy during calm, on the grounds that it can't yet see what's about to go wrong."
              },
              "crux": {
                "note": "The foot of the Cross — sacred alignment, ceremony, justice, and responsibility made weight-bearing",
                "landscape": "A small bright cross standing alone in the southern dark. Not a kingdom — a marker, the kind left at the edge of a sacred road to tell travellers they've reached somewhere that matters. White stone, cold night air, a horizon low enough to kneel to. Acrux burns at the foot, where the upright line meets the ground and the symbol turns into something with weight. There's no city here. There's a place to stand, and the sense that standing there costs something.",
                "rumour": "Pilgrims speak of keepers who tend the ground and never explain it — figures seen at the foot of the cross at dusk, gone by the time you reach them. Whether anyone lives here or the ceremonies simply run themselves, no returning traveller can say. Take it as rumour, and leave the altar as you found it.",
                "traits": "Ceremonial and steady, serious about the sacred without turning grim. This field knows how to stand where meaning meets consequence and hold a clear shape for others — prayer with hands, direction with feet.",
                "mission": "To make the sacred livable. Crux holds that devotion isn't proven by suffering and alignment isn't the same as carrying the whole world. Its work is to bring spirit into form through ceremony and responsibility, then remember it's allowed to move.",
                "mythology": "Crux is the Southern Cross: navigation, sacrifice, sacred direction. Small in the sky, enormous in what it points at. Acrux is the bright foot of it — ceremony, justice, and the pressure to turn spiritual meaning into embodied weight.",
                "frequency": "A white-gold vertical tone crossed by a quieter horizontal hum — a ritual bell struck in an open field, the sound running down the spine and out through the hands.",
                "passage": "Stand where the lines meet, but don't nail yourself there. The sacred needs your alignment, not your suffering.",
                "margin": "Will build an altar from three stones, a candle stub, and total sincerity, and somehow it holds."
              },
              "cancer": {
                "note": "The hidden claw — the cradle behind the shell",
                "landscape": "A dim blue-white crab-field, low to the cosmic tide. Shell chambers and moon-pools, wet stone, small guarded places where soft things keep surviving because something older learned to close around them. Acubens sits in the claw — the part that grips and won't open until it's sure. The light is faint here. Everything worth finding is tucked somewhere you have to be trusted to reach.",
                "rumour": "Fishers of the tide-line swear something tends the moon-pools — that the guarded places are guarded by someone, not just by luck. No one has seen a face. Whatever it is checks the weather and the visitor before it shows, and mostly decides against. Rumour, then — but the pools are always clean, and no one you'd ask has cleaned them.",
                "traits": "Private, watchful, protective. Cancer moves sideways because the straight road isn't always the safe one, and it feels no shame about choosing shelter over spectacle.",
                "mission": "To keep the vulnerable thing alive until it's strong enough to come out. This field guards seeds, griefs, children, and unfinished returns — and has to learn the difference between protecting a life and refusing to let it leave.",
                "mythology": "Cancer is the Crab, tied anciently to the gate of souls and the scarab's mystery of life returning from the dark. Acubens sits in the claw: the grip that guards, and must eventually learn to open.",
                "frequency": "A small blue pulse heard underwater — moonlight touching the inside of a shell.",
                "passage": "Some hiding is fear. Some of it is a thing growing where it can't yet be seen. Learn which is which, and open when the life inside starts to knock.",
                "margin": "Will not leave the shell until the room, the weather, and everyone's mood have all been independently checked."
              },
              "centaurus": {
                "note": "The Centaur field — wound, wisdom, healing, teaching, sacrifice, and embodied animal intelligence",
                "inhabitants": "Two peoples share the Centaur plain and each behaves as if the other isn't there. The Hadarians ride the open grass — big-hearted, loud in welcome, quick to press wine on you and slower to mention what the reform they're planning will cost. The Alpha Centaurians keep to the healing-houses at the plain's edge, quieter and nearer, the kind who'll walk the last mile of a bad road at your shoulder without being asked. Get hurt out here and you'll meet both: the ones who'll make a cause of your wound, and the ones who'll just set the bone.",
                "landscape": "Open southern plain running up to temple-ground, wild grass giving way to low stone healing-houses and old roads where the wounded were never hidden from the sacred. Medicinal fires burn at the edges. It smells of horse and crushed herb and woodsmoke. Two great stars hang over it — one far and cool, one close enough to feel like a neighbour — and the whole field lives in the space between the wilderness and the temple, belonging fully to neither.",
                "traits": "Deeply feeling, instinctive, practical in the body. Tender and blunt at once — it will comfort you and tell you the hard truth in the same breath, and see no contradiction.",
                "mission": "To let the wound become wisdom without making a shrine of the suffering. Centaurus carries healing, reform, and the nerve to change what's gone false — not by rising above the animal body but by walking through it.",
                "mythology": "Centaurus is the old centaur field: half human, half animal, teacher and wild body in one form. Through Chiron it remembers the wound that becomes medicine. Agena is the harder gate, sacrifice and reform; Toliman carries the healing footstep — the road that becomes medicine by being walked.",
                "frequency": "A low blue-white heart-tone moving through the belly and legs — warm enough to comfort, strong enough to walk into the difficult room.",
                "passage": "Don't offer suffering to the altar when the truth alone would do. Let the wound teach. Then let the body live.",
                "margin": "Arrives with a healing balm, a difficult question, and no patience at all for pretending the wound isn't there."
              },
              "cepheus": {
                "note": "The King — future authority, sober stewardship, and the right hand of responsibility",
                "inhabitants": "The Cepheans are few, and the field notes on them thin — a reserved people, slow to speak and slower to claim authority they haven't earned. What travellers agree on is the waiting. A Cephean will have thought a thing through years in advance, said nothing, and simply be ready when the moment finally arrives. They govern little and steward much. Ask one who's in charge and you'll get a pause, and then a name that isn't theirs.",
                "landscape": "A pale northern throne-country, high and cold, timber halls with the ceremony long over. No golden empire — more a king's house after the crowd has gone home: stone steps, dim lamps, a hand resting on the arm of an empty chair, the roof open to the pole-light above. It's quiet in the way of a place that is mostly waiting. The cold keeps everything patient.",
                "traits": "Reserved and watchful, severe until you've earned otherwise. Cepheus treats authority as something that has to ripen before it can be trusted, and refuses to rush it.",
                "mission": "To turn authority into stewardship. This field holds the long lesson of power that serves what comes next — not domination, not display, but the clean act taken once the soul is finally seated in the seat.",
                "mythology": "Cepheus is the King of the northern royal story: husband of Cassiopeia, father of Andromeda, caught in the old chain of pride and consequence. Alderamin marks the right arm — the part that acts for the crown before the crown is fully understood.",
                "frequency": "A white axis in a dark-blue room — still, vertical, patient, with the faint sound of a future door unlocking.",
                "passage": "Don't rush to become the centre. Let time shape the hand. The true king is the one who knows what is his to steward, and what isn't.",
                "margin": "Has already made the five-year plan, mentioned it to no one, and is waiting with some patience for everyone else to catch up."
              },
              "gemini": {
                "note": "The Great Twins — storm-fire, brotherhood, threshold-guarding, and the bond between mortal and immortal",
                "inhabitants": "The Twins keep the gate together, and they are not alike. One carries speech, music, clever hands, and moves quick and upward. The other carries the club and the oath, and stands where the road crosses into somewhere dangerous. They work in pairs by nature — one calls, the other answers — and the whole people runs on that call-and-answer, the certainty that no one crosses alone. The wider Gemini folk are barely charted. The Twins themselves are known mostly by the rule they keep: the bond holds, or nothing does.",
                "landscape": "A violet-white twin-field with two bright heads and two roads of light running down through it. Storm country, most of it — black weather, a ship's mast, two pale flames burning in the rigging where sailors look for them. One road climbs toward speech and quick air; the other drops toward the gate and the thunder under it. Between them runs the cord that keeps the two from drifting apart. A place built for crossings, and for being answered when you call across the dark.",
                "traits": "Restless, articulate, protective, double in the old sacred sense. Gemini divides not from confusion but because some truths arrive in pairs — one to speak them, one to guard them.",
                "mission": "To keep the bond alive across difference. Gemini carries translation, companionship, storm-navigation, and the willingness to go back for the one who couldn't cross alone. Movement is safer, it holds, when the signal is answered.",
                "mythology": "In Greek myth the Twins are Castor and Pollux, horsemen and Argonauts, lights seen in the rigging during storms — one mortal, one divine, their love strong enough that immortality itself had to be shared. Older Babylonian sky-lore knew them as the Great Twins, guardians of thresholds and the gates of the underworld.",
                "frequency": "Two pale flames on a mast in black weather — quick silver speech above, hoofbeat and gate-thunder below.",
                "passage": "Call, and the other flame answers. No twin crosses alone, and no gate stays shut once the bond remembers its name.",
                "margin": "Keeps one foot on the dock, one hand on the mast, and three versions of the story ready in case one is needed."
              },
              "crater": {
                "note": "The Cup — vesselhood, sacred containment, and the medicine that must not be spilled",
                "inhabitants": "Little is settled about the Alkiens, and the little there is comes from a single source, so hold it loosely. They're described as cup-keepers — a devotional people who tend something precious and measure very carefully when to pour it and when to keep it back. Gentle, exacting, protective of the vessel. Whether they're a people or a story travellers tell about the place, the notes can't yet say. Review before you trust it.",
                "landscape": "A small golden cup-field resting on the back of the old serpent sky. Less a planet than a vessel — bronze bowls and dark wells, ritual basins, rainwater caught in stone, quiet temple rooms where something is held until the right hands come for it. The light is warm and low. Everything here is shaped to contain, and to be careful about what it contains.",
                "traits": "Gentle, receptive, exact about holding. Crater knows the difference between empty, full, overfull, and being handed what was never meant for its shape.",
                "mission": "To hold what's precious without being lost inside the holding. This field carries medicine, memory, grief, and prophecy, and the old art of knowing when to keep, when to pour, and when to wash the cup clean.",
                "mythology": "Crater is the Cup of the sky, linked in Greek myth with Apollo, the raven, and the water-serpent. Older streams make it the sacred vessel — grail, cauldron, offering bowl — the container that lets mystery survive the crossing from one world to another.",
                "frequency": "A warm gold tone inside dark water — one drop falling into a cup and the whole chamber going still to listen.",
                "passage": "Hold only what the vessel can carry, and pour before the medicine turns to burden.",
                "margin": "Will offer you tea, prophecy, and a firm private opinion about whether your cup is structurally up to the job."
              },
              "hydra": {
                "note": "The Serpent's Heart — passion, poison, deep water, and the old force beneath civilization",
                "landscape": "A long green-black serpent-field winding under half the sky, too large to take in at once. Marsh and old water, reed-shadow, warm stone, buried venom. A single orange heart burns alone in the coils — Alphard, the one bright thing in a country that otherwise keeps to the dark. The ground doesn't run in straight lines and neither does anything living on it. You feel watched here long before you find anything looking.",
                "rumour": "The marsh-folk downstream won't name what lives in the coils. They say it's old, that it feels grief before you've spoken it, and that it strikes only when someone treads on the wound by accident. No adventurer has confirmed it and several have stopped answering letters. Rumour — but the locals leave the deep water alone, and they have reasons they won't give.",
                "traits": "Ancient, emotional, magnetic, hard to tame. Hydra carries the old body-language of instinct and grief and desire — everything people once called primitive because it frightened them.",
                "mission": "To make the serpent-heart conscious before it turns to poison. This field holds passion, shadow, old grief, and the power to turn venom into medicine without pretending the venom was never there.",
                "mythology": "Hydra is the great water serpent of the sky — the many-headed creature Heracles faced, and the water-snake of the tale of Apollo and the raven. Older lore links the region to serpent forms and underworld gates, something long moving beneath the ordered world.",
                "frequency": "A low green pulse under dark water — warm blood, old venom, and a drumbeat felt through the belly rather than heard.",
                "passage": "Don't strike before you know the wound. The serpent isn't evil for carrying venom. Venom becomes medicine when consciousness reaches the heart.",
                "margin": "Calm right up until someone steps on the old grief, at which point everyone remembers snakes have opinions."
              },
              "corona_borealis": {
                "note": "The Crown — beauty, recognition, the offered mantle, and the cost of being lifted",
                "landscape": "A small arc of pale-gold stars, like a crown left on dark velvet after the ceremony ended. Wreath and jewel and empty throne-room light — beautiful, exposed, quieter than whatever longing first reached for it. Alphecca sits at the front of the arc, the bright stone of the circlet. There's no court here anymore. Only the crown, still lit, and the low sense that it's waiting to be picked up by someone who understands the weight.",
                "rumour": "Travellers who've camped under the arc report a feeling more than a figure — that the crown is watched, that reaching for it too eagerly is noticed and marked. Whether a keeper tends the ground or the place simply carries its own warning, no one has stayed long enough to learn. Rumour. But few who reach a second time describe the reaching.",
                "traits": "Graceful, visible, socially fine-tuned. Corona Borealis knows the difference between being seen and being owned by the seeing, and it carries the odd pressure that arrives when a gift quietly becomes a role.",
                "mission": "To receive beauty and honour without handing over sovereignty. This field holds the lesson of the offered crown — what may be accepted, what must be refused, and what can only be worn if the person stays true underneath it.",
                "mythology": "In Greek myth the Northern Crown is Ariadne's, set in the sky after abandonment and rescue. Other traditions saw a broken dish, a loose string of jewels, a garden. The crown is never only decoration. It's memory made visible.",
                "frequency": "A bright gold ring with one note missing — sweet enough to draw the eyes up, sharp enough to remind the head what it's carrying.",
                "passage": "Not every crown is yours to wear. Weigh the gift, feel the thorn, and take only what your life can carry in truth.",
                "margin": "Looks purely decorative until you try to wear it. Then everyone suddenly has opinions about your posture."
              },
              "pisces": {
                "note": "The Knot — binding, crossing streams, and the place where divided waters remember one cord",
                "landscape": "A pale blue twin-river field, faint and wide, two fish swimming away from each other and still held by one cord. Soft dark water, crossing currents, silver threads running under the surface, and a knot of light where the two lines meet. Al Rescha sits at that knot. It's a quiet country, easy to drift in and hard to hold — the kind of place where you lose track of which current you were following and have to feel your way back to the cord.",
                "rumour": "Those who've drifted the twin rivers speak of guides under the surface — something that keeps the two streams from losing each other, that tugs the cord when a traveller strays too far. No face, no voice, only the sense of being gently kept. Rumour, and a hard one to test: the ones who go looking for the guide tend to lose the cord instead.",
                "traits": "Subtle, connective, hard to grasp head-on. Pisces lets distance exist and then remembers the thread — holding two drifting truths without cutting either loose.",
                "mission": "To find the true knot. Pisces joins what's become separate without dissolving the shape of either strand. It's meaningful connection, not indiscriminate merging.",
                "mythology": "In Greek and Roman myth the Fishes are tied to Aphrodite and Eros escaping the monster Typhon by taking to the water. In some tellings they become fish, in others they're carried by them — but the cord is the old image: two lives tied so they won't lose each other in the dark river.",
                "frequency": "A blue-silver thread humming underwater — two notes drifting apart, then finding the same hidden knot.",
                "passage": "Don't merge everything. Find the true cord. What belongs together will hold without drowning what needs to stay distinct.",
                "margin": "Can follow three emotional currents at once and still lose the cup of tea it was holding."
              },
              "aquila": {
                "note": "The Eagle — bold ascent, sky-fire, sovereign flight, and the courage to cross the river of stars",
                "inhabitants": "The Altairians live high and travel light. A quick, independent people, watchful from above, who'd rather move before a road is proven than wait for permission that may never come. They carry fire — literally, in the old stories, and figuratively in the way they bring back something useful from every height they climb to. They don't take well to cages, however reasonably those cages are dressed up. Offer one shelter with a lock on it and watch it choose the weather instead.",
                "landscape": "A blue-white eagle-country stretched across the river of stars, wings open over the Milky Way. High air, stormlight, sharp ridges, summer heat rising off stone. Altair burns at the head of it, bright and close. The horizon is enormous here and always widening — a land built for rising, for seeing far, for launching without quite leaving the ground behind. The wind never fully stops.",
                "traits": "Independent, quick, watchful from height. Aquila has the courage to move before the road is sure, and no patience for confinement — but at its best it carries fire without dropping it on everything below.",
                "mission": "To make freedom purposeful. Aquila doesn't rise only to escape the ground. It rises to see farther, act cleanly, and bring something back from the height that can serve the living field below.",
                "mythology": "Aquila is the Eagle of the old sky — thunderbird of Zeus, carrier of the divine fire, the one who lifts Ganymede to Olympus. In Chinese lore Altair is Niu Lang the cowherd, kept from his beloved Vega across the celestial river until a bridge of birds lets them cross.",
                "frequency": "A bright blue-white cry over warm air — wingbeat, lightning, and the sudden widening of the horizon.",
                "passage": "Rise, but don't abandon the ground. The height isn't the mission. The fire you carry has to know where it's meant to land.",
                "margin": "Vanishes toward the horizon for spiritual reasons and comes back with weather data, a feather, and a new plan."
              },
              "phoenix": {
                "note": "The Firebird — ash, return, transformation, and the form that survives its own ending",
                "landscape": "A warm southern firebird-field, ember-orange against the dark. Ash plain, dry wind, black sky, and one living flame moving quietly through ground everyone else had written off as finished. Ankaa glows low and steady at the head of it. Nothing here is loud. The whole country has the feel of the morning after — cooled, cleared, and already, faintly, starting again.",
                "rumour": "Travellers who cross the ash swear it isn't empty — that something moves through the burnt ground tending small fires, keeping the pattern alive between one ending and the next. It's never there when you turn to look. Whether a keeper walks the plain or the place simply knows how to return on its own, no one has stayed through a full cycle to find out. Rumour, and a patient one.",
                "traits": "Private, resilient, mythic without making noise about it. Phoenix knows endings aren't always disasters and returns aren't always dramatic. It keeps the memory of the old form without mistaking it for the life.",
                "mission": "To carry the pattern through the fire. This field holds regeneration, and the strange dignity of beginning again without needing the whole sky to applaud.",
                "mythology": "Phoenix is the firebird that burns, dies, and rises from its own ash. The constellation is modern, but the bird behind it is ancient. Ankaa means the Phoenix; an older name, Nair al Zaurak, remembers the bright star of the skiff.",
                "frequency": "A low ember-hum under black wings — smoke, orange light, the first warm breath after the ash settles.",
                "passage": "You are not the ash, and not only the flame. You are the pattern that knows how to come back.",
                "margin": "Looks finished for three days, then turns up with better light and a wildly unreasonable amount of purpose."
              },
              "carina": {
                "note": "The Keel — navigation, deep voyage, soul-vessel, and the star that steers through southern waters",
                "inhabitants": "The Canopeans are charted only at the edges, so take the account lightly. They're named as navigators — a steady, far-seeing people who hold the underside of a voyage rather than its glory, the ones who keep a crossing from tipping over when the weather turns strange. Not sail, not prow. Keel. Whether they're a people or the role the place teaches, the notes stay careful. Review before canon.",
                "landscape": "A vast southern ship-country seen from below, not from the deck. This is the keel — dark wood, star-salt, pressure, ballast, the long hidden spine that lets a vessel live through open water. Canopus burns at the navigator's place, a bright southern lamp over black sea. Deep-water country: heavy, quiet, built to endure. Everything here is the part of the journey no passenger ever sees.",
                "traits": "Steady, far-seeing, practical in deep water. Carina doesn't boast like a sail or command like a prow. It holds the weight, and keeps the whole thing from going over.",
                "mission": "To carry the voyage without losing the vessel. This field holds navigation, ballast, mentorship, and the deep structural wisdom that lets a soul cross dangerous water without becoming only the storm it passed through.",
                "mythology": "Carina was part of Argo Navis, the great ship of Jason and the Argonauts, and became the keel when the old ship was divided among the stars. Ancient cultures knew the region as a ship or divine boat — a vessel for gods, floods, and crossings too large for ordinary roads.",
                "frequency": "A warm white star over dark southern water — hull-creak, salt wind, the low wooden note of a vessel that knows where its weight belongs.",
                "passage": "Don't mistake the voyage for the storm. Set the keel, trust the star. The crossing is long, but the vessel was built for deep water.",
                "margin": "Packed maps, ropes, spare biscuits, and one very bright star, on the theory that everyone else forgot navigation was a job."
              },
              "auriga": {
                "note": "The Charioteer — the goat-star, wild nurture, movement, and the care that refuses the cage",
                "inhabitants": "The Capellans are herders who don't trust walls. You find them by their fires, never their houses. A camp can be nursing a sick child at midnight and gone by first light — milk-pail in one hand, reins in the other, the whole household packed onto the chariot before you've found your boots. They keep their wealth in things that move: goats, the young, and enough songs to last a winter crossing. Whoever's cold when the herd passes gets fed. That's their whole law, and they keep it better than most kingdoms keep theirs.",
                "landscape": "High winter country, seen from the goat-tracks — cold valleys, flat gold light on the snow, wheel-ruts frozen into ground that thaws for no one. The Charioteer's road runs through all of it and settles nowhere. Capella burns at the head of the field, a warm lamp you can steer by from miles off. Up here the weather turns without warning, and a light that holds still while everything else moves is the only thing worth trusting.",
                "traits": "Quick, curious, generous, impossible to pen. Auriga carries the old knowledge that care can run, steer, and cross distance — that you can feed the child and mind the road with the same pair of hands.",
                "mission": "To carry life forward without caging it. This field holds mobile care, animal wisdom, travel, protection, and the freedom to nurture without being owned by what you nurture.",
                "mythology": "Auriga is the Charioteer, usually shown holding Capella the little she-goat. Capella is linked with Amalthea, the goat who fed the infant Zeus, whose horn became the cornucopia. The field remembers reins and milk in the same hands: movement and nourishment together.",
                "frequency": "A warm yellow note with hoofbeats under it — milk, wheel-rhythm, winter stars, the first breath of a road opening.",
                "passage": "Feed what's sacred, then keep moving. Care doesn't have to sit by the fire to be real.",
                "margin": "When a Capellan offers you a bed, take it that night. There won't be one there in the morning."
              },
              "cygnus": {
                "note": "The Swan — world-egg shimmer, sacred flight, luminous craft, and the Northern Cross",
                "inhabitants": "The Denebians are makers. A graceful, quick-learning people who protect their inner world fiercely and spend it generously — artists and craftspeople who take the subtle thing they've perceived and give it hands, so others can see it too. Beauty with muscle under it. They can seem aloof from a distance, wings held close, but that's guardedness around something delicate, not disdain. Get past it and you find the workshop, and the unfinished work everywhere in it.",
                "landscape": "A white-blue swan-country flying down the Milky Way, wings spread across the river of stars. From one angle a bird, from another a cross of light. Black water, summer sky, white feathers, reed-shadow, and the odd hush just before a song becomes something you can see. Luminous ordinary country — nothing here is grand, and all of it shines, as if the place never agreed to be plain in the first place.",
                "traits": "Graceful, intelligent, protective of the inner world. Cygnus is beauty with muscle under it — quick learning, artistic sight, and the knack of making the ordinary shine without pretending it was ever ordinary.",
                "mission": "To give vision both wings and hands. This field holds art, science, song, and the luminous work of turning subtle perception into something others can see, hear, study, or follow.",
                "mythology": "Cygnus has worn many swan-stories — Zeus in disguise, the grieving Cycnus, Orpheus remembered through the bird of music, the Northern Cross flying the summer sky. Older streams give the swan world-egg and creation qualities: the white creature moving between water, sky, death, and song.",
                "frequency": "A white note over dark water — wingbeat, riverlight, and the clean shimmer of something ordinary turning holy.",
                "passage": "Don't flee the ordinary. Look again. The world is already lit. Give the vision wings, then give it hands.",
                "margin": "Serene from a distance. Up close, mostly feathers, strong opinions, and an unfinished poem about transcendence."
              },
              "capricornus": {
                "note": "The Sea-Goat — old law, survival structure, horn, tail, and the wisdom that protects life",
                "landscape": "A dark green-bronze sea-goat country at the edge of old water. Horns above the cliff, tail below the tide. Wet stone, black sea, mountain paths, salt caves, winter stars, and old laws carved into rock where the flood once reached. Deneb Algedi sits at the head of it. Survival country — everything here was built to outlast weather, hunger, and bad years, by someone who'd seen all three.",
                "rumour": "Coast-dwellers speak of old keepers of the sea-goat law — figures who know which caves stay dry and which paths survive the winter, who leave the carved rules and are never seen carving them. Whether they still walk the cliffs or the laws simply outlived their makers, no traveller can say. Rumour. But the escape routes are always clear, and someone keeps them that way.",
                "traits": "Ancient, practical, watchful. Capricornus doesn't trust structure because it loves rules — it trusts structure because someone has to remember what survives the storm.",
                "mission": "To make authority into shelter. This field carries old law, guardianship, and survival wisdom — the art of building forms that protect life without hardening into a cage.",
                "mythology": "Capricornus is the Sea-Goat, goat above and fish below. In Mesopotamian lore it belongs to the goat-fish of Ea, lord of waters and wisdom; in Greek tellings, to Pan escaping Typhon, or to Amalthea who nourished Zeus.",
                "frequency": "A low bone-green note under black water — hoof on stone above, tail moving slowly in the deep below.",
                "passage": "Climb, but remember the sea. Govern, but remember the living. Law without warmth is only another kind of flood.",
                "margin": "Keeps a ledger, a rope ladder, and a route to the sea, and calls all three basic preparation."
              },
              "coma_berenices": {
                "note": "The Shorn Crown — sacred offering, beauty surrendered, and the vow that must not erase the giver",
                "inhabitants": "The Lang come from a fringe corner of the catalogue and should be held at arm's length until better notes arrive. They're described as a devoted people, makers of sacred offerings, whose whole difficulty is the vow — the giving of something precious that then gets named and claimed by others until the giver is nearly gone from the gift. Graceful, loyal, quietly stronger than they look. Whether the account holds, review before you trust it.",
                "landscape": "A faint gold veil-country between the Lion and the Herdsman — more shimmer than shape. Loose hair and braid, a wreath, a scatter of jewels, an offering bowl on temple steps. Soft night, cut silk, and the uneasy quiet that follows something precious being given away. Diadem glows dim at the centre of it. You could walk through and barely notice the place was inhabited, until you feel the weight of what was left on the altar.",
                "traits": "Graceful, devoted, delicate to look at and stronger than it admits. Coma Berenices carries the beauty of the vow, and the old warning that not every offering stays holy once other people start naming it for you.",
                "mission": "To make devotion sovereign. This field holds loyalty, beauty, creative force, and the slow work of reclaiming the crown after love has asked too much.",
                "mythology": "Queen Berenice cut off her hair and offered it for her husband's safe return. When it vanished from the temple, it was said to have been placed among the stars — loss turned into celestial memory, an offering turned into a crown.",
                "frequency": "A faint honey-gold shimmer through loose hair — soft as silk, sharp as scissors, bright enough to remember who made the vow.",
                "passage": "Give only what is truly yours to give. A real offering should bless the life it serves, not empty the one who lays it down.",
                "margin": "Makes the sacred offering, then quietly notes who mistook devotion for available inventory."
              },
              "sagittarius": {
                "note": "The Archer — aim, stance, vision, and the dark center behind the bow",
                "inhabitants": "The Sagittarians are charted loosely, and the deeper you go toward the Core the thinner the notes get. They're a searching people — restless, bright with aim, forever travelling toward a horizon big enough to deserve the arrow. At their best they train the stance before they loose the shot, which is rarer than it sounds. Behind them the galaxy gathers into a dark centre that doesn't shine, and the ones who live nearest it speak least, as if the pull does their talking.",
                "landscape": "A bronze-gold archer-country standing before the thickest part of the Milky Way. Bow, knee, eye, target, and a sky so crowded with stars it reads as smoke. Behind the figure the galaxy pulls inward to a dark radiant centre that gives no ordinary light but bends everything toward it. Country built around aim and the thing aimed at — vast, luminous, and quietly organised by a gravity you feel before you understand it.",
                "traits": "Restless, searching, bright with aim. Sagittarius wants distance and meaning and a horizon worth the arrow — and, at its best, has the decency to steady the stance before firing at the truth.",
                "mission": "To aim without becoming the weapon. This field carries quest, philosophy, and the discipline of sending force only where the soul can answer for the shot.",
                "mythology": "Sagittarius is the Archer, often a centaur drawing the bow. Older sky-streams give the region hunters and guardians of the road into the dense heart of the galaxy. The constellation points at the Galactic Center — the dark architecture the local stars turn around.",
                "frequency": "A bronze bowstring under black-gold sky — taut, bright, listening for the moment before release.",
                "passage": "Plant the foot. Open the eye. Draw only what you're willing to follow. The arrow remembers who sent it.",
                "margin": "Travels three countries for wisdom, then finds the lesson was in its left knee the whole time."
              },
              "piscis_australis": {
                "note": "The Southern Fish — the mouth, the sacred dream, and the bright watcher in dark water",
                "inhabitants": "The Fomalhautians are sparsely charted, so take the account as provisional. They're described as a visionary, inward people, easily haunted by their own ideal — the kind who see the finished temple in the water before anyone's found the first stone. Beautiful company, and demanding, most of all on themselves. Whether they are many or one bright watcher the stories multiplied, the notes can't yet say.",
                "landscape": "A pale southern fish-country drinking from the stream of the Water-Bearer. Fomalhaut burns at the mouth — white, solitary, watchful, one bright star in a lot of dark water. Silver silt, broken rings, and the odd brightness of a dream that hasn't yet agreed to become practical. Lovely and a little lonely. The single watching star gives the whole place the feel of being kept awake by something it can almost see.",
                "traits": "Beautiful, inward, visionary, easily haunted by its own ideal. Piscis Australis doesn't dream small — it sees the temple in the water before anyone's laid a stone.",
                "mission": "To keep the dream clean. This field carries mysticism, beauty, and the dangerous blessing of believing in a more perfect shape before the world has earned it.",
                "mythology": "Piscis Australis is the Southern Fish, shown drinking the water poured by Aquarius. Fomalhaut, the fish's mouth, is one of the old royal watchers of the sky, long tied to vision, promise, and the test of purity inside a dream.",
                "frequency": "A white star reflected in blue-black water — lonely, lovely, impossible to ignore once seen.",
                "passage": "Dream, but don't lie to the dream. What's holy survives contact with matter. What's vanity dissolves the moment the water touches it.",
                "margin": "Has an exquisite vision for the future and zero tolerance for cheap candles near the altar."
              },
              "aries": {
                "note": "The Ram — horned will, rescue, first motion, and the gate opened by force",
                "inhabitants": "The account of the Hamal beings runs from a single source, so hold it loosely. They're named as a direct, hot-blooded people, quick to the first move and impatient with permission — the ones who lower the head and open the way while everyone else is still forming a committee. Protective, blunt, allergic to false ceremony. Whether they're a people or a temperament the place breeds, the notes stay unsure. Review before canon.",
                "landscape": "A rust-gold ram-country on a dry hill before dawn. Horns, dust, warm stone, split roads, the smell of weather about to break. Hamal burns at the head of it. Something here has already lowered its head — not from obedience, but because a path needs opening and no one else has moved. First-light country, all potential and no patience, the moment before the year turns over.",
                "traits": "Direct, hot-blooded, protective, impatient with false permission. Aries isn't subtle about beginnings. It trusts the first spark, the horn, the leap — the body, before the committee arrives.",
                "mission": "To open the way without becoming only impact. This field carries rescue, initiative, and the harder art of knowing when the gate needs a ram and when the door is already unlocked.",
                "mythology": "Aries is the golden ram that carries Phrixus and Helle away from sacrifice — one child saved, one lost to the sea, the fleece becoming the old prize of kings and Argonauts. Older lore knew the region through field and flock and the first sign of the turning year.",
                "frequency": "A hot gold strike through the forehead and chest — hoofbeat, horn, the first flame catching dry grass.",
                "passage": "Lower the head only when the path truly needs opening. Your force isn't wrong. But it has to know what it serves.",
                "margin": "\"Why is everyone still standing by the altar?\" — asked mid-rescue, ropes still smoking, entirely baffled."
              },
              "pegasus": {
                "note": "The Winged Horse — flight, genius, flood-mind, and the saddle that lets vision move",
                "inhabitants": "The Pegasians are lightly charted, so take this as provisional. They're described as an original, restless people, elegant when they aren't bolting — bright inventors and sudden poets with more sky in them than structure. Their whole problem, the notes suggest, is the saddle: brilliance that needs a seat strong enough to ride, or it scatters. Whether the account holds, review before canon.",
                "landscape": "A blue-violet horse-country above the autumn dark, built around a great square of stars. Wing, saddle, spring-water, storm-cloud. Markab sits where a rider would — the steady seat — while Scheat rushes overhead, high-strung and electric. The body of the land is wide enough to carry a rider, but the mind of it is already half over the next horizon. There's more sky here than ground, and the ground knows it.",
                "traits": "Original, restless, elegant when it isn't bolting. Pegasus knows the difference between flight and escape, learned the hard way, and carries bright invention that needs structure to survive.",
                "mission": "To make vision rideable. This field carries imagination, science, and poetry, and the need for a saddle strong enough that the winged thing can cross the sky without scattering itself.",
                "mythology": "Pegasus is born from Medusa's blood and becomes the winged horse of heroes. His hoof opens Hippocrene, the spring of poetic inspiration. He helps Bellerophon face the Chimera, then throws the rider when he reaches too far toward Olympus.",
                "frequency": "A violet-blue rush through square lines — hoofbeat, fountain-water, the sound of a thought growing wings before it asked permission.",
                "passage": "The sky is real, and so is the saddle. Build the seat. Give the flood a channel. Let the horse fly without losing the rider.",
                "margin": "Give it a saddle before you give it a plan. It supplies the brilliance and loses the rider on the same afternoon."
              },
              "cetus": {
                "note": "The Sea Monster — old fear, deep body, devouring tide, and the creature beneath the story",
                "landscape": "A vast blue-grey sea-beast country, faint until the eye adjusts and then far too large. Jaw, tide, cold flank, old water. Menkar burns at the head — not a crown, not a weapon, just the first place the creature becomes visible. Everything here is deep-body and slow. You feel the size of what you're standing on before you see any edge of it, which is its own kind of warning.",
                "rumour": "Coast-people speak of the thing in the deep water as if naming it might wake it — a hunger, a memory, a great body turning in its sleep below the surface. Whether anything truly lives here or the dark simply does the frightening on its own, no adventurer has gone down to check and written back. Rumour. Some depths are best left unaddressed until you know what's holding them.",
                "traits": "Ancient, heavy, instinctive. Cetus carries the thing people call monster before they've learned what the deep is actually holding — hunger, fear, memory, the great body under the surface.",
                "mission": "To meet the creature without becoming prey. This field carries shadow, old survival fear, and the slow dignity of looking straight at what the village would rather sacrifice someone else to.",
                "mythology": "Cetus is the sea monster sent against the kingdom of Cepheus and Cassiopeia, the shape waiting below Andromeda's rock until Perseus turns it to stone. The sky keeps the whole scene — king, queen, daughter, hero, and beast.",
                "frequency": "A blue-black groan through deep water — jawbone, tide-pull, and the sound of something enormous turning in its sleep.",
                "passage": "Don't call every depth a monster. Some things only devour because no one spoke to them before the hunger started.",
                "margin": "Hard to schedule around, being ancient, oceanic, and wholly uninterested in your calendar."
              },
              "columba": {
                "note": "The Dove — return, message, soft navigation, and the small sign after the flood",
                "landscape": "A small pale dove-country below the great dogs and the ship-road. Wing, breast, an olive leaf, a blue-white feather. The sky here isn't grand — it's clear, the way air goes clear after rain, and a long way from the shouting. Phact sits quietly at the head of it. A modest, exact place, easy to overlook, and the first ground to look habitable again after everything else has flooded.",
                "rumour": "Sailors say a messenger keeps this country — something that crosses the water and comes back with proof the world is livable again, a leaf, a branch, a small true sign. No one's seen the hand that carries it. Whether a keeper works the flood-line or the branch simply arrives, the notes won't commit. Rumour. But after a bad crossing, the sign does tend to come.",
                "traits": "Quiet, watchful, precise. Columba doesn't need to be large to be trusted. It carries the message, finds the branch, crosses the water, and comes back while everyone else is still arguing about whether the flood is over.",
                "mission": "To bring back the living sign. This field carries peace, navigation, return, and the gentle authority of a message that doesn't need to turn dramatic to be true.",
                "mythology": "Columba is Noah's Dove, sent over the flood to find whether land had returned. In the old atlases it carries the olive branch — not victory exactly, but evidence that the world is becoming livable again.",
                "frequency": "A blue-white wingbeat over receding water — soft, exact, brighter than it first appears.",
                "passage": "Come back with the branch. Don't despise the small sign. Some worlds begin again as a leaf in the beak.",
                "margin": "Brings one tiny olive branch and somehow gets everyone to stop doom-planning for at least six minutes."
              },
              "perseus": {
                "note": "The Hero — blade, trophy, young force, and the severed power that must be carried consciously",
                "inhabitants": "The Perseans are only sparsely charted, so hold the account with care. They're named as a brave, hot, reactive people, quick to the decisive gesture — courage and speed and protection, with the standing danger of mistaking every knot for a thing that has to be cut. Their real trial, the notes say, is what they carry after the victory. Whether the account holds, review before canon.",
                "landscape": "A copper-red hero-country between the Chained Princess, the Bull, and the Queen. Sword, hand, flank, and a severed trophy that hasn't fully stopped being dangerous. Mirfak burns in the body of the field; Capulus sharpens at the blade; and Algol blinks red from the terrible prize, on and off, refusing to go quiet. Charged ground — the air after a fight, before anyone's decided what the win actually cost.",
                "traits": "Brave, hot, reactive, drawn to the decisive stroke. Perseus carries courage, speed, and protection, and the danger of treating every knot as something that has to be cut.",
                "mission": "To carry power without being owned by the victory. This field holds warrior-force, precision, and rescue — and the discipline required when rage, fear, beauty, and the blade all reach the same hand.",
                "mythology": "Perseus beheads Medusa and later saves Andromeda from the sea monster. The sky keeps the whole dangerous theatre — chained maiden, vain queen, devouring beast, winged horse, and the Gorgon's head, still potent after death.",
                "frequency": "A hot bronze strike through red shadow — blade-flash, heartbeat, and the blinking eye of a power not done speaking.",
                "passage": "Take up the blade only when the hand is clean. What you carry after the victory can be more dangerous than what you beat.",
                "margin": "Saves the day cleanly, then spends three years quietly furious that the trophy keeps getting invited to dinner."
              },
              "canis_minor": {
                "note": "The Lesser Dog — quick signal, early movement, clever timing, and the light before Sirius",
                "inhabitants": "The Procyonians are a quick, clever, alert people — the ones who notice the change early and move before the room's agreed there's a change to move on. Tactical, sharp-eyed, low on patience for ceremony when the scent is already obvious. They run ahead and signal back, the light at the gate before the procession arrives. Their whole discipline is learning to stay with what they've heard instead of bolting on the first flash of it.",
                "landscape": "A small gold-white dog-country just ahead of the greater blaze. Paw, ear, alert eye, cold winter breath. Procyon burns bright at the head of it — not the temple-lamp of Sirius next door, but the quick light at the gate, the one that catches the change first. Lean, awake country, always slightly leaning forward, always a moment ahead of the larger thing coming up behind it.",
                "traits": "Fast, clever, alert, tactical. Canis Minor catches the change early and moves before the room agrees, with very little patience for ceremonial delay once the scent is obvious.",
                "mission": "To make speed trustworthy. This field carries timing, quick response, and early warning — the art of moving first without scattering the whole pack.",
                "mythology": "Canis Minor is the Lesser Dog, companion to the winter hunter. Procyon means 'before the dog' — the star that rises ahead of Sirius, announcing the greater radiance before it clears the horizon.",
                "frequency": "A sharp gold bark in cold air — quick paws, bright eyes, the first flash of light before the great star rises.",
                "passage": "Move early, but not blind. The first signal is a gift only if the body can stay with what it heard.",
                "margin": "Heard it before anyone, acted at once, and is now wondering why the committee is still locating its shoes."
              },
              "hercules": {
                "note": "The Kneeler — strength under trial, red giant heart, and the labor that teaches humility",
                "landscape": "A red-gold giant-country bent on one knee. Club, shoulder, old skin, breath. Ras Algethi glows huge and warm and tired at the head of the kneeler — a red giant, vast and slow, still plainly capable of lifting the sky if someone insists. Country shaped by labour: worn smooth in the places weight has passed through it, and quiet with the particular quiet of strength taking a moment on the ground before standing again.",
                "rumour": "Travellers say a labourer works this country still — that the kneeling figure isn't resting but between tasks, and that if you sit with it a while it will hand you something heavy without a word. No one's confirmed a face. Whether a keeper kneels here or the land simply holds the shape of old effort, the notes won't say. Rumour, and a tiring one to test.",
                "traits": "Strong, burdened, stubbornly useful. Hercules carries the old problem of power after damage — how to keep doing the work without turning every task into proof it deserves to live.",
                "mission": "To make strength conscious. This field holds endurance, repair, discipline, and the moment the hero finally kneels without being defeated by it.",
                "mythology": "Hercules is the great labourer of the sky — monsters, trials, madness, penance, impossible work. Older images call him simply the Kneeler, a figure bent in the heavens before the story's been cleaned up.",
                "frequency": "A red drum under heavy bone — heat, breath, and the low sound of strength learning not to crush what it carries.",
                "passage": "Kneel — not to surrender, but to feel the ground before you lift again. Power without contact turns into punishment.",
                "margin": "Moves the boulder, fights the monster, apologises badly, and files the whole thing under 'a light Tuesday.'"
              },
              "ophiuchus": {
                "note": "The Serpent-Bearer — medicine, forbidden knowledge, and the body that holds the living coil",
                "landscape": "A green-gold healer-country with a serpent laid across the middle of it. Hand, coil, shoulder, dark herb, bright knife. Ras Alhague sits at the head. The snake isn't being killed here — it's being held, exactly where its medicine can be read, which is a harder and more patient thing. A working country, close and intent, smelling of herb-smoke and something sharper underneath. Nothing about it is casual, and nothing about it is safe by accident.",
                "rumour": "The sick who make it this far speak of a healer who holds the living serpent and never flinches — who reads the venom for the cure inside it and asks unsettling questions while doing it. No one agrees on the face. Whether a keeper tends the country or the medicine simply works on its own terms, the notes stay open. Rumour. Approach the way you'd approach anything that heals and harms with the same hand.",
                "traits": "Intense, observant, hard to simplify. Ophiuchus carries the old healer's bargain — to touch poison without worshipping it, to learn from the wound without marrying it.",
                "mission": "To hold the serpent without becoming either saviour or venom. This field carries medicine, taboo knowledge, and the ethics of a power that heals or harms depending on the hand that holds it.",
                "mythology": "Ophiuchus is the Serpent-Bearer, linked with Asclepius, the healer who learned resurrection's secret from serpents and was struck down for bringing too much medicine to humankind. The constellation splits Serpens into head and tail.",
                "frequency": "A green hiss inside a clear bell — herb-smoke, pulse, scale, and the clean fear of medicine that actually works.",
                "passage": "Hold the living thing carefully. Poison and cure aren't always different substances. The hand decides the prayer.",
                "margin": "Will explain, calmly, that the venom is useful — which is true, and not remotely reassuring."
              },
              "aquarius": {
                "note": "The Water-Bearer — poured current, future rain, and the vessel that does not keep what it carries",
                "landscape": "A blue vessel-country pouring itself out toward the Southern Fish. Jar, shoulder, stream, rain, star-water. The two great stars sit high and cool over it — Sadalmelik and Sadalsuud — and the figure that pours is almost beside the point. The current is the point. Generous, impersonal country, a place organised around water that arrives, moves through, and is gone, and knows better than to try to keep it.",
                "rumour": "Downstream villages speak of a water-bearer who tends channels no one built and asks for no thanks — who appears where the old waterways have failed and simply makes the current run again. Whether a keeper walks the streams or the water finds its own way, no traveller has caught the pouring hand at work. Rumour. But where the channels were dry, they aren't, and someone's cool nerve is the likeliest reason.",
                "traits": "Strange, generous, impersonal in the sacred sense. Aquarius cares for the field more than for being thanked for the water — bringing rain, signal, and reform with a cool steady nerve.",
                "mission": "To carry the future without hoarding it. This field holds renewal, communal intelligence, and the vessel-work of making water available where the old channels have failed.",
                "mythology": "Aquarius is the Water-Bearer — sometimes Ganymede, sometimes Deucalion after the flood, sometimes the older jar the life-water flows from. The stream runs down toward Fomalhaut at the mouth of the Southern Fish.",
                "frequency": "A blue stream over silver stone — continuous, cool, and older than whoever is doing the pouring.",
                "passage": "Pour cleanly. Don't clutch the current. Water goes stagnant the moment the vessel mistakes itself for the source.",
                "margin": "Rebuilds the whole village water system and then looks honestly baffled to be invited to the thank-you."
              },
              "cassiopeia": {
                "note": "The Seated Queen — beauty, consequence, throne, mirror, and the cost of careless speech",
                "landscape": "A warm W-shaped queen-country high in the north. Throne, mirror, lifted chin, gold cloth, cold air. Schedar sits in the body of the queen — bright, exposed, a good deal less comfortable than the portraits let on. Regal ground, and self-aware, and faintly braced, as if the whole place remembers a thing it said once and can't take back. Beautiful, cold, and watching itself in the glass.",
                "rumour": "Northern travellers speak of the seated queen as though she might still be listening — that careless words carry here, that the country keeps a long memory for boasts. Whether a figure holds the throne or the place simply amplifies whatever you bring to it, no one's stayed to find out. Rumour. Best to keep your speech clean while you cross it.",
                "traits": "Regal, articulate, image-aware, sharper than it means to be. Cassiopeia understands the force of being seen, and the trouble that starts when beauty and rank lose contact with humility.",
                "mission": "To make radiance responsible. This field holds visibility, lineage, reputation, and the throne-work of speaking from dignity rather than for display.",
                "mythology": "Cassiopeia is the queen who boasted of beauty greater than the sea-nymphs and drew a monster toward her kingdom. The sky keeps her seated near Cepheus, Andromeda, Perseus, and Cetus — the whole family drama made circumpolar.",
                "frequency": "A gold note in cold northern air — mirror-light, silk, and the small crack in the voice just before pride learns better.",
                "passage": "Sit tall, but don't build the throne out of comparison. Beauty doesn't need an enemy to be seen.",
                "margin": "Absolutely said the thing, regrets the fallout, and would still like the record to note the styling was impeccable."
              },
              "virgo": {
                "note": "The Maiden — grain, harvest, sacred measure, and the hand that knows what is ripe",
                "landscape": "A pale-gold harvest-country, wide and quiet. Grain, hand, veil, furrow, vine. Spica shines as the wheat-ear; Vindemiatrix stands near the hour of the vintage. Nothing here is random — the whole field knows when to cut and when to wait, and runs on that knowing. Worked, ordered, unhurried ground, the kind that rewards attention and quietly judges the careless. The light lies flat and yellow over all of it.",
                "rumour": "Harvest-folk at the edges speak of a keeper who knows exactly when each thing is ripe — who moves through the rows at the right hour and is gone by the time you reach the gap in the grain. Whether someone tends this country or the field simply keeps its own time, the notes won't commit. Rumour. But the cut is always made at the proper moment, and no one admits to making it.",
                "traits": "Precise, fertile, observant, easily underestimated. Virgo isn't purity as absence — it's purity as right relationship: seed to soil, hand to tool, harvest to season.",
                "mission": "To tend what ripens. This field carries craft, discernment, medicine, timing, and service — the sacred intelligence of matter arranged well.",
                "mythology": "Virgo has been the Maiden, the harvest goddess, the Furrow, Demeter, Astraea, the one holding the ear of grain. Spica still remembers the wheat; Vindemiatrix, the grape-gatherer and the hour of harvest.",
                "frequency": "A pale yellow thread through grain — dry earth, clean hands, the quiet snap of a stem cut at the right time.",
                "passage": "Serve the living thing, not the idea of serving it. The grain knows when it's ripe. Learn the field before you touch the blade.",
                "margin": "Has a basket, a blade, a better system, and a private opinion about how everyone else labels their jars."
              },
              "delphinus": {
                "note": "The Dolphin — rescue, joy, clever waters, and the song that carries the lost one home",
                "inhabitants": "The Matrax come from a fringe corner of the catalogue, so keep the account provisional. They're described as a playful, quick, intensely loyal people — rescuers who work by wit and music rather than force, who treat joy itself as a method and use it to reach the ones the sea has pulled under. Light, but not trivial. Whether the account survives scrutiny, review before canon.",
                "landscape": "A small bright dolphin-country leaping out of dark water. Fin, arc, spray, a listening eye. Sualocin sits in the quick body of it — not large, clever, musical, and entirely able to change the course of a voyage. Fast, glittering, shallow-bright country over deep water, the kind of place that stays light on a heavy sea because it's decided lightness is worth defending.",
                "traits": "Playful, intelligent, loyal to the pulse of the water. Delphinus doesn't confuse lightness with triviality — it knows joy can be a rescue method and music can carry what argument can't.",
                "mission": "To bring the lost back through sound, wit, and living contact. This field carries rescue, play, and the sacred usefulness of delight when the sea has turned too heavy to bear.",
                "mythology": "Delphinus is the dolphin who helps Poseidon find Amphitrite, and the one who saves the poet Arion after betrayal at sea — messenger, rescuer, musician's ally, a small bright intelligence in a dangerous ocean.",
                "frequency": "A quick blue whistle over black water — leap, splash, laughter, and the note that tells the drowning body it isn't alone.",
                "passage": "Sing before you sink. Call before you go under. The water has friends, and not all rescue arrives with solemn eyebrows.",
                "margin": "Saves your life, cracks a joke, and flatly refuses to let the tragedy keep the whole soundtrack."
              },
              "libra": {
                "note": "The Scales — balance, claw, judgment, and the old law between beauty and consequence",
                "landscape": "A pale green-gold balance-country between the Maiden and the Scorpion. Scale, claw, hinge, beam, dusk light. The two great stars carry both old images at once — the weighing-pans of justice, and the scorpion claws that held this threshold before the law arrived with nicer furniture. Measured, relational ground, quiet at first glance and exact underneath. Everything here is being weighed, including you, and the beam takes its time finding centre.",
                "rumour": "Those who've crossed the scales speak of a judge who never appears but is plainly at work — that the beam settles as if a hand tipped it, that a crooked bargain gets found out here with no one visibly finding it. Whether a keeper holds the balance or the country simply can't abide a weighted scale, the notes stay open. Rumour. Cross it honest, and you'll have less to test.",
                "traits": "Measured, relational, exacting under the charm. Libra wants harmony, but not the decorative kind that hides a crooked beam — and it knows balance sometimes takes a verdict.",
                "mission": "To make beauty answer to truth. This field carries justice, proportion, negotiation, and the courage to name where the scale's been quietly weighted.",
                "mythology": "Libra was once the Scorpion's Claws, and later the Scales sacred to judgment and the balance of day and night. Zuben Elgenubi and Zuben Eschamali still carry the southern and northern claw in their names.",
                "frequency": "A soft green chime over bronze — two pans, one breath, and the small sound of the beam finding centre.",
                "passage": "Don't call it peace if one side has to vanish to keep it. Let the scale speak. Then make beauty honest again.",
                "margin": "Hosts a very elegant mediation and somehow already knows exactly where the bodies are buried."
              },
              "ursa_minor": {
                "note": "The Little Bear — north star, still point, tail, axis, and the light that does not chase the road",
                "inhabitants": "The Polarians are thinly charted, so take this lightly. They're described as a quiet, steady, orienting people — no need to dazzle like the southern royals, offering instead the rarer thing: a fixed point others can steer by when everything else is moving. Reliable to the edge of stubbornness. Whether they are a people or the discipline the pole teaches, the notes can't yet say.",
                "landscape": "A small white bear-country curled around the pole. Tail, paw, cold breath, snow-dark, and one fixed star. Polaris stands near the hinge of the whole northern sky — less a destination than the point everything else turns around. Still, cold, orienting country. Nothing here chases anything. The single steady light does the work, and the rest of the sky wheels past it through the night.",
                "traits": "Quiet, steady, orienting. Ursa Minor offers the rare thing — a light that stays useful when everything else is in motion.",
                "mission": "To keep orientation through the dark. This field carries axis, navigation, continuity, and the soft discipline of returning to the point that doesn't need to be chased.",
                "mythology": "Ursa Minor is the Little Bear circling the pole, linked in Greek story with Arcas or a nymph who nursed Zeus. In plain human history, Polaris became the North Star — guide of sailors, walkers, fugitives, anyone who needed one reliable light.",
                "frequency": "A white note in cold blue silence — small, steady, impossible to argue with once the night has turned.",
                "passage": "Don't chase every light. Find the one that tells you where you are. Direction is sometimes quieter than desire.",
                "margin": "Not the flashiest guide in the sky, which is exactly why everyone sensible keeps checking it."
              }
            },
            "stars": {
              "lyra": {
                "vega-wega": {
                  "councilSeat": "The Lyre-Bearer",
                  "coreFunction": "Enchanted transmission; beauty, voice, symbol, and sound as carriers of star-memory.",
                  "gift": "The gift of Vega is luminous transmission. It brings artistic intelligence, musicality, poetic speech, symbolic fluency, charisma, refinement, beauty, enchantment, and the ability to make invisible material perceptible through form. It can support musicians, writers, speakers, animators, artists, ritualists, sound-workers, teachers, storytellers, designers, performers, and anyone whose work depends on carrying a frequency through beauty. At its highest, Vega makes communication feel alive. The message is not simply understood; it is felt.",
                  "shadowGate": "The Vega shadow gate is the glamour loop. The person may become entranced by how something sounds, looks, feels, or reflects them back to themselves. They may mistake resonance for truth, charisma for integrity, or emotional impact for spiritual authority. This is especially important with strong Mercury, Venus, Jupiter, or public-life contacts. Vega asks: “Is the spell serving the soul, or is the soul serving the spell?”",
                  "councilMessage": "Let the signal be beautiful because it is true. Do not polish the song until it forgets the soul. Tune the string, then let the field remember.",
                  "keywords": [
                    "Enchanted transmission",
                    "Vega",
                    "Wega",
                    "Lyra",
                    "harp of Orpheus",
                    "star-lyre"
                  ]
                }
              },
              "pleiades": {
                "alcyone-pleiades": {
                  "councilSeat": "The Star-Eyed Witness",
                  "coreFunction": "Inner vision; the star-cluster of sight, memory, judgment, and subtle knowing.",
                  "gift": "The gift of Alcyone is inner vision. It brings mystical perception, symbolic intelligence, artistic seeing, ancestral sensitivity, pattern recognition, and the ability to perceive what others miss. It can support seers, artists, healers, astrologers, animators, dream-workers, grief-workers, ritualists, researchers, and those who work with image, field, memory, or subtle diagnosis. At its best, Alcyone gives the kind of insight that can become art, prophecy, healing, invention, or compassionate witness.",
                  "shadowGate": "The Alcyone shadow gate is the judgment of the dead before the life has finished speaking. The person may sense failure, distortion, dishonesty, or incompletion and move too quickly into final assessment. The ancient Fate-current is strong here: the thread is measured, the soul is weighed, the requirement is checked. But if this power is not softened by humility, it becomes ruthless. Alcyone asks: “Can you see the pattern without cutting the thread?”",
                  "councilMessage": "See deeply, but do not harden. The pattern is real, but it is not the whole soul. Let the eye become a doorway, not a verdict.",
                  "keywords": [
                    "Inner vision",
                    "Pleiades",
                    "star-sisters",
                    "Fates",
                    "judgment of the dead",
                    "mystical sight"
                  ]
                }
              },
              "sirius": {
                "sirius": {
                  "councilSeat": "The Radiant Guardian",
                  "coreFunction": "Sacred radiance; the ordinary act becoming mythic.",
                  "gift": "The gift of Sirius is radiant devotion. It brings the ability to make life feel meaningful, ritualized, alive, and spiritually charged. At its best, it creates protectors, guardians, teachers, ceremonial workers, public symbols, healers, and people whose actions carry weight beyond their own intention. Sirius gives the sense that small things matter because the field is listening.",
                  "shadowGate": "The Sirius shadow gate is sacred overexposure. The person may feel that their energy, body, story, grief, or service belongs to something larger before they have learned how to remain intact inside it. The correction is not to dim the light, but to build a vessel strong enough to hold the heat.",
                  "councilMessage": "Do not try to become the sun. Tend the flame you have been given. The smallest act, performed with reverence, can become a doorway for the whole field.",
                  "keywords": [
                    "Sacred radiance",
                    "Isis-current",
                    "holy heat",
                    "ritual",
                    "devotion",
                    "guardianship"
                  ]
                },
                "murzims-mirzam": {
                  "councilSeat": "The Dawn-Herald Hound",
                  "coreFunction": "The announcement before the radiance; the message that rises before the great star and tells the field what is coming.",
                  "gift": "The gift of Murzims is message-bearing. It brings speech, announcement, teaching, public voice, explanation, group communication, early warning, advocacy, and the ability to give form to something that others have not yet noticed. It can support teachers, scientists, writers, broadcasters, guides, activists, spokespersons, astrologers, channelers, messengers, and people whose role is to say, “Pay attention; something important is arriving.” Murzims gives the bark that wakes the village.",
                  "shadowGate": "The Murzims shadow gate is premature announcement. The person may sense something before others do and feel an immediate need to speak, explain, or warn. But the message may still be forming. The gate opens when they can ask: “Is this ready to be announced, and who actually needs to hear it?” Murzims becomes sacred when speech serves the signal rather than the messenger’s pressure.",
                  "councilMessage": "Do not bark at every shadow. Listen for the real arrival. When the signal is true, speak clearly enough that the field can wake.",
                  "keywords": [
                    "Murzims",
                    "Mirzam",
                    "Beta Canis Majoris",
                    "The Announcer",
                    "herald hound",
                    "message-bearing"
                  ]
                }
              },
              "arcturus": {
                "arcturus": {
                  "councilSeat": "The Threshold Pathfinder",
                  "coreFunction": "The pathfinder; guardian of transition from one way of life into another.",
                  "gift": "The gift of Arcturus is guided transition. It brings vision, courage, practical intelligence, protective leadership, and the ability to sense where a new path is trying to open. It supports guides, teachers, innovators, reformers, bridge-builders, cultural translators, land-workers, navigators, community builders, and people whose work helps others cross from an old pattern into a more livable one. Arcturus carries the rare combination of star-sight and road-making: it can see the future, but it wants to make the future walkable.",
                  "shadowGate": "The Arcturus shadow gate is the lonely advance. The person may be far enough ahead to see what needs to change, but not far enough supported to feel held while doing it. They may become impatient, isolated, or quietly resentful because they are carrying the map before anyone else has agreed there is a journey. The gate opens when the pathfinder remembers: the point is not to prove how far ahead they are. The point is to make the crossing real.",
                  "councilMessage": "You do not have to carry the whole road. Find the next true crossing. Make it clear enough that life can follow.",
                  "keywords": [
                    "Pathfinder",
                    "Bear Guard",
                    "Bear Watcher",
                    "threshold guardian",
                    "transition",
                    "new way of life"
                  ]
                }
              },
              "orion": {
                "betelgeuse": {
                  "councilSeat": "The Radiant Achiever",
                  "coreFunction": "Radiant achievement; the power to become effective, visible, and remembered.",
                  "gift": "The gift of Betelgeuse is joyful effectiveness. It brings confidence, creative force, public magnetism, technical or artistic ability, leadership, and the capacity to do something well enough that others notice. It can support artists, performers, inventors, leaders, organizers, writers, teachers, craftspeople, visionaries, and people whose work is meant to become visible. Betelgeuse does not only promise fame; more importantly, it promises the possibility that one’s talents can produce real results.",
                  "shadowGate": "The Betelgeuse shadow gate is the seduction of easy brilliance. If things come naturally, the person may not build the vessel deeply enough. If success arrives early, they may not develop the humility, patience, or emotional maturity needed to hold it. The question is not “Will I be seen?” but “What part of me is being seen, and can it survive visibility without becoming hollow?”",
                  "councilMessage": "Do not hide the gift until it is perfect. Let it move. Let it become visible. But remember: true radiance leaves life brighter, not merely dazzled.",
                  "keywords": [
                    "Radiant achievement",
                    "visible talent",
                    "success",
                    "charisma",
                    "joy",
                    "fame"
                  ]
                },
                "bellatrix": {
                  "councilSeat": "The Shadow-Facing Warrior",
                  "coreFunction": "Shadow-facing victory; success that requires direct contact with the difficult material.",
                  "gift": "The gift of Bellatrix is courageous self-confrontation. It brings sharp intelligence, fighting spirit, strategic capacity, technical force, psychological honesty, and the ability to enter difficult material without collapsing. It supports people who can work with crisis, shadow, trauma, conflict, healing, surgery, protection, therapy, investigation, activism, art born from pain, or any field where success requires bravery rather than pleasantness.",
                  "shadowGate": "The Bellatrix shadow gate is the exposed weakness. The moment when the person sees something they would rather not see: fear, envy, rage, shame, avoidance, ambition, wounded pride, hunger for recognition, or the part of the self that uses pain as identity. This is not a failure. It is the gate. If the person can stay with the truth without collapsing into self-attack, Bellatrix becomes a star of fierce liberation.",
                  "councilMessage": "Do not fear the difficult place. Enter cleanly. Face what is yours, name what is true, and let the victory include your own becoming.",
                  "keywords": [
                    "Shadow-facing victory",
                    "Amazon Star",
                    "warrior intelligence",
                    "confrontation",
                    "courage",
                    "self-awareness"
                  ]
                },
                "alnilam-orion-belt": {
                  "councilSeat": "The Pearl-Belt Keeper",
                  "coreFunction": "The central binding cord; alignment, containment, and the ordering of power through the middle path.",
                  "gift": "The gift of Alnilam is organizing force. It brings the ability to hold multiple currents together without scattering, to bind skill, memory, discipline, ambition, and spiritual force into a coherent line. It can support builders, organizers, teachers, ceremonial workers, strategists, memory-keepers, system-makers, and people whose work requires central alignment. This is not soft coherence. It is the kind of coherence that comes from tension held correctly, like a belt fastened around a powerful body so the force can move without flying apart.",
                  "shadowGate": "The Alnilam shadow gate is the fear of losing containment. The person may sense great power, memory, ancestry, or pressure moving through them and respond by gripping the body, the role, the method, the identity, or the plan. The gate opens when they realize that containment is not the same as contraction. A true belt supports movement. A distorted belt restricts breath. Alnilam asks for disciplined alignment, not self-binding.",
                  "councilMessage": "Gather the pieces. Fasten only what supports the movement. The cord is not a prison; it is the line that lets the star-body walk whole.",
                  "keywords": [
                    "Central alignment",
                    "Orion Belt",
                    "String of Pearls",
                    "containment",
                    "organization",
                    "memory"
                  ]
                },
                "orion-nebula-ensis": {
                  "councilSeat": "The Nebula Midwife",
                  "coreFunction": "Star-memory entering form; the hidden birthing chamber inside the sword.",
                  "gift": "The gift of Orion Nebula is gestational vision. It brings the ability to sense what is forming before it is visible, named, or stable. This current can support artists, animators, channelers, mystics, symbolic thinkers, healers, somatic workers, ritualists, dream-readers, and people who can feel the pre-form architecture of a thing before it has arrived. It is not the finished teaching of Rigel or the visible achievement of Betelgeuse. It is the moment before the image appears, before the sentence lands, before the body knows what it is carrying. Orion Nebula gives contact with the unborn light.",
                  "shadowGate": "The Orion Nebula shadow gate is premature revelation. The person may want to name the mystery too quickly, prove the vision too soon, publish the symbol before it has integrated, or turn a delicate inner formation into a weapon, identity, or performance. The shadow is not sensitivity itself. The shadow is extraction. Orion Nebula asks: “Can you hold the unborn without tearing it open?” The correction is not silence forever. It is sacred timing.",
                  "councilMessage": "Do not cut the child from the cloud before it is ready. Hold the chamber. Let the light gather density. Birth only what can breathe.",
                  "keywords": [
                    "Incarnation portal",
                    "Orion Nebula",
                    "Ensis",
                    "star nursery",
                    "womb inside the sword",
                    "emergence"
                  ]
                },
                "rigel": {
                  "councilSeat": "The Star-Footed Teacher",
                  "coreFunction": "Knowledge given feet; wisdom made teachable, usable, and embodied.",
                  "gift": "The gift of Rigel is transmissible mastery. It brings the ability to learn deeply, organize knowledge, refine skill, and turn complexity into something another person can understand or practice. It supports teachers, builders, inventors, system-makers, craftspeople, animators, guides, scientists, technicians, and translators of difficult material. Rigel gives the kind of intelligence that wants to become a map, a method, a lesson, a tool, or a path.",
                  "shadowGate": "The Rigel shadow gate is the moment when competence becomes armor. The person may hide behind knowledge, technique, structure, or usefulness because not-knowing feels unsafe. They may also become loyal to an established worldview simply because it provides order. The correction is to remember that true knowledge stays alive. A real teaching does not dominate the student; it gives the student feet.",
                  "councilMessage": "Do not keep the knowledge as light above the head. Give it feet. Let the teaching become something another person can walk.",
                  "keywords": [
                    "Knowledge in motion",
                    "teaching",
                    "learning",
                    "craft",
                    "method",
                    "technical intelligence"
                  ]
                }
              },
              "andromeda": {
                "alpheratz": {
                  "councilSeat": "The Winged Liberator",
                  "coreFunction": "Liberated movement; the soul breaking from the binding story and reclaiming motion.",
                  "gift": "The gift of Alpheratz is liberated agency. It brings independence, quickness, courage, mental freshness, love of movement, inventive thought, social brightness, and the ability to act when a pattern has become too small. It can support explorers, writers, thinkers, rebels, reformers, travelers, performers, scientists, spiritual pioneers, and people who need to move beyond inherited structures. Alpheratz gives the feeling of wind returning to the field. It opens the gate where stillness had become captivity.",
                  "shadowGate": "The Alpheratz shadow gate is the moment when the old binding story is still alive in the nervous system. The person may be physically free, intellectually free, even socially free, but still organized around the memory of constraint. They may fight cages that are no longer there, or keep leaving before they discover whether the door was actually open. The correction is not submission. It is discernment: “Is this a cage, or is this a container for flight?”",
                  "councilMessage": "Move, but do not scatter. The gate is open. Let the wind return to your body, then choose the horizon that is truly yours.",
                  "keywords": [
                    "Alpheratz",
                    "Sirrah",
                    "Pegasus current",
                    "Andromeda threshold",
                    "freedom",
                    "movement"
                  ]
                },
                "mirach": {
                  "councilSeat": "The Girdle of the Living Field",
                  "coreFunction": "Creative receptivity; the fertile field that receives, listens, and turns what arrives into beauty, harmony, or wisdom.",
                  "gift": "The gift of Mirach is creative receptivity. It brings beauty, artistic sensitivity, relational intelligence, intuitive listening, emotional warmth, kindness, devotion, and the ability to make something useful or beautiful from what is received. It can support artists, dancers, animators, healers, musicians, counselors, philosophers, teachers, mediators, lovers of beauty, and people whose work depends on listening before forming. Mirach makes the inner field fertile enough that impressions become art, wisdom, care, or harmony.",
                  "shadowGate": "The Mirach shadow gate is the beautiful influence. The person may be drawn toward what feels harmonious, loving, artistic, familiar, or relationally soothing, even when it is not fully true. The gate opens when they can ask: “Is this actually nourishing, or only beautiful enough that I want it to be?” Mirach becomes sacred when the field remains open and the roots remain honest.",
                  "councilMessage": "Receive, but do not become everything you receive. Let the true seed take root. Let the rest return to the earth.",
                  "keywords": [
                    "Mirach",
                    "Beta Andromedae",
                    "Andromeda’s Girdle",
                    "fertile field",
                    "creative receptivity",
                    "listening"
                  ]
                }
              },
              "antares": {
                "antares": {
                  "councilSeat": "The Scorpion-Heart Initiator",
                  "coreFunction": "Transformational intensity; success through ordeal, but loss through unnecessary drama.",
                  "gift": "The gift of Antares is fierce transformational power. It gives courage in crisis, capacity for intensity, instinctive knowledge of death-rebirth thresholds, and the ability to face what others avoid. It can bring success through endurance, purification, confrontation, and willingness to enter the underworld rather than decorate the surface. Antares can make the person formidable, magnetic, driven, and almost impossible to turn away from a chosen purpose.",
                  "shadowGate": "The Antares shadow gate is the thrill of the crucible. Crisis can become identity. Struggle can become proof of devotion. Conflict can become the only place the person feels real. The shadow is not the intensity itself, but the inability to stop feeding it. This star’s deepest test is knowing when the death-rebirth process has become self-destruction.",
                  "councilMessage": "Enter the fire only when the fire is true. Do not build a throne in the underworld. When the work is complete, rise.",
                  "keywords": [
                    "Intensity",
                    "ordeal",
                    "underworld",
                    "transformation",
                    "obsession",
                    "crisis"
                  ]
                }
              },
              "aldebaran": {
                "aldebaran": {
                  "councilSeat": "The Red Oath-Keeper",
                  "coreFunction": "Integrity under fire; power that must remain clean.",
                  "gift": "The gift of Aldebaran is moral force. It gives courage, conviction, directness, leadership, and the ability to act decisively when something must be done. It supports people who can hold a vow, defend a principle, protect the material world, and bring vision into form without selling out the soul of the thing. Aldebaran can carry achievement, public recognition, and strong forward motion when the inner compass is intact.",
                  "shadowGate": "The Aldebaran shadow gate is the temptation point. Something is offered: status, money, belonging, safety, recognition, revenge, influence, relief. The question is simple and usually uncomfortable: “What would I have to betray in order to receive this?” If the answer is anything essential, Aldebaran says no. Not because the person should be small, but because the wrong yes destroys the path.",
                  "councilMessage": "Power is not the danger. Betrayal is. Walk through the fire with your hands empty of falsehood, and what is truly yours will remain.",
                  "keywords": [
                    "Integrity",
                    "oath",
                    "honor",
                    "sacred contract",
                    "clean power",
                    "moral test"
                  ]
                },
                "el-nath": {
                  "councilSeat": "The Horn-Point Shepherd",
                  "coreFunction": "Consecrated force; the weapon that can destroy or protect life depending on the consciousness that wields it.",
                  "gift": "The gift of El Nath is precise force in service of life. It brings courage, technical intelligence, strategic thought, sharp speech, scientific or philosophical strength, debate, advocacy, protection, and the ability to handle dangerous tools or charged subjects without pretending they are harmless. It can support scientists, lawyers, speakers, strategists, healers, surgeons, activists, negotiators, engineers, warriors, ritualists, and people whose work requires direct contact with power. El Nath can carry the weapon, but also the shepherd’s responsibility.",
                  "shadowGate": "The El Nath shadow gate is the weapon in the hand. The person may discover that they possess a skill, word, knowledge, tool, anger, influence, or technical capacity that can do real damage. They may fear their own force, or become seduced by it. The gate opens when they can pause before impact and ask: “Is this power protecting life, or proving itself?” El Nath becomes sacred when the weapon remembers the shepherd.",
                  "councilMessage": "Before the horn meets the world, remember what it serves. Force is not the failure. Unconscious aim is. Let the point protect life.",
                  "keywords": [
                    "El Nath",
                    "Bull’s North Horn",
                    "horn-point",
                    "point of attack",
                    "consecrated force",
                    "weapon"
                  ]
                }
              },
              "regulus": {
                "regulus": {
                  "councilSeat": "The Lion-Hearted Sovereign",
                  "coreFunction": "Noble power; sovereignty tested through revenge.",
                  "gift": "The gift of Regulus is dignified leadership. It brings courage, presence, command, charisma, public recognition, strategic force, and the ability to stand at the center of a field without collapsing under attention. It can support success, high position, protection, rulership, and the power to organize life around a noble principle. When coherent, Regulus does not dominate. It radiates authority from the heart.",
                  "shadowGate": "The Regulus shadow gate is the revenge threshold. The person may reach a point where they have been insulted, displaced, betrayed, ignored, underestimated, or publicly wounded. Something in the system says: “I could destroy this.” Regulus asks whether the person can remain royal in that exact moment. Not passive. Not weak. But clean. The real test is whether justice can be separated from revenge.",
                  "councilMessage": "Do not hand your crown to the wound. Let the heart remain seated. What is truly sovereign does not need to strike from humiliation.",
                  "keywords": [
                    "Noble power",
                    "sovereignty",
                    "heart-command",
                    "leadership",
                    "visibility",
                    "public success"
                  ]
                },
                "denebola": {
                  "councilSeat": "The Fringe-Seer",
                  "coreFunction": "The outsider lens; nonconforming perception that can invent the future or harden against the collective.",
                  "gift": "The gift of Denebola is outsider intelligence. It brings originality, invention, social observation, artistic edge, nonconforming thought, future-sight, critique, and the ability to see through the assumptions of the mainstream. It can support inventors, writers, artists, reformers, researchers, astrologers, social critics, designers, outsiders, futurists, and people whose work becomes meaningful precisely because it does not arise from the center. Denebola can see the pattern differently because it is not standing where everyone else is standing.",
                  "shadowGate": "The Denebola shadow gate is the lonely edge. The person may see something long before others do, or hold a truth the group does not yet have room for. They may respond by hardening, withdrawing, mocking the mainstream, or becoming dictatorial from the margins. The gate opens when they can ask: “What can the collective teach me, even if I see something it does not?” Denebola becomes sacred when difference remains permeable.",
                  "councilMessage": "Your difference is not the problem. Your contempt will make it unusable. Stand at the edge, see clearly, then build a bridge the center can cross.",
                  "keywords": [
                    "Denebola",
                    "Beta Leonis",
                    "Lion’s tail",
                    "outsider lens",
                    "fringe",
                    "nonconformity"
                  ]
                },
                "zosma": {
                  "councilSeat": "The Lion-Back Witness",
                  "coreFunction": "The crushed place; where powerlessness becomes witness, protection, and repair.",
                  "gift": "The gift of Zosma is witness-power. It brings empathy for the abused, capacity to see systemic harm, sensitivity to marginalization, fierce compassion, social conscience, and the ability to transform victimization into protection, advocacy, teaching, art, or repair. It can support healers, therapists, activists, writers, body-workers, trauma-integrators, social workers, carers, advocates, and people whose work gives voice to those who have been crushed by systems, families, cultures, or histories. Zosma knows the pressure point because it has felt weight there.",
                  "shadowGate": "The Zosma shadow gate is the powerless body. The person may carry a place in the system that expects to be overpowered: the back, the heart, the social self, the voice, the lineage, the sensitive function of the planet involved. The gate opens when they can ask: “Where was power taken, and what form of agency can return now?” Zosma becomes sacred when the crushed place is not asked to be grateful for being crushed, but is given support, witness, boundary, and repair.",
                  "councilMessage": "You do not have to call the crushing sacred. But the place that survived can become wise. Stand slowly. Let the back remember support.",
                  "keywords": [
                    "Zosma",
                    "Delta Leonis",
                    "Lion’s back",
                    "crushed place",
                    "victimization",
                    "systemic harm"
                  ]
                }
              },
              "eridanus": {
                "achernar": {
                  "councilSeat": "The River-End Responder",
                  "coreFunction": "Crisis current; the river-end where fast-moving events, fire, flood, and irreversible change must be met with clear action.",
                  "gift": "The gift of Achernar is crisis competence. It brings alertness, leadership under pressure, rapid assessment, emergency intelligence, courage, decisiveness, and the ability to act efficiently when conditions shift quickly. It can support emergency workers, healers, leaders, organizers, weather-sensitive people, activists, land stewards, crisis counselors, firefighters, flood responders, public servants, spiritual workers, and anyone whose path asks them to meet turbulent events without collapsing.",
                  "shadowGate": "The Achernar shadow gate is the permanent emergency. The person may feel that life only moves when something is on fire, flooding, breaking, or demanding immediate response. The gate opens when they can ask: “Is this an actual crisis, or has my system become loyal to urgency?” Achernar becomes sacred when the person can respond quickly and then return to the living river.",
                  "councilMessage": "When the river rises, act. When the river settles, stand down. Do not build your identity from the emergency.",
                  "keywords": [
                    "Achernar",
                    "Alpha Eridani",
                    "Eridanus",
                    "End of the River",
                    "crisis current",
                    "fire"
                  ]
                }
              },
              "crux": {
                "acrux": {
                  "councilSeat": "The Southern Cross Keeper",
                  "coreFunction": "Sacred alignment under pressure; the cross-point where devotion, justice, ceremony, and mystery become embodied responsibility.",
                  "gift": "The gift of Acrux is sacred responsibility. It brings ceremonial intelligence, spiritual authority, justice-orientation, magical or occult sensitivity, moral clarity, and the capacity to hold a sacred structure for others. It can support ritualists, astrologers, occultists, ceremonial workers, spiritual teachers, judges, advocates, healers, priests, priestesses, community elders, and people whose lives ask them to embody meaning rather than merely speak about it.",
                  "shadowGate": "The Acrux shadow gate is the burdened cross. The person may feel they must suffer, carry, atone, serve, or become spiritually serious in order to be worthy of the sacred. The gate opens when they can ask: “Is this alignment, or am I turning meaning into burden?” Acrux becomes sacred when the cross is no longer an instrument of punishment, but a structure of orientation.",
                  "councilMessage": "Stand where the lines meet, but do not nail yourself there. The sacred needs your alignment, not your suffering.",
                  "keywords": [
                    "Acrux",
                    "Alpha Crucis",
                    "Southern Cross",
                    "Crux",
                    "sacred alignment",
                    "ceremony"
                  ]
                }
              },
              "cancer": {
                "acubens": {
                  "councilSeat": "The Scarab Gate-Keeper",
                  "coreFunction": "Resurrection through the cradle of life; the hidden gate where difficult passage becomes rebirth.",
                  "gift": "The gift of Acubens is resurrectional perseverance. It brings survival intelligence, hidden strength, patience, protection, life-giving instinct, and the ability to move through difficult circumstances without losing the seed of renewal. It can support healers, protectors, midwives, ancestral workers, writers, researchers, ritualists, carers, gardeners, death-rebirth guides, and people who understand that the most important life processes are often quiet and concealed. Acubens gives the wisdom of the sheltering place: the chamber where life reforms before it reappears.",
                  "shadowGate": "The Acubens shadow gate is the sealed shelter. The person may know how to protect what is precious, but may not know when protection has become isolation. They may fear exposure because the renewed life still feels too soft, too strange, too breakable. The gate opens when they can ask: “Is this hidden because it is gestating, or hidden because I no longer trust life?” Acubens becomes sacred when the claw stops gripping and becomes a cradle.",
                  "councilMessage": "Do not mistake the shell for the life it protects. Guard the seed, yes — but remember that the seed is here to rise.",
                  "keywords": [
                    "Acubens",
                    "Alpha Cancri",
                    "Cancer",
                    "Crab’s claw",
                    "scarab",
                    "gateway of life"
                  ]
                }
              },
              "cygnus": {
                "deneb-adige": {
                  "councilSeat": "The Swan-Mystic Navigator",
                  "coreFunction": "Mystical flight through the ordinary; the swan-current that carries strength, artistry, learning, and transcendence into visible life.",
                  "gift": "The gift of Deneb Adige is inspired intelligence. It brings artistic perception, quick learning, scientific or symbolic skill, mystical seeing, spiritual courage, and the willingness to undertake a path of self-awareness. It can support artists, scientists, writers, mystics, animators, painters, healers, spiritual teachers, researchers, performers, and people whose work shows the sacred hidden in everyday forms. Deneb Adige gives the eye that can make an ordinary moment luminous.",
                  "shadowGate": "The Deneb Adige shadow gate is the defended wing. The person may feel that their inner sacred world must be protected from intrusion, mockery, or misunderstanding. They may strike out before being truly threatened. The gate opens when they can ask: “Am I defending the sacred, or preventing it from being shared?” Deneb Adige becomes sacred when strength protects the vision without imprisoning it.",
                  "councilMessage": "Do not flee the ordinary. Look again. The world is already luminous. Give the vision wings, then give it hands.",
                  "keywords": [
                    "Deneb Adige",
                    "Deneb",
                    "Alpha Cygni",
                    "Cygnus",
                    "Swan",
                    "World Egg"
                  ]
                }
              },
              "gemini": {
                "alhena": {
                  "councilSeat": "The Marked Foot Pilgrim",
                  "coreFunction": "Sacred contact with Earth; the marked foot, the wounded heel, and the determination to move anyway.",
                  "gift": "The gift of Alhena is embodied artistry and determined movement. It brings creative intelligence, artistic ability, symbolic grace, spiritual sensitivity, movement, teaching, mediumistic perception, and the capacity to make beauty or meaning from the wound of incarnation. It can support artists, dancers, animators, musicians, writers, healers, somatic workers, travelers, ritualists, and people who turn the mark of lived experience into refined expression. Alhena does not float above the path. It walks it.",
                  "shadowGate": "The Alhena shadow gate is the branded foot. The person may carry a felt sense of having been marked by something: a wound, taboo, defiance, exile, visibility, or difference. They may either hide the mark or display it as identity. The gate opens when they can ask: “How does this mark teach me to walk?” Alhena does not erase the wound. It changes the relationship to it, so the person can move without dragging the old verdict behind them.",
                  "councilMessage": "The Earth has touched you, and yes, it left a mark. But the mark is not a verdict. Place the foot down. Let the path answer.",
                  "keywords": [
                    "Alhena",
                    "Gamma Geminorum",
                    "Bright Foot of Gemini",
                    "Proudly Marching One",
                    "the Mark",
                    "brand"
                  ]
                },
                "castor": {
                  "councilSeat": "The Bright Twin Storykeeper",
                  "coreFunction": "Bright polarity; the storyteller who seeks wholeness from the side of form, language, and conscious pattern.",
                  "gift": "The gift of Castor is story-bridging intelligence. It brings language, writing, teaching, pattern recognition, wit, movement, symbolic skill, intellectual brightness, and the ability to hold two sides of a situation without immediately collapsing into one. It can support writers, poets, animators, teachers, lawyers, translators, storytellers, performers, psychics, researchers, riders, guides, and anyone whose work turns divided material into meaningful form. Castor gives the mind that can name the split and begin weaving it back toward wholeness.",
                  "shadowGate": "The Castor shadow gate is the projected twin. The person may meet someone, something, or some part of life that appears irrational, dark, excessive, wounded, or morally difficult, and instinctively place it outside themselves. The gate opens when they can ask: “What part of this polarity also belongs to me?” This does not mean excusing harm or flattening difference. It means reclaiming enough of the shadowed twin that the self can become whole rather than split between image and exile.",
                  "councilMessage": "Do not make the bright story false by cutting away its shadow. The twin you reject becomes the voice that follows you. Name both, and the path becomes whole.",
                  "keywords": [
                    "Castor",
                    "Alpha Geminorum",
                    "Gemini",
                    "bright twin",
                    "mortal twin",
                    "polarity"
                  ]
                },
                "pollux": {
                  "councilSeat": "The Shadow Twin Boxer",
                  "coreFunction": "Shadow polarity; the twin who enters the difficult side of the story so wholeness can be recovered.",
                  "gift": "The gift of Pollux is shadow-literate courage. It brings depth, bravery, instinctive intelligence, capacity for conflict, psychological honesty, storytelling power, and the ability to work with material that others avoid. It can support writers, fighters, trauma-workers, therapists, activists, artists, investigators, shadow-workers, healers, protectors, ritualists, and anyone who must enter the difficult chamber and come back with language. Pollux gives access to the part of the field that still hurts, but also still contains energy.",
                  "shadowGate": "The Pollux shadow gate is hard judgment. The person may see the painful truth clearly and then make it final. “This is what people are.” “This is how life works.” “This is what I must become to survive.” The gate opens when they can ask: “What would happen if this pain became part of the story, but not the whole story?” Pollux asks for the dark twin to be heard, not crowned as the only ruler.",
                  "councilMessage": "Do not leave the dark twin outside the door. But do not let pain become the only storyteller. Let the wound speak, then let the whole self answer.",
                  "keywords": [
                    "Pollux",
                    "Beta Geminorum",
                    "Gemini",
                    "immortal twin",
                    "Hercules",
                    "boxer"
                  ]
                }
              },
              "sagittarius": {
                "facies": {
                  "councilSeat": "The Archer’s Eye",
                  "coreFunction": "Penetrating focus; the archer’s stare that can achieve with ruthless force or become destructive when severed from care.",
                  "gift": "The gift of Facies is uncompromising focus. It brings drive, precision, leadership under pressure, strategic force, capacity to execute, ability to cut through noise, and the courage to face a target without flinching. It can support surgeons, leaders, activists, athletes, martial practitioners, researchers, crisis-workers, strategists, artists, commanders, and people whose work requires intense concentration. Facies can achieve what softer currents avoid because it refuses to look away.",
                  "shadowGate": "The Facies shadow gate is the target trance. The person may enter a state where the goal becomes everything. They may feel justified, chosen, pressured, or possessed by the line of action. The gate opens when they can ask: “Who or what disappears from my awareness when I focus?” Facies becomes sacred when the eye widens without losing aim.",
                  "councilMessage": "Your sight is strong enough to pierce distance. Do not let it pierce the living without care. Aim truly, but keep the heart in the line.",
                  "keywords": [
                    "Facies",
                    "M22 Sagittarius",
                    "Archer’s Face",
                    "Archer’s Eye",
                    "penetrating stare",
                    "ruthless focus"
                  ]
                },
                "rukbat": {
                  "councilSeat": "The Archer’s Stance-Keeper",
                  "coreFunction": "The archer’s stance; steadiness, skill, and the capacity to hold aim over time.",
                  "gift": "The gift of Rukbat is reliable strength. It brings consistency, endurance, physical steadiness, philosophical stability, skill-building, long-term discipline, and the capacity to keep showing up without needing constant novelty. It can support athletes, actors, teachers, builders, healers, martial practitioners, craftspeople, spiritual practitioners, researchers, land-workers, leaders, and anyone whose work depends on repeated practice rather than sudden brilliance. Rukbat gives the ground under the arrow.",
                  "shadowGate": "The Rukbat shadow gate is the frozen stance. The person may confuse stability with immobility, loyalty with fixation, or discipline with refusal to change. The gate opens when they can ask: “Is this stance still supporting the aim?” Rukbat becomes sacred when steadiness remains alive enough to adjust without collapsing.",
                  "councilMessage": "Do not rush the arrow. Find the ground. Let the stance become true, and the aim will learn where it belongs.",
                  "keywords": [
                    "Rukbat",
                    "Alpha Sagittarii",
                    "Sagittarius",
                    "Archer’s stance",
                    "Rock of Gibraltar",
                    "steadiness"
                  ]
                },
                "galactic-center": {
                  "councilSeat": "The Galactic Axis Keeper",
                  "coreFunction": "The deep origin point; gravitational memory, cosmic orientation, and the pull toward the larger pattern.",
                  "gift": "The gift of Galactic Center is cosmic orientation. It brings the ability to sense scale, pattern, deep time, soul architecture, collective movement, and the hidden gravity behind events. It can support mystics, astrologers, philosophers, researchers, system-builders, channelers, teachers, galactic workers, ritualists, and people who feel called to interpret large fields rather than isolated details. At its best, this current helps a person perceive the invisible structure behind the visible story.",
                  "shadowGate": "The Galactic Center shadow gate is the abyss of significance. The person may sense something enormous moving beneath the life and become afraid that ordinary tasks are too small, or that their life must constantly serve a vast mission. The correction is not to reject the cosmic field. It is to right-size it. Galactic Center asks: “Can you belong to the immense without abandoning the immediate?”",
                  "councilMessage": "You are not here to become the whole galaxy. You are here to let the greater turning find one clean point of embodiment. Let the vast become simple enough to live.",
                  "keywords": [
                    "Galactic Center",
                    "Sagittarius A*",
                    "Milky Way core",
                    "galactic axis",
                    "deep origin",
                    "cosmic orientation"
                  ]
                }
              },
              "centaurus": {
                "agena": {
                  "councilSeat": "The Wounded Reformer",
                  "coreFunction": "The wound that drives transformation; sacrifice, correction, and change born through pressure, pain, and the need for growth.",
                  "gift": "The gift of Agena is transformative force. It brings the ability to challenge stale norms, catalyze change, push growth through resistance, and remain concerned with what must be corrected even when the process is uncomfortable. It can support reformers, activists, healers, leaders, artists, pioneers, therapists, teachers, and people whose path forces them to confront the cost of change. Agena gives courage in the middle of difficult transformation.",
                  "shadowGate": "The Agena shadow gate is the sacrificial compulsion. The person may feel that they must always pay heavily, disrupt deeply, or endure dramatically in order for anything real to happen. The gate opens when they can ask: “Is this transformation necessary, or am I reenacting the belief that growth only comes through pain?” Agena becomes sacred when sacrifice becomes conscious rather than compulsive.",
                  "councilMessage": "Do not offer suffering to the altar when truth alone would do. Let the wound teach, but do not build your home inside it.",
                  "keywords": [
                    "Agena",
                    "Beta Centauri",
                    "Hadar",
                    "horse’s belly",
                    "Chiron’s wound",
                    "sacrifice"
                  ]
                },
                "toliman": {
                  "councilSeat": "The Healer’s Foot",
                  "coreFunction": "The healing step forward; education, care, and growth through the path of the teacher-healer.",
                  "gift": "The gift of Toliman is healing through living contact. It brings education, mentoring, broadening of perspective, kindness, concern for the greater good, and the ability to help others grow through one’s presence, teaching, or care. It can support teachers, guides, therapists, animators, healers, social reformers, parents, tutors, writers, bridge-builders, and people whose lives push them toward helping others see more, know more, or heal more. Toliman gives the capacity to move toward pain without being ruled by it.",
                  "shadowGate": "The Toliman shadow gate is the burdened healer. The person may feel that growth, care, and correction are always their responsibility, or that their life only has value when it serves a cause. The gate opens when they can ask: “Am I helping because I am called, or because I cannot imagine who I am without the role?” Toliman becomes sacred when the path of service includes the self.",
                  "councilMessage": "Do not only know the medicine. Walk it. But do not forget that the foot that carries the remedy also needs care.",
                  "keywords": [
                    "Toliman",
                    "Alpha Centauri",
                    "Rigil Kentaurus",
                    "Centaur’s Foot",
                    "Chiron",
                    "healer"
                  ]
                }
              },
              "cepheus": {
                "alderamin": {
                  "councilSeat": "The Future-Pole Steward",
                  "coreFunction": "Alderamin carries the current of authority that has not fully arrived yet, but is already being prepared in the body. It is the star of the future axis: the one who learns to hold orientation before the world has agreed where north is. As the brightest star in Cepheus, and traditionally connected with the King’s right arm, Alderamin is not the crown itself, but the arm that acts on behalf of the crown. Its function is to turn sovereignty into responsible movement, judgment into service, and long-range orientation into something useful, protective, and embodied.",
                  "gift": "Alderamin gives long-range orientation, mature judgment, stabilizing presence, and the ability to hold responsibility without needing immediate recognition. It supports the person who can sense the future shape of a thing before others see it, then quietly begin building toward it. This current can carry the gift of wise governance, ethical decision-making, practical leadership, arbitration, guardianship, and the ability to act as a steady arm for a larger purpose.",
                  "shadowGate": "The Trial of Authority. This shadow gate opens when the person is tested through responsibility, delay, judgment, leadership pressure, or the feeling of carrying more than their share. The unfinished edge is learning that true authority does not come from control, endurance, or being unshakable. It comes from alignment, timing, humility, and the willingness to act only from the part of the self that is actually seated.",
                  "councilMessage": "Do not rush to become the center. Let time shape you. The axis that will one day guide must first learn stillness, humility, and right action. You are not here to carry the kingdom alone. You are here to become trustworthy enough that what moves through your hand can serve the whole field.",
                  "keywords": [
                    "future pole",
                    "sober authority",
                    "stewardship",
                    "right action",
                    "long-range orientation",
                    "ethical leadership"
                  ]
                }
              },
              "crater": {
                "alkes": {
                  "councilSeat": "The Grail-Vessel Keeper",
                  "coreFunction": "The vessel that carries what is precious; sacred receptivity, spiritual inheritance, and group-held meaning.",
                  "gift": "The gift of Alkes is sacred containment. It brings spiritual receptivity, prophetic sensitivity, group devotion, ritual intelligence, care for lineage, and the ability to hold something meaningful for others without immediately defining it as personal property. It can support healers, priests, priestesses, artists, writers, ancestral workers, ritualists, teachers, guardians of tradition, community holders, and anyone whose life asks them to become a vessel for ideas, medicine, creativity, memory, or blessing.",
                  "shadowGate": "The Alkes shadow gate is the overfilled cup. The person may carry too much for the group, the lineage, the clients, the ancestors, the family, or the collective. They may feel honored by the role and quietly exhausted by it. The gate opens when they can ask: “What am I carrying, and who or what is meant to help hold it?” Alkes becomes sacred when containment becomes shared and sustainable.",
                  "councilMessage": "Hold what is precious, but do not become trapped inside the cup. A vessel must be filled, emptied, washed, and rested.",
                  "keywords": [
                    "Alkes",
                    "Alpha Crateris",
                    "Crater",
                    "the Cup",
                    "sacred vessel",
                    "Holy Grail"
                  ]
                }
              },
              "hydra": {
                "alphard": {
                  "councilSeat": "The Serpent-Heart Alchemist",
                  "coreFunction": "Conscious passion; the serpent-heart where primal emotion, life-force, and old unconscious power must be met without striking back.",
                  "gift": "The gift of Alphard is conscious passion. It brings emotional depth, artistic intensity, knowledge of human nature, shadow perception, embodied life-force, and the capacity to transform poison into medicine. It can support artists, poets, musicians, therapists, shadow-workers, somatic practitioners, ritualists, writers, activists, and people who must learn to carry strong feeling without becoming destructive. Alphard gives access to the serpent-heart beneath civilization.",
                  "shadowGate": "The Alphard shadow gate is the venom response. The person may feel wronged, threatened, desired, rejected, or overwhelmed and want to strike, seduce, withdraw, intoxicate, expose, punish, or destroy. The gate opens when they can ask: “What is the feeling underneath the venom?” Alphard becomes sacred when the poison is traced back to the wounded heart and given a vessel.",
                  "councilMessage": "Do not strike before you know the wound. The serpent is not evil because it carries venom. Venom becomes medicine when consciousness enters the heart.",
                  "keywords": [
                    "Alphard",
                    "Alpha Hydrae",
                    "Cor Hydra",
                    "Heart of the Serpent",
                    "Hydra",
                    "serpent-heart"
                  ]
                }
              },
              "corona_borealis": {
                "alphecca": {
                  "councilSeat": "The Thorn-Crowned Jewel",
                  "coreFunction": "The offered crown; advancement, beauty, honor, and social elevation that must be weighed against the cost.",
                  "gift": "The gift of Alphecca is graceful advancement. It brings charm, artistry, poetic intelligence, beauty, social lift, honor, dignity, and the ability to be recognized or elevated through relational, artistic, or symbolic pathways. It can support artists, public figures, healers, poets, ceremonial workers, leaders, partners of visible people, priestesses, designers, counselors, and those whose lives involve receiving or holding a role that changes their standing. Alphecca gives the jewel, but the jewel is never just decorative.",
                  "shadowGate": "The Alphecca shadow gate is the costly gift. The person may be offered something beautiful that changes their position: a relationship, title, platform, role, invitation, artistic opening, or public recognition. The gate opens when they can ask: “What does this crown require of my life-force, body, privacy, and truth?” Alphecca becomes sacred when the person can accept only the crown they can inhabit cleanly.",
                  "councilMessage": "Not every crown is yours to wear. Weigh the gift, feel the thorn, and accept only what your body can inhabit with truth.",
                  "keywords": [
                    "Alphecca",
                    "Alpha Coronae Borealis",
                    "Gemma",
                    "Northern Crown",
                    "Ariadne’s Crown",
                    "Crown of Thorns"
                  ]
                }
              },
              "pisces": {
                "al-rescha": {
                  "councilSeat": "The Knot-Weaver",
                  "coreFunction": "The knot of union; bringing separate strands of knowledge, meaning, or being into living connection.",
                  "gift": "The gift of Al Rescha is integrative intelligence. It brings synthesis, symbolic understanding, pattern recognition, relational linking, interdisciplinarity, depth psychology, mythic thinking, and the ability to connect ideas, people, systems, and fields into meaningful coherence. It can support therapists, astrologers, teachers, researchers, artists, writers, bridge-builders, philosophers, inventors, spiritual workers, and anyone whose work depends on joining what others keep apart. Al Rescha does not merely collect fragments. It knots them into living meaning.",
                  "shadowGate": "The Al Rescha shadow gate is indiscriminate merging. The person may over-identify with others, over-fuse disciplines, or attempt to create unity by dissolving necessary boundaries. They may be unable to tell where one strand ends and another begins. The gate opens when they can ask: “What genuinely belongs together, and what must remain distinct?” Al Rescha becomes sacred when union is intelligent rather than indiscriminate.",
                  "councilMessage": "Do not merge everything. Find the true knot. Where the strands genuinely meet, understanding is born.",
                  "keywords": [
                    "Al Rescha",
                    "Alrisha",
                    "Alpha Piscium",
                    "Knot of the Fishes",
                    "synthesis",
                    "union"
                  ]
                }
              },
              "aquila": {
                "altair": {
                  "councilSeat": "The Fire-Eagle Pathfinder",
                  "coreFunction": "Bold ascent; the eagle-force that rises, risks, and carries action into new territory.",
                  "gift": "The gift of Altair is courageous ascent. It brings boldness, determination, leadership, exploration, risk-tolerance, speed, vision, and the ability to act decisively when life calls for movement. It can support pioneers, activists, inventors, pilots, travelers, athletes, leaders, artists, scientists, reformers, public figures, and people whose work requires them to go where others have not yet gone. Altair gives the eagle’s capacity to rise above the known field and see the road from a higher angle.",
                  "shadowGate": "The Altair shadow gate is the burning ascent. The person may feel the call to move fast, prove courage, break out, lead, fly, or take the risk before the body has assessed consequence. The gate opens when they can ask: “Am I rising because the mission calls, or because the height proves something?” Altair becomes sacred when the eagle’s fire remembers what it is carrying.",
                  "councilMessage": "Rise, but do not abandon the earth. The height is not the mission. The fire you carry must know where it is meant to land.",
                  "keywords": [
                    "Altair",
                    "Alpha Aquilae",
                    "Aquila",
                    "Eagle",
                    "fire-eagle",
                    "bold ascent"
                  ]
                }
              },
              "phoenix": {
                "ankaa": {
                  "councilSeat": "The Phoenix Memory-Keeper",
                  "coreFunction": "Cyclic regeneration; the soul rising from the old ash with memory intact.",
                  "gift": "The gift of Ankaa is regenerative intelligence. It brings the ability to pass through collapse, loss, disorientation, or identity-change without losing the inner thread of meaning. It can support mythologists, healers, artists, teachers, spiritual workers, trauma-integrators, death-rebirth guides, writers, ritualists, and people whose lives or work involve translating destruction into wisdom. Ankaa does not simply survive. It metabolizes the ending until the ash becomes instruction.",
                  "shadowGate": "The Ankaa shadow gate is the ash-field. The person may find themselves standing in the aftermath of a life, identity, relationship, belief, body-pattern, or vocation that no longer exists in the old way. The danger is either despair — believing the ash is the end — or inflation — believing every fire proves chosenness. The gate opens when the person can ask: “What survived because it is essential?” Ankaa teaches that the true self is not the old form. It is the pattern that can rise through many forms.",
                  "councilMessage": "You are not the ash, and you are not only the flame. You are the pattern that knows how to return. Let what has ended become warmth, not identity.",
                  "keywords": [
                    "Ankaa",
                    "Phoenix",
                    "Nair al Zaurak",
                    "Bright One in the Boat",
                    "regeneration",
                    "rebirth"
                  ]
                }
              },
              "carina": {
                "canopus": {
                  "councilSeat": "The Great Navigator",
                  "coreFunction": "The great navigator; leadership through unknown waters and the responsibility of control.",
                  "gift": "The gift of Canopus is navigational leadership. It brings wide knowledge, strategic perception, steadiness under pressure, capacity to guide others through unfamiliar terrain, and the ability to find new directions when the old world has ended. It can support teachers, explorers, leaders, artists, reformers, captains, cultural pathfinders, death-workers, spiritual guides, travelers, and people whose work creates passage where no passage previously existed. Canopus is not merely adventurous. It is responsible for the vessel.",
                  "shadowGate": "The Canopus shadow gate is the captain’s burden. The person may feel that if they loosen control, the ship will break, the people will scatter, or the mission will fail. They may become heavy with responsibility, stern with uncertainty, or willing to override others “for the sake of the voyage.” The correction is not passivity. It is shared navigation. Canopus asks: “Can you steer without becoming the sea?”",
                  "councilMessage": "Hold the course, but do not bind the passengers to your hand. The ship is sacred because it carries many souls. Guide the crossing; do not become its master.",
                  "keywords": [
                    "Canopus",
                    "Great Navigator",
                    "Argo",
                    "Great Ship",
                    "keel",
                    "pilot"
                  ]
                }
              },
              "auriga": {
                "capella": {
                  "councilSeat": "The Chariot-Nurse of the Wild Field",
                  "coreFunction": "Free-moving nurture; the fertile, independent force that carries life forward through motion, protection, speed, and skill.",
                  "gift": "The gift of Capella is independent nurturance. It brings curiosity, quickness, learning, movement, protection, maternal or generative intelligence, skill with travel or vehicles, and the ability to support life without becoming possessive or immobile. It can support pilots, teachers, mothers, midwives, animators, healers, travelers, guides, inventors, animal workers, performers, writers, and people who need freedom in order to care well. Capella gives the capacity to carry others, ideas, or living projects across distance without losing one’s own wildness.",
                  "shadowGate": "The Capella shadow gate is the violated life-force. In the Macha current, sacred fertility is forced to perform for power, speed, pride, or public proof. The person may carry a pattern of having to prove capacity while exhausted, pregnant with an idea, vulnerable, or overburdened. The gate opens when they can ask: “Am I moving because life wants to move, or because power demanded proof?” Capella becomes sacred when the living body is no longer sacrificed to the race.",
                  "councilMessage": "Do not race because they command it. Move because life is ready. Feed what is sacred, carry it wisely, and keep your own wildness alive.",
                  "keywords": [
                    "Capella",
                    "Alpha Aurigae",
                    "Little She-Goat",
                    "Amalthea",
                    "Auriga",
                    "Charioteer"
                  ]
                }
              },
              "capricornus": {
                "deneb-algedi": {
                  "councilSeat": "The Goat-Tail Lawkeeper",
                  "coreFunction": "Protective law; wisdom, justice, and authority used to guard the people rather than dominate them.",
                  "gift": "The gift of Deneb Algedi is protective authority. It brings wisdom, integrity, counsel, judgment, responsibility, social guardianship, and the ability to lead through knowledge rather than domination. It can support advisers, lawyers, teachers, elders, community leaders, spiritual workers, organizers, protectors, policymakers, counselors, and people who must hold structure for others. Deneb Algedi gives the instinct to help through leadership: not by disappearing into service, but by holding the form that makes life safer.",
                  "shadowGate": "The Deneb Algedi shadow gate is the judicial burden. The person may feel responsible for fixing, saving, organizing, advising, or morally correcting the field around them. They may become exhausted by the role of protector, or hardened by the failures of others. The gate opens when they can ask: “Am I protecting life, or trying to control uncertainty?” Deneb Algedi becomes sacred when responsibility is joined to humility.",
                  "councilMessage": "Do not make law colder than life. Hold the structure, yes — but remember why it was built. Authority becomes sacred when the people can breathe inside it.",
                  "keywords": [
                    "Deneb Algedi",
                    "Delta Capricorni",
                    "Tail of the Goat",
                    "Judicial Point of the Goat",
                    "protective law",
                    "justice"
                  ]
                }
              },
              "coma_berenices": {
                "diadem": {
                  "councilSeat": "The Hair-Crowned Devotee",
                  "coreFunction": "Sacred offering of power; feminine strength surrendered, crowned, or reclaimed through devotion.",
                  "gift": "The gift of Diadem is devoted strength. It brings loyalty, feminine power, protective love, courage through devotion, sacred offering, creative vitality, and the ability to use personal power on behalf of what is loved. It can support artists, writers, healers, caretakers, partners, mothers, priestesses, activists, and people who offer something of themselves for a meaningful cause. Diadem gives the strength to love fiercely without needing to perform force.",
                  "shadowGate": "The Diadem shadow gate is the cut hair. The person may carry a memory of giving away creative force, beauty, sovereignty, or feminine strength for love, safety, loyalty, grief, or survival. The gate opens when they can ask: “What power did I offer away, and does that vow still serve life?” Diadem becomes sacred when the offering is honored and the crown is reclaimed.",
                  "councilMessage": "Do not call every loss an offering. What is given freely becomes a blessing. What is taken from your life-force must be reclaimed.",
                  "keywords": [
                    "Diadem",
                    "Alpha Comae Berenices",
                    "Berenice’s Hair",
                    "small crown",
                    "feminine strength",
                    "sacred offering"
                  ]
                }
              },
              "piscis_australis": {
                "fomalhaut": {
                  "councilSeat": "The Dream-Keeper of the Southern Gate",
                  "coreFunction": "The sacred ideal; vision that must remain pure enough to serve more than the self.",
                  "gift": "The gift of Fomalhaut is inspired vision. It gives charisma, beauty, mysticism, poetic intelligence, artistic force, spiritual sensitivity, and the ability to hold an image of life that others cannot yet imagine. It can support reformers, artists, mystics, musicians, dreamers, inventors, lovers, and people who are willing to step outside social agreement for a higher pattern. At its best, Fomalhaut makes the unseen future feel emotionally real.",
                  "shadowGate": "The Fomalhaut shadow gate is intoxication with the beautiful image. The person may fall in love with possibility, romance, spiritual destiny, poetic suffering, or the feeling of being chosen by the dream. The question becomes: “Is this vision still serving life, or has it begun to serve my need to be exceptional?” The correction is not cynicism. The correction is motive purification.",
                  "councilMessage": "Do not abandon the vision because the world cannot yet see it. But do not use the vision to escape the world. Keep the dream pure, and give it hands.",
                  "keywords": [
                    "Sacred ideal",
                    "mysticism",
                    "beauty",
                    "vision",
                    "dream",
                    "charisma"
                  ]
                }
              },
              "aries": {
                "hamal": {
                  "councilSeat": "The Horned Initiator",
                  "coreFunction": "Independent force; the horned will breaking from imposed authority.",
                  "gift": "The gift of Hamal is sovereign initiative. It brings motivation, courage, focus, directness, independence, and the ability to act when others are still asking permission. It can support pioneers, leaders, activists, mystics, messengers, entrepreneurs, athletes, warriors, reformers, and people who must break from inherited authority in order to follow an inner command. Hamal gives the power to begin from the self, even when the world does not approve.",
                  "shadowGate": "The Hamal shadow gate is the authority wound. The person may carry a memory — personal, ancestral, cultural, or spiritual — of being controlled, shamed, demonized, or punished for direct life-force. The old horned current may have been labeled dangerous because it could not be easily governed. The gate opens when the person can ask: “Am I following my true will, or am I fighting the old authority again?” Hamal asks for self-command, not perpetual rebellion.",
                  "councilMessage": "Lower the head only when the path truly needs opening. Your force is not wrong. But it must know what it serves.",
                  "keywords": [
                    "Hamal",
                    "Alpha Arietis",
                    "Ram’s Horn",
                    "horned will",
                    "independence",
                    "direct action"
                  ]
                }
              },
              "pegasus": {
                "markab": {
                  "councilSeat": "The Saddle-Bearer of Pegasus",
                  "coreFunction": "Stability in motion; the saddle-point that lets great movement, science, action, or flight be carried without collapse.",
                  "gift": "The gift of Markab is stable capacity. It brings reliability, leadership under pressure, intellectual structure, mathematical or technical skill, crisis steadiness, and the ability to become the solid point on which a larger movement can rest. It can support scientists, mathematicians, engineers, astronauts, pilots, leaders, teachers, strategists, animators, builders, organizers, and people whose work requires calm steadiness while the field is in motion. Markab gives the seat that lets the flight continue.",
                  "shadowGate": "The Markab shadow gate is the thrown rider. The person may try to use intelligence, leadership, skill, or spiritual ambition to rise beyond their actual integration. Or they may fear being thrown down and become overly controlling. The gate opens when they can ask: “Am I seated, or am I gripping?” Markab becomes sacred when stability supports movement rather than dominating it.",
                  "councilMessage": "Hold the seat, not the sky. The horse was made to move. Your steadiness is sacred only when it lets the flight continue.",
                  "keywords": [
                    "Markab",
                    "Alpha Pegasi",
                    "Pegasus",
                    "Saddle",
                    "Great Square",
                    "stability in motion"
                  ]
                },
                "scheat": {
                  "councilSeat": "The Flood-Mind Architect",
                  "coreFunction": "Unbounded mental flow; creative intelligence that can become genius when structured, or turbulence when uncontained.",
                  "gift": "The gift of Scheat is vast mental creativity. It brings genius, original thought, symbolic perception, scientific imagination, psychological insight, invention, and the ability to move beyond the known square of thought. It can support scientists, mathematicians, astrologers, mystics, psychologists, animators, writers, researchers, inventors, dream-workers, and people whose minds receive more than the ordinary framework can explain. Scheat gives access to the flood of possibility behind established knowledge.",
                  "shadowGate": "The Scheat shadow gate is the uncontained current. The person may feel a rush of ideas, images, predictions, fears, or creative possibilities and assume that the intensity means immediate truth. The gate opens when they can ask: “Is this a revelation, a fantasy, a fear-current, or raw material?” Scheat becomes sacred when the flood is not denied, but given banks.",
                  "councilMessage": "Do not drown in what you can perceive. Build the channel. The flood is not here to destroy the mind — it is here to carve a new riverbed.",
                  "keywords": [
                    "Scheat",
                    "Beta Pegasi",
                    "Pegasus",
                    "Great Square",
                    "flood-mind",
                    "mental creativity"
                  ]
                }
              },
              "cetus": {
                "menkar": {
                  "councilSeat": "The Deep-Sea Witness",
                  "coreFunction": "The collective deep; unconscious forces rising from below the human ocean.",
                  "gift": "The gift of Menkar is deep collective sensing. It brings access to dreams, images, archetypes, symbolic material, ancestral undercurrents, collective pain, and the ability to create or speak from what lies beneath the surface. It can support psychologists, artists, myth-workers, writers, astrologers, dream-workers, filmmakers, social observers, healers, historians, ritualists, and people whose work brings hidden collective material into form. Menkar can make someone a translator of the deep human ocean.",
                  "shadowGate": "The Menkar shadow gate is the engulfing deep. The person may sense something huge moving under life and feel powerless against it. They may confuse collective weather with personal failure, or believe that because a force is large it must be destiny. The gate opens when they can ask: “Is this mine, ancestral, collective, or archetypal?” Menkar becomes sacred when the deep is witnessed without surrendering the steering of the vessel.",
                  "councilMessage": "Do not call every wave your own. The ocean is speaking, but you are not the whole sea. Give the deep a vessel, and it becomes wisdom.",
                  "keywords": [
                    "Menkar",
                    "Alpha Ceti",
                    "Cetus",
                    "Whale",
                    "sea monster",
                    "collective unconscious"
                  ]
                }
              },
              "columba": {
                "phact": {
                  "councilSeat": "The Dove Scout",
                  "coreFunction": "Exploration of the unknown; the dove that remembers it once flew from the ship.",
                  "gift": "The gift of Phact is hopeful exploration. It brings curiosity, artistic sensitivity, imaginative intelligence, subtle perception, mediumistic openness, and the ability to move into unknown fields without becoming brutalized by them. It can support artists, inventors, dream-workers, researchers, animators, healers, travelers, spiritual explorers, psychonauts, and anyone whose work involves testing the invisible edge of what is possible. Phact carries the rare combination of tenderness and adventure: a wing strong enough to cross the void without losing its gentleness.",
                  "shadowGate": "The Phact shadow gate is the open water moment. The person may sense that a new world exists, but there is no proof yet. They may be tempted either to remain safely contained or to fly off without grounding. The gate opens when they learn to explore without abandoning orientation. Phact asks: “Can you enter the unknown and still remember the ship, the body, the purpose, and the way back?”",
                  "councilMessage": "Fly, but do not vanish. The unknown is calling, but the gift is not the leaving. The gift is what you bring back.",
                  "keywords": [
                    "Phact",
                    "Alpha Columbae",
                    "Columba Noae",
                    "dove scout",
                    "Noah’s Dove",
                    "Argo memory"
                  ]
                }
              },
              "perseus": {
                "algol": {
                  "councilSeat": "The Medusa Flame-Keeper",
                  "coreFunction": "Primal power reclaimed from demonization; raw life-force that must be contained, not suppressed.",
                  "gift": "The gift of Algol is immense life-force. It brings intensity, passion, survival power, refusal of injustice, raw creativity, sexual vitality, volcanic truth, and the ability to face material that many people cannot tolerate. It can support artists, activists, trauma workers, protectors, shadow-workers, healers, performers, body-workers, and people who can metabolize difficult force without pretending it is gentle. At its highest, Algol does not destroy life. It defends the life-force that has been made monstrous by fear.",
                  "shadowGate": "The Algol shadow gate is the Medusa moment: the place where one has been made into an object of fear, desire, projection, punishment, or shame. The person may carry material around violation, powerlessness, sexualized perception, suppressed rage, ancestral terror, or being punished for potency. The gate opens when the person can say: “This force is mine, but it does not get to rule me unconsciously.” Algol asks for the head to be reattached to the body, the instinct to be brought back into awareness, the rage to be given a container strong enough to transform it.",
                  "councilMessage": "The force they feared was never evil because it was strong. But strength without a vessel becomes a curse. Bring the fire back into the body. Let the monster become medicine.",
                  "keywords": [
                    "Algol",
                    "Medusa",
                    "Lilith",
                    "Demon’s Head",
                    "Caput Medusae",
                    "primal power"
                  ]
                },
                "capulus": {
                  "councilSeat": "The Sword-Bearer of Sight",
                  "coreFunction": "Focused force; the sword-current of decisive action, penetration, and consequence.",
                  "gift": "The gift of Capulus is decisive focus. It brings courage, sharp perception, vitality, directness, technical precision, physical potency, sexual force, and the ability to take action where others hesitate. It can support surgeons, artists, activists, protectors, athletes, makers, performers, body-workers, martial practitioners, trauma-workers, and anyone whose work requires clean force under pressure. Capulus gives the power to pierce through fog and make contact with the real.",
                  "shadowGate": "The Capulus shadow gate is the blind strike. The person may feel a clear impulse to act, but the field has not been fully perceived. They may mistake intensity for truth, urgency for timing, or the ability to cut through something for the right to do so. The gate opens when the person pauses long enough to ask: “Am I acting from clarity, or am I discharging pressure?” Capulus becomes trustworthy when the blade is joined to sight.",
                  "councilMessage": "Do not fear the blade. Fear the hand that has forgotten to see. Let the force become clear, grounded, and exact. Then act only where the cut serves life.",
                  "keywords": [
                    "Capulus",
                    "Perseus sword",
                    "sword hand",
                    "focused force",
                    "blade-current",
                    "decisive action"
                  ]
                },
                "mirfak": {
                  "councilSeat": "The Young Warrior of Perseus",
                  "coreFunction": "Young warrior force; charged courage, challenge, pride, and the urge to prove strength through action.",
                  "gift": "The gift of Mirfak is bold active courage. It brings physical vitality, confidence, fighting spirit, competitive drive, willingness to challenge, and the ability to mobilize force quickly. It can support athletes, activists, leaders, performers, pioneers, builders, entrepreneurs, defenders, public challengers, warriors of a cause, and people who must push through resistance to make something happen. Mirfak gives the spark that refuses to stay passive when action is needed.",
                  "shadowGate": "The Mirfak shadow gate is the trophy wound. The person may feel they must prove strength, win the challenge, display courage, or claim the prize in order to be respected. The gate opens when they can ask: “Am I acting from true purpose, or trying to prove I am strong?” Mirfak becomes sacred when the warrior can stand down without losing dignity.",
                  "councilMessage": "Strength does not disappear when you pause. The true warrior knows when to charge, when to train, and when to lower the sword.",
                  "keywords": [
                    "Mirfak",
                    "Alpha Persei",
                    "Perseus",
                    "young warrior",
                    "fighting spirit",
                    "courage"
                  ]
                }
              },
              "canis_minor": {
                "procyon": {
                  "councilSeat": "The Quick Hound Pathfinder",
                  "coreFunction": "Fast rising before the greater light; cleverness, urgency, and early movement that must be grounded before it becomes chaos.",
                  "gift": "The gift of Procyon is rapid practical intelligence. It brings quick perception, tactical planning, adaptability, alertness, problem-solving, courage under pressure, and the ability to rise quickly through effort. It can support strategists, teachers, technicians, healers, emergency workers, animators, writers, speakers, inventors, activists, animal workers, and people who need to respond before the situation becomes obvious to everyone else. Procyon can see the opening early and move.",
                  "shadowGate": "The Procyon shadow gate is the early leap. The person may sense the opening before others and feel compelled to act immediately. Sometimes this is exactly right. Sometimes it is nervous acceleration. The gate opens when they can ask: “Is this the true moment, or am I reacting to the pressure of being first?” Procyon becomes sacred when the quick dog learns to listen before it bolts.",
                  "councilMessage": "Move quickly only after you have heard the ground. The first to sense the dawn must not become the first to scatter it.",
                  "keywords": [
                    "Procyon",
                    "Alpha Canis Minoris",
                    "Canis Minor",
                    "Lesser Dog",
                    "before Sirius",
                    "quick hound"
                  ]
                }
              },
              "hercules": {
                "ras-algethi": {
                  "councilSeat": "The Kneeling Order-Keeper",
                  "coreFunction": "Sacred order; the human posture of reverence before something larger than the self.",
                  "gift": "The gift of Ras Algethi is sacred orientation. It brings reverence, ecological instinct, moral alignment, devotion to balance, respect for nature, service to a higher principle, and the capacity to reorder life around what is true. It can support spiritual workers, environmentalists, teachers, healers, activists, ritualists, land stewards, philosophers, reformers, and people whose work asks them to restore correct relationship where life has become distorted. Ras Algethi gives purpose through alignment.",
                  "shadowGate": "The Ras Algethi shadow gate is kneeling to the wrong altar. The person may give loyalty, devotion, time, or obedience to something that claims sacred authority but does not actually serve life. The gate opens when they can ask: “What am I bowing to, and does it make life more whole?” Ras Algethi becomes sacred when reverence is chosen consciously and the body can rise again.",
                  "councilMessage": "Bow only where life becomes more whole. Reverence is not the loss of power. It is power placed in right relationship.",
                  "keywords": [
                    "Ras Algethi",
                    "Alpha Herculis",
                    "Hercules",
                    "Kneeling One",
                    "sacred order",
                    "reverence"
                  ]
                }
              },
              "ophiuchus": {
                "ras-alhague": {
                  "councilSeat": "The Serpent-Medicine Keeper",
                  "coreFunction": "Healing wisdom; the serpent-holder’s knowledge of medicine, repair, poison, and restoration.",
                  "gift": "The gift of Ras Alhague is healing intelligence. It brings diagnostic perception, spiritual medicine, herbal or bodily knowledge, therapeutic instinct, broad-mindedness, humanitarian concern, and the ability to work with the borderland between harm and healing. It can support healers, doctors, herbalists, therapists, energy workers, astrologers, activists, spiritual teachers, researchers, counselors, and people whose work repairs living systems, ideals, or communities. Ras Alhague gives the vision to see the wound and the patience to seek the remedy.",
                  "shadowGate": "The Ras Alhague shadow gate is the forbidden remedy. The person may be drawn toward healing methods, substances, traditions, or powers that are potent but dangerous when used without maturity. The gate opens when they can ask: “Is this medicine, escape, control, or intoxication?” Ras Alhague becomes sacred when the healer respects the boundary between repair and interference.",
                  "councilMessage": "Hold the serpent with clean hands. The remedy is powerful because the poison is powerful. Heal where life allows healing, and do not mistake control for medicine.",
                  "keywords": [
                    "Ras Alhague",
                    "Alpha Ophiuchi",
                    "Ophiuchus",
                    "Serpent Holder",
                    "Asclepius",
                    "healing wisdom"
                  ]
                }
              },
              "aquarius": {
                "sadalmelik": {
                  "councilSeat": "The Royal Water-Bearer",
                  "coreFunction": "Royal blessing through flow; life-giving water poured into thirsty places.",
                  "gift": "The gift of Sadalmelik is fortunate flow. It brings generosity, timing, group support, institutional access, psychic sensitivity, occult or symbolic intelligence, and the ability to pour life into a stalled or thirsty situation. It can support healers, astrologers, artists, community-builders, organizers, spiritual workers, innovators, speakers, writers, researchers, and people whose path involves carrying messages or resources through networks. Sadalmelik gives the sense that the right current can arrive when the vessel is ready.",
                  "shadowGate": "The Sadalmelik shadow gate is the royal entanglement. The person may receive opportunity, visibility, support, or favor through a powerful person, group, institution, or social field, but the gift may come with expectations. The gate opens when they can ask: “Does this flow remain life-giving once I accept its conditions?” Sadalmelik becomes sacred when blessing does not compromise the vessel.",
                  "councilMessage": "Receive the water, but do not become owned by the hand that offered it. Pour where life is thirsty. Blessing becomes true when it moves.",
                  "keywords": [
                    "Sadalmelik",
                    "Sadalmelik",
                    "Alpha Aquarii",
                    "Lucky One of the King",
                    "Aquarius shoulder",
                    "water bearer"
                  ]
                },
                "sadalsuud": {
                  "councilSeat": "The Rain-Bringer of Relief",
                  "coreFunction": "Fortunate release; the life-giving rain that eases pressure, restores movement, and brings help at the right time.",
                  "gift": "The gift of Sadalsuud is restorative good fortune. It brings timing, relief, life-giving flow, emotional easing, helpful openings, social support, and the ability to move through constriction toward greater happiness. It can support healers, counselors, artists, networkers, spiritual workers, social connectors, mystics, inventors, teachers, and people whose path includes helping stalled fields begin moving again. Sadalsuud often shows not wealth for its own sake, but the grace of finding the way through, the right help, or the right atmosphere for life to continue.",
                  "shadowGate": "The Sadalsuud shadow gate is the false easing. The person may feel relief and assume the problem is solved, when in fact only the pressure has temporarily lifted. Or they may accept strange, conditional, or unstable help because they are so thirsty for movement. The gate opens when they can ask: “Is this truly life-giving, or only briefly comforting?” Sadalsuud becomes sacred when relief leads to real restoration rather than temporary escape.",
                  "councilMessage": "Do not worship luck. Receive it, use it, and let it restore what has been dry. Relief is holy when it becomes renewal.",
                  "keywords": [
                    "Sadalsuud",
                    "Beta Aquarii",
                    "Luckiest of the Lucky",
                    "Aquarius shoulder",
                    "relieving rain",
                    "fortunate release"
                  ]
                }
              },
              "cassiopeia": {
                "schedar": {
                  "councilSeat": "The Unchained Queen",
                  "coreFunction": "Dignified sovereignty; the queen-current that commands respect through honor, intuition, and inner authority.",
                  "gift": "The gift of Schedar is dignified authority. It brings presence, honor, moral instinct, intuitive leadership, self-respect, grace under pressure, and the capacity to command respect without force. It can support leaders, teachers, mothers, artists, priestesses, public women, counselors, mystics, organizers, elders, and anyone whose path asks them to sit in their own authority without apology. Schedar teaches that sovereignty can be quiet and still unmistakable.",
                  "shadowGate": "The Schedar shadow gate is the punished queen. The person may carry a fear that visibility, beauty, pride, authority, or self-respect will lead to humiliation, restraint, or attack. The gate opens when they can ask: “What part of my sovereignty is still behaving as though it is chained?” Schedar becomes sacred when dignity returns without apology and without theatrical defense.",
                  "councilMessage": "Sit in your own dignity. Do not make your throne a weapon, and do not leave it because others fear your height. The room remembers balance when the queen is seated.",
                  "keywords": [
                    "Schedar",
                    "Alpha Cassiopeiae",
                    "Cassiopeia",
                    "Queen",
                    "breast of the queen",
                    "female sovereignty"
                  ]
                }
              },
              "virgo": {
                "spica": {
                  "councilSeat": "The Wheat-Bearing Gift Keeper",
                  "coreFunction": "The carried gift; brilliance ripened into offering.",
                  "gift": "The gift of Spica is graceful brilliance. It brings talent, insight, artistry, intelligence, refinement, craft, healing capacity, scientific or symbolic understanding, and the ability to make something difficult appear natural. It can support artists, musicians, scientists, writers, healers, makers, teachers, growers, designers, ritualists, and people whose work carries both beauty and usefulness. Spica is the gift that can feed others, not only impress them.",
                  "shadowGate": "The Spica shadow gate is gifted avoidance. The person may fear the responsibility of their own talent, or they may have learned to minimize it because visibility felt unsafe. They may also become anxious about whether the gift is enough, polished enough, useful enough, pure enough, or special enough. The correction is not to inflate the gift or bury it. It is to tend it like grain: cultivate, harvest, mill, bake, and feed.",
                  "councilMessage": "The gift was not placed in your hand to prove your worth. It was placed there to feed the field. Ripen it. Protect it. Offer it cleanly.",
                  "keywords": [
                    "Spica",
                    "Arista",
                    "wheat ear",
                    "carried gift",
                    "harvest",
                    "brilliance"
                  ]
                },
                "vindemiatrix": {
                  "councilSeat": "The Grape-Gatherer",
                  "coreFunction": "The harvest-gatherer; patient collection of what has ripened, been learned, or become useful.",
                  "gift": "The gift of Vindemiatrix is fruitful gathering. It brings patience, concentration, resourcefulness, careful timing, research ability, collecting instinct, practical intelligence, and the capacity to make something useful from many small pieces. It can support researchers, archivists, teachers, herbalists, artists, gardeners, writers, business-builders, organizers, historians, collectors, analysts, and anyone whose work depends on gathering facts, materials, people, tools, or harvests into a meaningful whole. Vindemiatrix understands that abundance often comes one cluster at a time.",
                  "shadowGate": "The Vindemiatrix shadow gate is the premature harvest. The person may reach for the fruit, answer, relationship, client, resource, teaching, or proof before it is fully ready. They may also miss the harvest through over-caution, waiting so long that the fruit falls. The gate opens when they can ask: “Is this ripe, and what is the right way to gather it?” Vindemiatrix becomes sacred when action is joined to season.",
                  "councilMessage": "Do not pull the fruit because you fear there will be none tomorrow. Learn the season. Trust the ripening. Gather what is ready, and bless what remains on the vine.",
                  "keywords": [
                    "Vindemiatrix",
                    "Epsilon Virginis",
                    "Grape Gatherer",
                    "vintage",
                    "harvest",
                    "gathering"
                  ]
                }
              },
              "delphinus": {
                "sualocin": {
                  "councilSeat": "The Dolphin Guide",
                  "coreFunction": "Playful mastery; the dolphin-current of natural talent, curiosity, and gentle guidance through depth.",
                  "gift": "The gift of Sualocin is natural mastery. It brings curiosity, quick learning, charm, movement, play, friendly guidance, intuitive navigation, and the ability to become comfortable in environments that others experience as strange, deep, or complex. It can support therapists, depth workers, artists, animators, teachers, swimmers, travelers, musicians, storytellers, spiritual workers, explorers of psyche, and people whose presence makes difficult material more approachable. Sualocin gives the ability to guide through depth with lightness.",
                  "shadowGate": "The Sualocin shadow gate is the charming detour. The person may sense where the real work is, but instinctively turn it into something clever, entertaining, beautiful, or indirect. The gate opens when they can ask: “Am I playing with this because it brings life, or because I am avoiding the deeper contact?” Sualocin becomes sacred when play carries the person into truth rather than around it.",
                  "councilMessage": "Do not make depth heavier than it needs to be. Play can be a doorway, but only if you swim through it.",
                  "keywords": [
                    "Sualocin",
                    "Alpha Delphini",
                    "Delphinus",
                    "Dolphin",
                    "playful mastery",
                    "natural talent"
                  ]
                }
              },
              "libra": {
                "zuben-elgenubi": {
                  "councilSeat": "The Southern Scale Reformer",
                  "coreFunction": "Sacrificial justice; reform moved by principle rather than personal gain.",
                  "gift": "The gift of Zuben Elgenubi is principled reform. It brings ethical sensitivity, social conscience, willingness to stand with the wronged, law-awareness, fairness, group orientation, and the capacity to work for change without making personal gain the center. It can support activists, lawyers, teachers, mediators, writers, community organizers, spiritual reformers, social critics, policy workers, and people whose lives ask them to help rebalance a field. Zuben Elgenubi sees the wound in the scales and asks what must be given to correct it.",
                  "shadowGate": "The Zuben Elgenubi shadow gate is the insufficient price. The person may feel that no sacrifice is enough, no repair is complete, no apology restores the balance, no reform goes far enough. They may become trapped in the moral ledger, continually weighing what was taken and what is still owed. The gate opens when they can ask: “What restores balance without requiring my life-force as payment?” Zuben Elgenubi becomes sacred when justice is joined to renewal.",
                  "councilMessage": "Do not let justice feed on your life-force. Weigh the cost, yes — but include your own body on the scale.",
                  "keywords": [
                    "Zuben Elgenubi",
                    "Alpha Librae",
                    "Southern Scale",
                    "Southern Claw",
                    "insufficient price",
                    "social justice"
                  ]
                },
                "zuben-eschamali": {
                  "councilSeat": "The Northern Scale Strategist",
                  "coreFunction": "Reform with return; social power, visibility, and the ethics of personal gain.",
                  "gift": "The gift of Zuben Eschamali is effective social agency. It brings organizing ability, leadership in groups, strategic reform, ambition, law-awareness, social intelligence, beneficial networks, public influence, writing or speaking power, and the ability to translate ideals into institutional or communal action. It can support politicians, lawyers, teachers, community leaders, organizers, writers, speakers, advocates, business-builders, mediators, and anyone who uses status or structure to move reform through the world. Zuben Eschamali knows that good intentions often need a seat at the table.",
                  "shadowGate": "The Zuben Eschamali shadow gate is the full price. The person may be offered status, access, recognition, money, or influence in exchange for service. The question becomes: what does the role cost, and who is really being served? The gate opens when they can ask: “Am I using power to serve balance, or using balance to justify power?” Zuben Eschamali becomes sacred when ambition is made transparent and accountable.",
                  "councilMessage": "Do not pretend you receive nothing. Name the exchange. Keep the scale visible. Then let power serve the work.",
                  "keywords": [
                    "Zuben Eschamali",
                    "Beta Librae",
                    "Northern Scale",
                    "Northern Claw",
                    "full price",
                    "social reform"
                  ]
                }
              },
              "ursa_minor": {
                "polaris": {
                  "councilSeat": "The North-Star Keeper",
                  "coreFunction": "The still point; inner orientation around which the life can turn.",
                  "gift": "The gift of Polaris is inner guidance. It brings steadiness, pathfinding, spiritual orientation, navigational instinct, and the ability to remain connected to a central truth through changing conditions. It can support guides, keepers, navigators, protectors, teachers, ancestral workers, land-workers, ritualists, parents, healers, and people who hold a quiet central point for others without needing to dominate the field. Polaris is not loud leadership. It is the lamp in the high place. It lets the traveller know where they are.",
                  "shadowGate": "The Polaris shadow gate is the burden of being the center. The person may unconsciously become the one others use for orientation, stability, care, or emotional reference, while their own movement is restricted. They may fear that if they change, leave, soften, or admit uncertainty, the whole sky will lose its axis. The correction is to remember that true guidance does not require self-erasure. The pole does not chase the stars, but neither does it forbid the Earth from turning.",
                  "councilMessage": "Do not become still because you are afraid to move. Become still enough to know your direction. The center is not a cage. It is the place from which the road becomes visible.",
                  "keywords": [
                    "Polaris",
                    "North Star",
                    "Pole Star",
                    "Stella Polaris",
                    "Cynosura",
                    "Little Bear"
                  ]
                }
              }
            }
          }
        }
      }
    }
  ]
}$rwss$::jsonb, now(), 'resonantweaver'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.page_models
    WHERE site = 'resonantweaver' AND slug = 'galactic-field-guide' AND lang = 'en'
      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL
 );

-- Assert what landed, not that something landed: a pre-existing row at either
-- slug would have made the INSERT above a silent no-op, and this is what
-- notices.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'sun-walk' AND p.mode = 'published'
     AND s->>'type' = 'rf-sun-walk'
     AND s->'config'->'props'->>'title' = 'The Sun Walk'
     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'currents')) = 8
     AND jsonb_array_length(s->'config'->'props'->'reference'->'anchorWeeks'->'sections') = 3
     AND jsonb_array_length(s->'config'->'props'->'reference'->'weekTypes'->'cards') = 3;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-sun-walk section titled % carrying 8 currents and both reference essays, found %', 'The Sun Walk', n;
  END IF;

  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'galactic-field-guide' AND p.mode = 'published'
     AND s->>'type' = 'rf-field-guide'
     AND s->'config'->'props'->>'theme' = 'nocturne'
     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'plates')) = 3
     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'prose'->'systems')) = 42
     AND (SELECT coalesce(sum(k.n), 0)
            FROM jsonb_each(s->'config'->'props'->'prose'->'stars') e,
                 LATERAL (SELECT count(*) AS n FROM jsonb_object_keys(e.value)) k) = 62;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-field-guide section carrying 3 plate pairs, 42 dossiers and 62 star cards, found %', n;
  END IF;

  RAISE NOTICE 'assertions passed';
END $$;

COMMIT;
