-- 03-journey-preview.sql — GENERATED. See scratchpad/gen-journey-row.mjs.
--
-- The journey as an `rf-journey` SECTION, authored at slug `journey-preview`
-- so it can be driven side by side with the package version still serving
-- /journey, before anything is deleted. Both carry the same stops, straight
-- out of her own `src/data/journey/chakraSections.ts`, so a difference in the
-- browser is the mechanism and not the words.
--
-- Nav and footer are ON (corrected 2026-08-09): her live /journey/ wears
-- both — the nav floats over the sealed viewport without adding height, and
-- the footer is 112px of outer scroll below it. The section still owns its
-- own scroll container; the chrome rides around it exactly as on her app.
--
--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/03-journey-preview.sql

\set ON_ERROR_STOP on

BEGIN;

SELECT set_config('app.actor', 'migration:resonantweaver-journey-preview', true);

INSERT INTO public.page_models
  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)
SELECT 'journey-preview', 'en', 'published', NULL, NULL, 'The Starwoven Journey', true, false,
       $rwj${
  "id": "pm-rw-journey",
  "slug": "journey-preview",
  "title": "The Starwoven Journey",
  "chrome": {
    "navEnabled": true,
    "footerEnabled": true
  },
  "sections": [
    {
      "id": "sec-journey",
      "type": "rf-journey",
      "label": "The Seven Gates",
      "blocks": [],
      "enabled": true,
      "config": {
        "props": {
          "eyebrow": "An embodied inquiry",
          "title": "The Seven",
          "titleAccent": "Gates",
          "lede": "A journey through some of the body's energetic architecture. Each gate is a world. At each one, a breathing practice and a reflection are waiting. Move at your own pace.",
          "ctaLabel": "Begin the Journey",
          "ground": "#030008",
          "transitionMs": 700,
          "stops": [
            {
              "id": "muladhara",
              "name": "Mūlādhāra",
              "english": "Root",
              "number": 1,
              "bg": "#080202",
              "glow": "#8B2222",
              "light": "#C04040",
              "accent": "#F0C0A8",
              "dim": "#3A0A0A",
              "element": "Earth · Prithvi",
              "mantra": "LAM",
              "seed": "I am",
              "location": "Base of Spine",
              "petals": 4,
              "particleType": "earth",
              "nudge": "The root asks you to stay. Just a little longer.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 4,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 2,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 6,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 2,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "12%",
                  "y": "68%",
                  "w": "55%",
                  "h": "50%",
                  "blur": 80,
                  "op": 0.28
                },
                {
                  "x": "78%",
                  "y": "22%",
                  "w": "45%",
                  "h": "60%",
                  "blur": 100,
                  "op": 0.18
                },
                {
                  "x": "55%",
                  "y": "88%",
                  "w": "60%",
                  "h": "40%",
                  "blur": 90,
                  "op": 0.16
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "Earth is our foundation. The root asks if you can let the ground receive you. It provides stability, pacing, and capacity. This energy center establishes foundational energetic stability through anchoring and distributing Earth's energies. It provides trust in the timing of life, a balance between rest and action, and safety without control. Root coherence allows embodied presence, deeper breath, and a sensation of calm."
                },
                {
                  "label": "Body",
                  "content": "The root chakra governs the base of the spine, legs, feet, and large intestine, and is located at the tip of your coccyx. It also helps regulate the adrenal glands. Feeling embodied is the heaviness in your legs after a long walk, the relaxation of the jaw when you feel safe, the deep exhale that comes when you finally arrive somewhere. A certain suppleness to the hip and pelvic fascia and muscle structures also allows for further balance of the chakra."
                },
                {
                  "label": "Shadow",
                  "content": "When the root is constricted, the nervous system reads ordinary life as a threat. There might be chronic low-level anxiety, and a dissociation from the lower half of the body. Shallow, chest-dominant breathing is common, along with projection, survival focus, or fatigue or numbness."
                },
                {
                  "label": "Practice",
                  "content": "Stand or sit with both feet on the floor. Let your knees soften slightly. Place your attention at the base of your spine. Arrive there. Breathe into the weight of your body and exhale down into the earth. The earth receives all of it, without condition. Stay here for at least two minutes."
                }
              ],
              "resonanceLabels": [
                "Ungrounded",
                "Scattered",
                "Settling",
                "Rooted",
                "Anchored"
              ]
            },
            {
              "id": "svadhisthana",
              "name": "Svādhiṣṭhāna",
              "english": "Sacral",
              "number": 2,
              "bg": "#080400",
              "glow": "#B05010",
              "light": "#D4700A",
              "accent": "#F0C080",
              "dim": "#3A1800",
              "element": "Water · Apas",
              "mantra": "VAM",
              "seed": "I feel",
              "location": "Lower Abdomen",
              "petals": 6,
              "particleType": "water",
              "nudge": "Water doesn't rush. Neither does this.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 4,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 1,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 5,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 1,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "25%",
                  "y": "20%",
                  "w": "50%",
                  "h": "55%",
                  "blur": 90,
                  "op": 0.25
                },
                {
                  "x": "82%",
                  "y": "70%",
                  "w": "42%",
                  "h": "50%",
                  "blur": 80,
                  "op": 0.2
                },
                {
                  "x": "45%",
                  "y": "82%",
                  "w": "55%",
                  "h": "38%",
                  "blur": 100,
                  "op": 0.15
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The sacral center is the intelligence of the body’s creative waters. The seat of aliveness. It organizes life-force into usable power. It governs cyclical charge and discharge, creativity, desire, pleasure, and sexuality. Coherence in this center shows through vitality, potency, expressiveness and steadfast productivity without depletion. It provides the energetic power that enables perception to engage and move."
                },
                {
                  "label": "Body",
                  "content": "The sacral chakra governs the lower abdomen, hips, sacrum, kidneys, bladder, and reproductive organs. It is where creative and sexual energy live in the body. It is the same force expressed as a fundamental impulse toward generation and expression. The hips carry what the mind has not yet processed. When coherent there’s a steady flow of energy, a natural access to desire, a warm vitality in the pelvic bowl, creative momentum, embodied joy and sensual presence."
                },
                {
                  "label": "Shadow",
                  "content": "When the sacral is blocked, the generative nature can often fall away. Exhaustion, numbness, creative stagnation, addictive patterns, over active sexual drive, and/or restlessness may present itself. Not knowing what one wants, frustration and self-judgement. The water that should flow has either stagnated or burst its banks."
                },
                {
                  "label": "Practice",
                  "content": "Place your attention in the pelvic bowl, and let your hips begin to move in slow, undulating circles, or figure eights. Any shape that feels true. Rhythm is important, follow the rhythmic impulse. Notice what arises before your mind can edit it. Stay with the movement for two full minutes. Let sensation lead."
                }
              ],
              "resonanceLabels": [
                "Numb",
                "Guarded",
                "Stirring",
                "Alive",
                "Flowing"
              ]
            },
            {
              "id": "manipura",
              "name": "Maṇipūra",
              "english": "Solar Plexus",
              "number": 3,
              "bg": "#080700",
              "glow": "#A09000",
              "light": "#D4B000",
              "accent": "#F5E080",
              "dim": "#302A00",
              "element": "Fire · Agni",
              "mantra": "RAM",
              "seed": "I do",
              "location": "Solar Plexus",
              "petals": 10,
              "particleType": "fire",
              "nudge": "Fire needs time to catch. Pause here.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 4,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 2,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 6,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 2,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "60%",
                  "y": "15%",
                  "w": "58%",
                  "h": "45%",
                  "blur": 85,
                  "op": 0.26
                },
                {
                  "x": "18%",
                  "y": "55%",
                  "w": "48%",
                  "h": "58%",
                  "blur": 95,
                  "op": 0.2
                },
                {
                  "x": "75%",
                  "y": "78%",
                  "w": "44%",
                  "h": "42%",
                  "blur": 80,
                  "op": 0.18
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The solar plexus metabolizes emotional signal into usable information. It is a truth gauge. The first major bridge that translates body experience into emotional meaning. It is the fire that digests not only food but experience. It regulates amplitude, boundaries and their permeability, and is your relational calibrator. It governs confidence, sense of self, and belonging. It also connects to your true north. Suppleness in the diaphragm is important. Your diaphragm is a pump, and if it doesn’t move in its full range, it’s not working as it should."
                },
                {
                  "label": "Body",
                  "content": "This center governs the stomach, liver, gallbladder, pancreas, and upper abdomen.  Anatomically the celiac plexus. It is the home of the enteric nervous system, the 'second brain.' It tells you everything you need to know. Butterflies before a risk. The sick feeling when integrity is violated. The warmth of earned confidence. The gut knows before the mind applies story. A stable Solar Plexus is necessary for discerning emotional reality vs. emotional imagination before the signal reaches the brain."
                },
                {
                  "label": "Shadow",
                  "content": "When the solar plexus loses coherence, the truth gauge stops being reliable. Chronic indecision, difficulty with boundaries, people-pleasing, or a need for external validation may arise. As may the opposite: rigidity, overreach, control as a substitute for trust. A sure tell that your solar plexus needs some compassion is a tight and tender diaphragm. Emotional signal and emotional imagination become difficult to tell apart."
                },
                {
                  "label": "Practice",
                  "content": "Place both hands over your solar plexus, just above the navel. Breathe deeply into that space. On the exhale, make a sharp, brief “HA”. Forceful, clear. Do this three times. Then rest your hands there and breathe normally. Notice: is there warmth? Tension? Hollowness? Pushing the hands out in front of you as you make the “HA” sound will increase the effect. If you experience tenderness here, spend some time with gentle massage, and deep breathing to stretch your diaphragm."
                }
              ],
              "resonanceLabels": [
                "Powerless",
                "Hesitant",
                "Gathering",
                "Empowered",
                "Clear will"
              ]
            },
            {
              "id": "anahata",
              "name": "Anāhata",
              "english": "Heart",
              "number": 4,
              "bg": "#010803",
              "glow": "#0A6A30",
              "light": "#1AAA50",
              "accent": "#80D0A0",
              "dim": "#002A10",
              "element": "Air · Vayu",
              "mantra": "YAM",
              "seed": "I love",
              "location": "Heart Center",
              "petals": 12,
              "particleType": "air",
              "nudge": "The heart opens slowly. Give it room.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 5,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 2,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 5,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 2,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "30%",
                  "y": "30%",
                  "w": "55%",
                  "h": "55%",
                  "blur": 95,
                  "op": 0.22
                },
                {
                  "x": "80%",
                  "y": "60%",
                  "w": "40%",
                  "h": "50%",
                  "blur": 85,
                  "op": 0.18
                },
                {
                  "x": "15%",
                  "y": "78%",
                  "w": "50%",
                  "h": "40%",
                  "blur": 100,
                  "op": 0.16
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The heart center is a harmonizer. It is the bridge between earth and sky, between self and other, between the personal and the universal. It is where love lives, but not love as sentiment: love as the fundamental permeability of the self, the willingness to be moved. A coherent heart center allows for boundaries to remain intact while staying open, a genuine contact with reality as it is, an effortless generosity, and connection without merging."
                },
                {
                  "label": "Body",
                  "content": "The heart chakra governs the heart, lungs, chest, shoulders, arms, hands and the thymus gland which is central to immune function. It is located in the center of the chest behind the sternum. When coherent there’s a softness there. When the chest is open, breath moves freely and deeply. When the heart is armored, breathing shallows, the shoulders curve inward, and the sternum quietly tightens."
                },
                {
                  "label": "Shadow",
                  "content": "When the heart is closed, love becomes conditional, and relational perception can become distorted. “I will only show you love if you do/act/say these things”. Joy loses its bubbles and there is loneliness even in the presence of others. Or its inverse: self-sacrifice without boundaries, love that loses itself entirely in the other. Both are the heart forgetting its own worth, protecting itself from what it most needs."
                },
                {
                  "label": "Practice",
                  "content": "Sit with one hand on your heart. Breathe into the space behind your sternum . Not the front, the back. The space you rarely reach. On each inhale, invite that space to soften without forcing it. You don't need to do anything with what you find there. This act of witness is already the beginning of self-compassion. Spending time in your heart will change your perspective. And it’s a doorway too. Place your attention here and see how the world changes when you interact with it from this space."
                }
              ],
              "resonanceLabels": [
                "Armored",
                "Cautious",
                "Opening",
                "Tender",
                "Wide open"
              ]
            },
            {
              "id": "vishuddha",
              "name": "Viśuddha",
              "english": "Throat",
              "number": 5,
              "bg": "#000608",
              "glow": "#1780B8",
              "light": "#47B8E8",
              "accent": "#A9E2FF",
              "dim": "#08243A",
              "element": "Ether · Akasha",
              "mantra": "HAM",
              "seed": "I speak",
              "location": "Throat",
              "petals": 16,
              "particleType": "ether",
              "nudge": "Truth doesn't rush. It ripens.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 4,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 2,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 4,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 2,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "70%",
                  "y": "25%",
                  "w": "52%",
                  "h": "48%",
                  "blur": 90,
                  "op": 0.24
                },
                {
                  "x": "20%",
                  "y": "60%",
                  "w": "45%",
                  "h": "55%",
                  "blur": 100,
                  "op": 0.18
                },
                {
                  "x": "50%",
                  "y": "85%",
                  "w": "58%",
                  "h": "38%",
                  "blur": 80,
                  "op": 0.15
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The throat is where transmission happens. It is the conversion point where inner state becomes outer expression. Where what has been felt, processed and organized finally moves out into form. Expression is the primary tone: speech, sound, song, music, movement, writing, art, or presence. When coherent the throat expresses what is true without force or withholding. This center asks: are you expressing what is true for you, or what you've calculated to be safe?"
                },
                {
                  "label": "Body",
                  "content": "The throat chakra governs the throat, neck, jaw, thyroid and parathyroid glands, mouth, and ears. It is located behind the larynx along the vertical axis. When coherent there’s less tension in the neck and jaw. Pauses happen naturally without awkwardness. The thyroid regulates metabolism. The speed at which you process life. The ears remind us that this center is as much about receiving as transmitting. Authentic communication is not just expression; it is the capacity for deep, unhurried listening."
                },
                {
                  "label": "Shadow",
                  "content": "When the throat loses coherence, expression becomes compensatory rather than coherent. It tends to oscillate. Holding back, shutting down, can’t speak, or, over-outputting, flooding, talking to regulate rather than to transmit. Fear of being too much, or not enough. Words feeling dangerous. Both are the same disruption expressed in different directions. The deeper pattern is bypassing and expressing before a clear meaning has been organized upstream."
                },
                {
                  "label": "Practice",
                  "content": "Hum. Start at whatever pitch feels natural and let the vibration move through you. Feel it in your chest, your skull, your face. Let it change pitch without deciding where it goes. Feel the difference. This is practicing resonance. What feels good, what happens inside? When you are finished, sit in the silence that remains. Notice if that silence feels different now."
                }
              ],
              "resonanceLabels": [
                "Silenced",
                "Careful",
                "Finding words",
                "Expressive",
                "Clear truth"
              ]
            },
            {
              "id": "ajna",
              "name": "Ājñā",
              "english": "Third Eye",
              "number": 6,
              "bg": "#020010",
              "glow": "#7A46D1",
              "light": "#AE7BFF",
              "accent": "#DDD0FF",
              "dim": "#1A0A3D",
              "element": "Light · Tejas",
              "mantra": "OM",
              "seed": "I see",
              "location": "Between the Brows",
              "petals": 2,
              "particleType": "light",
              "nudge": "Insight arrives in stillness, not speed.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 5,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 3,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 5,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 3,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "45%",
                  "y": "20%",
                  "w": "60%",
                  "h": "50%",
                  "blur": 100,
                  "op": 0.22
                },
                {
                  "x": "15%",
                  "y": "65%",
                  "w": "48%",
                  "h": "52%",
                  "blur": 85,
                  "op": 0.18
                },
                {
                  "x": "82%",
                  "y": "75%",
                  "w": "42%",
                  "h": "44%",
                  "blur": 95,
                  "op": 0.16
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The ajna structures perception into meaning. It is the center that takes what the body feels, what the field receives, and what the other centers have processed, and organizes it into coherent internal representation. It sees through, beyond the literal and the surface of events into the patterns beneath. Coherence shows up as pattern recognition, sense-making, and resolving into clarity. Meaning emerges quietly and without force. Perspectives form cleanly. It is the seat of discernment. The ajna doesn’t create the signal. It formats it. Ajna coherence is quiet and does not perform."
                },
                {
                  "label": "Body",
                  "content": "The ajna chakra corresponds to the pineal gland and is located at the deep center of the head, along the pineal axis at the midline. It is a light-sensitive structure. When coherent, awareness is primarily in the body rather than floating in the head. Internal narrative is minimal unless needed. Conceptualization is downstream of direct perception. It follows the reality of the experience without applying meaning or story to it that might not be true. It regulates our relationship to time, sleep and states of consciousness that move beyond ordinary perception."
                },
                {
                  "label": "Shadow",
                  "content": "When the ajna loses coherence, the mind attempts to compensate through finding explanations and stories that match. Projecting what you expect, not what is. Thought spirals, rumination occurs, trying to figure out reality rather than perceive it, generating imagined threat without somatic evidence, conceptualizing instead of sensing, over-reliance on external authority. The pattern is almost always a retreat: when the lower centers are unstable, the system moves upward into the head where it feels safer. The ajna turbulence is rarely the origin of the problem. It is a signal that something further down needs attention."
                },
                {
                  "label": "Practice",
                  "content": "Close your eyes and let your gaze soften behind your eyelids. Rest your attention at the space between your eyebrows without effort. Then move your attention back into the center of your head. When thoughts arise, you are not suppressing them; you are simply declining to follow them. Like if you were standing at an intersection. Your thoughts are cars passing through. You are simply there observing the cars. Stay here for three minutes. Notice what arises without interpreting it."
                }
              ],
              "resonanceLabels": [
                "Foggy",
                "Uncertain",
                "Perceiving",
                "Clear-sighted",
                "Sharp vision"
              ]
            },
            {
              "id": "sahasrara",
              "name": "Sahasrāra",
              "english": "Crown",
              "number": 7,
              "bg": "#030008",
              "glow": "#8A30AA",
              "light": "#C060E0",
              "accent": "#EAD8FF",
              "dim": "#180028",
              "element": "Consciousness · Chit",
              "mantra": "AUM",
              "seed": "I know",
              "location": "Crown of Head",
              "petals": 1000,
              "particleType": "crown",
              "nudge": "There is nowhere to arrive. You are already here.",
              "breathPhases": [
                {
                  "label": "Inhale",
                  "duration": 6,
                  "scaleFrom": 1,
                  "scaleTo": 1.4
                },
                {
                  "label": "Hold",
                  "duration": 2,
                  "scaleFrom": 1.4,
                  "scaleTo": 1.4
                },
                {
                  "label": "Exhale",
                  "duration": 6,
                  "scaleFrom": 1.4,
                  "scaleTo": 0.85
                },
                {
                  "label": "Rest",
                  "duration": 3,
                  "scaleFrom": 0.85,
                  "scaleTo": 0.85
                }
              ],
              "wc": [
                {
                  "x": "50%",
                  "y": "20%",
                  "w": "65%",
                  "h": "55%",
                  "blur": 110,
                  "op": 0.26
                },
                {
                  "x": "20%",
                  "y": "70%",
                  "w": "50%",
                  "h": "50%",
                  "blur": 90,
                  "op": 0.2
                },
                {
                  "x": "85%",
                  "y": "50%",
                  "w": "40%",
                  "h": "60%",
                  "blur": 95,
                  "op": 0.18
                }
              ],
              "tabs": [
                {
                  "label": "Essence",
                  "content": "The crown is the upper portal. It is where non-local information such as cosmic streams, archetypal, collective, and supra-personal energies enters the human architecture. It is also something more fundamental: it is the seat of awareness itself. The medium through which any information becomes knowable at all. We’ve all heard the expression “Energy flows where awareness goes”, which means the crown is not only what you receive through, it is what you orient with. Its primary tone is receptivity. Not seeking, not reaching, not interpreting. Simply allowing what is available to become available. What appears to be spiritual seeking is often awareness recognizing itself. The information that enters here is organized downstream."
                },
                {
                  "label": "Body",
                  "content": "The crown chakra is anchored at the apex of the head, its toroidal center positioned just above the fontanel point. It corresponds to the cerebral cortex, the central nervous system as a whole, and the deepest functions of the pineal gland. The field extends naturally upward beyond the physical skull. When coherent there is a soft, wide sensation at the top of the head without pressure. A buoyancy. Information arrives without overwhelm and without strain. Awareness feels spacious and distributed rather than narrow and located. Inspiration enters gently and feels obvious rather than dramatic. It is quiet availability rather than spectacle and the medium through which consciousness moves."
                },
                {
                  "label": "Shadow",
                  "content": "When the crown loses regulation, it distorts in one of two directions. Too open: excessive influx, overwhelm, dissociation, spiritual bypass. The system floods. Too closed: numbness, disconnection, no felt access to anything beyond the material. Awareness contracts to the functional and stays there. The system seals. Crown turbulence is about regulating how much comes in, and whether the architecture can metabolize it without either shutting down or losing its ground. It doesn’t elevate you above your humanness."
                },
                {
                  "label": "Practice",
                  "content": "Sit quietly with your spine upright. Soften the top of your head by releasing the effort to contain anything. Let the apex of the skull be porous rather than bounded. You are not reaching upward. You are simply becoming available. Notice that awareness is already present before you try to produce it. If an impression arrives, try to receive it without immediately organizing it into meaning. That is downstream work. Here, the practice is just the opening. Stay for two to three minutes. Notice whether the space above your head feels different at the end than it did at the beginning."
                }
              ],
              "resonanceLabels": [
                "Cut off",
                "Seeking",
                "Receptive",
                "Connected",
                "Resting in being"
              ]
            }
          ]
        }
      }
    }
  ]
}$rwj$::jsonb, now(), 'resonantweaver'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.page_models
    WHERE site = 'resonantweaver' AND slug = 'journey-preview' AND lang = 'en'
      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL
 );

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s
   WHERE p.site = 'resonantweaver' AND p.slug = 'journey-preview'
     AND s->>'type' = 'rf-journey'
     AND jsonb_array_length(s->'config'->'props'->'stops') = 7;
  IF n <> 1 THEN
    RAISE EXCEPTION 'assert: expected one rf-journey section carrying 7 stops, found %', n;
  END IF;
  RAISE NOTICE 'assertions passed';
END $$;

COMMIT;
