// Author Marthe's two starseed rows straight from the code the ROUTES render,
// so the section and the route say the same words and any difference in the
// browser is the mechanism rather than the content.
//
// Forked from `gen-journey-row.mjs`. What a row carries:
//
//   rf-sun-walk    — EVERY word on the page: the three strings above the
//                    calendar, the eight currents' descriptions, and the two
//                    reference essays. Not the 52-week grid, which is Swiss
//                    Ephemeris output and stays compiled in forever.
//   rf-field-guide — paper stock, reading size, WHOSE photographs, and — since
//                    W10 — every word in the guide: 42 system dossiers and 62
//                    star cards. Not the sky: positions, star tuples,
//                    constellation lines and catalogue designations stay in
//                    `engine/fieldguide/data.ts` where a pipeline owns them.
//
// Nothing is retyped here. Every string is read from the source the ROUTE
// renders, because a retyped string is exactly how a row and a route come to
// disagree about what the page says:
//
//   SUN_WALK_COPY            ─┐
//   CURRENT_INFO              ├─ `@tgv/module-starseed/starseed/sunwalk/copy.ts`
//   SUN_WALK_REFERENCE       ─┘
//   FIELD_GUIDE_SYSTEM_PROSE ─┬─ `@tgv/module-starseed/starseed/fieldguide/copy.ts`
//   FIELD_GUIDE_STAR_PROSE   ─┘
//   fieldGuidePlatesForSite   — tinyglobalvillage.com's `lib/starseed/fieldGuidePlates.ts`
//
// Both are dependency-free modules (copy.ts's one `import type` is erased before
// esbuild resolves it), so esbuild bundles them without dragging in React or
// styled-components.
//
// IT WRITES THREE FILES. `11-…sql` seeds a fresh environment with complete rows.
// `12-…sql` and `13-…sql` patch an environment where the rows were already
// seeded WITHOUT the words — which is every environment, because W8 seeded them,
// W9 freed the Sun Walk's prose and W10 freed the field guide's. Both patches
// add only keys the row does not already have, so neither can overwrite
// something Marthe has since written.
//
//   node clients/office.tinyglobalvillage.com/sql/resonantweaver-migration/gen-starseed-rows.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// This lane. `gen-journey-row.mjs` points at the office worktree; that one ran
// there and this one runs here, and the two are not the same checkout.
// `fileURLToPath`, not `url.pathname` — this checkout lives under a directory
// with a space in its name ("MAC RCS") and a raw pathname hands you `%20`.
const ROOT = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../..");
const SITE = "resonantweaver";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rwss-"));
const entry = path.join(tmp, "e.ts");
const out = path.join(tmp, "d.mjs");
fs.writeFileSync(
  entry,
  [
    "export { SUN_WALK_COPY, CURRENT_INFO, SUN_WALK_REFERENCE } from " +
      JSON.stringify(
        path.join(ROOT, "packages/@tgv/module-orakle/module-starseed/starseed/sunwalk/copy"),
      ) +
      ";",
    "export { FIELD_GUIDE_SYSTEM_PROSE, FIELD_GUIDE_STAR_PROSE } from " +
      JSON.stringify(
        path.join(ROOT, "packages/@tgv/module-orakle/module-starseed/starseed/fieldguide/copy"),
      ) +
      ";",
    "export { fieldGuidePlatesForSite } from " +
      JSON.stringify(
        path.join(ROOT, "clients/tinyglobalvillage.com/src/lib/starseed/fieldGuidePlates"),
      ) +
      ";",
  ].join("\n"),
);
execFileSync(path.join(ROOT, "node_modules/.bin/esbuild"), [
  entry,
  "--bundle",
  "--format=esm",
  "--platform=node",
  "--outfile=" + out,
  "--log-level=error",
]);
const {
  SUN_WALK_COPY,
  CURRENT_INFO,
  SUN_WALK_REFERENCE,
  FIELD_GUIDE_SYSTEM_PROSE,
  FIELD_GUIDE_STAR_PROSE,
  fieldGuidePlatesForSite,
} = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

const plates = fieldGuidePlatesForSite(SITE);
const plateCount = Object.keys(plates).length;
if (plateCount === 0) {
  throw new Error(
    "fieldGuidePlatesForSite(" + SITE + ") is empty — her dossiers would seed with placeholder boxes",
  );
}
for (const [system, pair] of Object.entries(plates)) {
  for (const face of ["subject", "habitat"]) {
    const src = pair?.[face];
    if (typeof src !== "string" || !src.startsWith("/images/tenants/" + SITE + "/")) {
      throw new Error(
        "plate " + system + "." + face + " is not under her own tenant directory: " + src,
      );
    }
  }
}
for (const [k, v] of Object.entries(SUN_WALK_COPY)) {
  if (typeof v !== "string" || !v.trim()) throw new Error("SUN_WALK_COPY." + k + " is empty");
}

// Eight currents, three strings each. A missing one would not fail — the
// component falls through per field to the shipped words — which is exactly why
// it has to be caught here: the row would look complete and quietly be short.
const CURRENT_COUNT = Object.keys(CURRENT_INFO).length;
if (CURRENT_COUNT !== 8) {
  throw new Error("CURRENT_INFO has " + CURRENT_COUNT + " currents, expected 8");
}
for (const [name, info] of Object.entries(CURRENT_INFO)) {
  for (const field of ["definition", "use", "distortion"]) {
    if (typeof info?.[field] !== "string" || !info[field].trim()) {
      throw new Error("CURRENT_INFO." + name + "." + field + " is empty");
    }
  }
}

// Marthe's two reference essays. Counted rather than spot-checked, because the
// failure this guards against is an essay arriving with its blocks dropped.
const blockWords = (blocks) =>
  (blocks ?? []).reduce((n, b) => {
    if (b.kind === "p") return n + (b.text?.trim() ? 1 : 0);
    if (b.kind === "ul") return n + (b.items ?? []).filter((i) => i.trim()).length;
    return n + (b.steps ?? []).filter((st) => st.text?.trim()).length;
  }, 0);
const REF = SUN_WALK_REFERENCE;
const anchorBlocks = REF.anchorWeeks.sections.reduce((n, s) => n + blockWords(s.blocks), 0);
const typeBlocks = REF.weekTypes.cards.reduce((n, c) => n + blockWords(c.blocks), 0);
if (REF.anchorWeeks.sections.length !== 3 || anchorBlocks < 12) {
  throw new Error(
    "anchor-week essay came through short: " +
      REF.anchorWeeks.sections.length +
      " sections, " +
      anchorBlocks +
      " written blocks",
  );
}
if (REF.weekTypes.cards.length !== 3 || typeBlocks < 8 || !REF.weekTypes.summary.trim()) {
  throw new Error(
    "week-types essay came through short: " +
      REF.weekTypes.cards.length +
      " cards, " +
      typeBlocks +
      " written blocks",
  );
}

// The field guide's writing. Forty-two dossiers of nine paragraphs and sixty-two
// star cards of six — counted, and every field checked non-empty, because the
// component falls through per FIELD to the shipped words and a row that arrived
// with half a dossier missing would render exactly like a complete one.
const SYSTEM_PROSE_FIELDS = [
  "note", "landscape", "traits", "mission", "mythology", "frequency", "passage", "margin",
];
const SYSTEM_COUNT = Object.keys(FIELD_GUIDE_SYSTEM_PROSE).length;
if (SYSTEM_COUNT !== 42) {
  throw new Error("FIELD_GUIDE_SYSTEM_PROSE has " + SYSTEM_COUNT + " systems, expected 42");
}
for (const [id, words] of Object.entries(FIELD_GUIDE_SYSTEM_PROSE)) {
  for (const field of SYSTEM_PROSE_FIELDS) {
    if (typeof words?.[field] !== "string" || !words[field].trim()) {
      throw new Error("FIELD_GUIDE_SYSTEM_PROSE." + id + "." + field + " is empty");
    }
  }
  // A system is either inhabited or rumoured about, never neither: the dossier
  // prints one of the two under its `01` heading and would print a blank.
  const inhabited = typeof words.inhabitants === "string" && words.inhabitants.trim();
  const rumoured = typeof words.rumour === "string" && words.rumour.trim();
  if (!inhabited && !rumoured) {
    throw new Error("FIELD_GUIDE_SYSTEM_PROSE." + id + " has neither inhabitants nor rumour");
  }
}

const STAR_PROSE_FIELDS = ["councilSeat", "coreFunction", "gift", "shadowGate", "councilMessage"];
let STAR_COUNT = 0;
for (const [systemId, cards] of Object.entries(FIELD_GUIDE_STAR_PROSE)) {
  for (const [cardId, words] of Object.entries(cards)) {
    STAR_COUNT += 1;
    for (const field of STAR_PROSE_FIELDS) {
      if (typeof words?.[field] !== "string" || !words[field].trim()) {
        throw new Error("FIELD_GUIDE_STAR_PROSE." + systemId + "." + cardId + "." + field + " is empty");
      }
    }
    if (!Array.isArray(words.keywords) || words.keywords.length === 0) {
      throw new Error("FIELD_GUIDE_STAR_PROSE." + systemId + "." + cardId + ".keywords is empty");
    }
  }
}
if (STAR_COUNT !== 62) {
  throw new Error("FIELD_GUIDE_STAR_PROSE has " + STAR_COUNT + " cards, expected 62");
}

const FIELD_GUIDE_PROSE = {
  systems: FIELD_GUIDE_SYSTEM_PROSE,
  stars: FIELD_GUIDE_STAR_PROSE,
};

// CHROME IS ON FOR BOTH, measured rather than assumed — `rf-journey`'s row was
// authored with it off on the reasoning that "the section owns the viewport",
// and that was wrong. Both of these routes live under `app/[lang]/**`, and
// `SiteSurfaceChrome` wraps every surface the proxy stamped `x-tgv-site-chrome`
// on with her nav, footer, theme and backdrop. So her live /sun-walk and
// /galactic-field-guide wear both today, and a row that turned them off would
// be the visible regression the whole migration exists to avoid.
//
// The field guide is not an exception to that: its fixed z-100000 layer paints
// OVER the chrome on the route exactly as it will in the row. The chrome is
// still there, still in the DOM, still what a skip link and a rotor find.
const CHROME = { navEnabled: true, footerEnabled: true };

const ROWS = [
  {
    slug: "sun-walk",
    title: "Sun Walk", // matches tenantAppMetadata("Sun Walk", …), so the tab is unchanged
    model: {
      id: "pm-rw-sun-walk",
      slug: "sun-walk",
      title: "Sun Walk",
      chrome: CHROME,
      sections: [
        {
          id: "sec-sun-walk",
          type: "rf-sun-walk",
          label: "The Sun Walk",
          blocks: [],
          enabled: true,
          // Straight from the package — every word the page says. The grid is
          // NOT here and never will be: `SUN_WALK` is Swiss Ephemeris output,
          // and a row that carried a star's crossing date would be a place for
          // the sky to be wrong.
          config: {
            props: { ...SUN_WALK_COPY, currents: CURRENT_INFO, reference: SUN_WALK_REFERENCE },
          },
        },
      ],
    },
    assert: { type: "rf-sun-walk", note: "every word on the page" },
  },
  {
    slug: "galactic-field-guide",
    title: "Galactic Field Guide",
    model: {
      id: "pm-rw-field-guide",
      slug: "galactic-field-guide",
      title: "Galactic Field Guide",
      chrome: CHROME,
      sections: [
        {
          id: "sec-field-guide",
          type: "rf-field-guide",
          label: "Galactic Field Guide",
          blocks: [],
          enabled: true,
          config: {
            props: {
              // The shipped defaults, which is what the route renders: it passes
              // neither, and `GalacticFieldGuideRoot` defaults to these.
              theme: "nocturne",
              readingSize: 1,
              // HER photographs, named. Never the package default, which points
              // at `/images/galacticfieldguide/…` — a shared path, and a shared
              // path is how one customer's artwork reaches another's domain.
              plates,
              // Every word in the guide. A fresh environment seeded from this
              // file gets a complete row; an environment seeded before W10 gets
              // the same words from 13-…sql instead.
              prose: FIELD_GUIDE_PROSE,
            },
          },
        },
      ],
    },
    assert: {
      type: "rf-field-guide",
      note: plateCount + " plate pairs, " + SYSTEM_COUNT + " dossiers, " + STAR_COUNT + " star cards",
    },
  },
];

const TAG = "$rwss$";
const sql = [
  "-- 11-starseed-rows.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.",
  "--",
  "-- The Sun Walk and the Galactic Field Guide as page_models rows, at the exact",
  "-- slugs they already answer on: `/sun-walk` and `/galactic-field-guide`. No",
  "-- redirect and no parallel address, because the addresses are hers and were",
  "-- never up for renaming.",
  "--",
  "-- THESE ROWS DO NOT ANSWER THOSE URLS YET, and that is the plan. Both paths",
  "-- are in resonantweaver's SITE_SURFACES grant, so the proxy hands them to the",
  "-- app routes under `app/[lang]/**` and never rewrites to the tenant path. The",
  "-- route wins while the grant exists. W13 drops the grant and the routes in one",
  "-- commit, and these rows answer the same URLs on the next request — nothing",
  "-- else has to change, which is the point of seeding them public now.",
  "--",
  "-- They ARE public (`is_public = true`), which is how they can be walked at",
  "-- /u/resonantweaver/<slug> for the parity pass before the cutover. That does",
  "-- not double-list them: the sitemap route builds one Map keyed by path, fills",
  "-- it from published+public rows, and only then adds a `SITEMAP_SURFACES` entry",
  "-- `if (!seen.has(...))` — and both sides normalise to a trailing slash, so the",
  "-- row and the grant line collapse onto the same key.",
  "--",
  "-- Idempotent: re-running inserts nothing. Safe to run before a verify pass.",
  "--",
  "--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/11-starseed-rows.sql",
  "",
  "\\set ON_ERROR_STOP on",
  "",
  "BEGIN;",
  "",
  "SELECT set_config('app.actor', 'migration:resonantweaver-starseed-rows', true);",
  "",
];

for (const row of ROWS) {
  const json = JSON.stringify(row.model, null, 2);
  if (json.includes(TAG)) throw new Error("dollar-quote tag collision in " + row.slug);
  sql.push(
    "-- " + row.slug + " — one " + row.assert.type + " section carrying " + row.assert.note + ".",
    "INSERT INTO public.page_models",
    "  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)",
    "SELECT " +
      q(row.slug) +
      ", 'en', 'published', NULL, NULL, " +
      q(row.title) +
      ", true, false,",
    // in_nav false: her nav is authored chrome and already links both. A row
    // that also asked to be in the nav would put each link there twice.
    "       " + TAG + json + TAG + "::jsonb, now(), " + q(SITE),
    " WHERE NOT EXISTS (",
    "   SELECT 1 FROM public.page_models",
    "    WHERE site = " + q(SITE) + " AND slug = " + q(row.slug) + " AND lang = 'en'",
    "      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL",
    " );",
    "",
  );
}

sql.push(
  "-- Assert what landed, not that something landed: a pre-existing row at either",
  "-- slug would have made the INSERT above a silent no-op, and this is what",
  "-- notices.",
  "DO $$",
  "DECLARE n int;",
  "BEGIN",
  "  SELECT count(*) INTO n",
  "    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s",
  "   WHERE p.site = " + q(SITE) + " AND p.slug = 'sun-walk' AND p.mode = 'published'",
  "     AND s->>'type' = 'rf-sun-walk'",
  "     AND s->'config'->'props'->>'title' = " + q(SUN_WALK_COPY.title),
  // The words, counted rather than assumed present: a row seeded before W9 has
  // the title and none of the prose, and would otherwise pass this untouched.
  "     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'currents')) = 8",
  "     AND jsonb_array_length(s->'config'->'props'->'reference'->'anchorWeeks'->'sections') = 3",
  "     AND jsonb_array_length(s->'config'->'props'->'reference'->'weekTypes'->'cards') = 3;",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-sun-walk section titled % carrying 8 currents and both reference essays, found %', " +
    q(SUN_WALK_COPY.title) +
    ", n;",
  "  END IF;",
  "",
  "  SELECT count(*) INTO n",
  "    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s",
  "   WHERE p.site = " + q(SITE) + " AND p.slug = 'galactic-field-guide' AND p.mode = 'published'",
  "     AND s->>'type' = 'rf-field-guide'",
  "     AND s->'config'->'props'->>'theme' = 'nocturne'",
  "     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'plates')) = " +
    plateCount,
  "     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'prose'->'systems')) = " +
    SYSTEM_COUNT,
  "     AND (SELECT coalesce(sum(k.n), 0)",
  "            FROM jsonb_each(s->'config'->'props'->'prose'->'stars') e,",
  "                 LATERAL (SELECT count(*) AS n FROM jsonb_object_keys(e.value)) k) = " +
    STAR_COUNT +
    ";",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-field-guide section carrying " +
    plateCount +
    " plate pairs, " +
    SYSTEM_COUNT +
    " dossiers and " +
    STAR_COUNT +
    " star cards, found %', n;",
  "  END IF;",
  "",
  "  RAISE NOTICE 'assertions passed';",
  "END $$;",
  "",
  "COMMIT;",
  "",
);

/** Single-quote a SQL literal. Every value here is ours, but a title is content
 *  and content is exactly what stops being ours the moment she edits it. */
function q(s) {
  return "'" + String(s).replace(/'/g, "''") + "'";
}

// ── 12 — the same words, into a row that already exists ────────────────────
// W8 seeded both rows with the small surface it had freed; W9 freed the prose.
// Every environment therefore holds an rf-sun-walk section that predates the
// words, and the INSERT above is `WHERE NOT EXISTS`, so it will not touch them.
//
// ADDITIVE, NEVER OVERWRITING: the merge is `<words> || <what the row has>`, so
// the row's own value wins on every key it already carries. Run it twice and the
// second run changes nothing; run it after Marthe has rewritten a current and
// her words stay hers. The price is that a later change to the SHIPPED defaults
// does not reach a row that has already been patched — which is correct. Once
// the words are in her row they are hers, not the build's.
const WORDS = { currents: CURRENT_INFO, reference: SUN_WALK_REFERENCE };
const wordsJson = JSON.stringify(WORDS, null, 2);
if (wordsJson.includes(TAG)) throw new Error("dollar-quote tag collision in the words");

const patch = [
  "-- 12-starseed-sunwalk-words.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.",
  "--",
  "-- The Sun Walk's writing, into the row 11-starseed-rows.sql already seeded.",
  "--",
  "-- The eight currents' descriptions and the two reference essays (the ★",
  "-- anchor-week explainer and the week-types comparison) were compiled into",
  "-- @tgv/module-starseed until W9. They are content — Marthe's words — so they",
  "-- belong in a row she can edit, and this is the migration that moves them.",
  "-- What did NOT move, and never will: `SUN_WALK`, the 52-week grid. It is",
  "-- Swiss Ephemeris output. A current's name and its star's crossing date are",
  "-- astronomy; a current's description is writing.",
  "--",
  "-- Idempotent and non-destructive. The merge is <shipped words> || <the row's",
  "-- own props>, so a key the row already carries wins: re-running changes",
  "-- nothing, and a value she has since rewritten is never clobbered.",
  "--",
  "-- Nothing on screen changes when this runs. The component falls through per",
  "-- field to the same shipped words, so the page said all of this already — the",
  "-- difference is only that from now on it says it because the row does.",
  "--",
  "--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/12-starseed-sunwalk-words.sql",
  "",
  "\\set ON_ERROR_STOP on",
  "",
  "BEGIN;",
  "",
  "SELECT set_config('app.actor', 'migration:resonantweaver-sunwalk-words', true);",
  "",
  "UPDATE public.page_models p",
  "   SET model_json = jsonb_set(",
  "         p.model_json,",
  "         '{sections}',",
  "         (SELECT jsonb_agg(",
  "                   CASE WHEN s->>'type' = 'rf-sun-walk'",
  "                        THEN jsonb_set(",
  "                               s,",
  "                               '{config,props}',",
  "                               " + TAG + wordsJson + TAG + "::jsonb || (s->'config'->'props')",
  "                             )",
  "                        ELSE s END",
  "                   ORDER BY ord)",
  "            FROM jsonb_array_elements(p.model_json->'sections')",
  "                 WITH ORDINALITY AS t(s, ord))",
  "       ),",
  "       updated_at = now()",
  " WHERE p.site = " + q(SITE) + " AND p.slug = 'sun-walk' AND p.lang = 'en'",
  "   AND p.mode = 'published' AND p.user_id IS NOT DISTINCT FROM NULL",
  "   AND p.deleted_at IS NULL",
  "   AND EXISTS (",
  "     SELECT 1 FROM jsonb_array_elements(p.model_json->'sections') s",
  "      WHERE s->>'type' = 'rf-sun-walk'",
  "   );",
  "",
  "-- Assert the row can now say the whole page by itself. This is the check that",
  "-- would have caught a merge that landed the words one level too deep.",
  "DO $$",
  "DECLARE n int;",
  "BEGIN",
  "  SELECT count(*) INTO n",
  "    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s",
  "   WHERE p.site = " + q(SITE) + " AND p.slug = 'sun-walk' AND p.mode = 'published'",
  "     AND s->>'type' = 'rf-sun-walk'",
  "     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'currents')) = 8",
  "     AND jsonb_array_length(s->'config'->'props'->'reference'->'anchorWeeks'->'sections') = 3",
  "     AND jsonb_array_length(s->'config'->'props'->'reference'->'weekTypes'->'cards') = 3",
  "     AND length(s->'config'->'props'->'reference'->'weekTypes'->>'summary') > 40;",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-sun-walk section carrying 8 currents and both reference essays, found %', n;",
  "  END IF;",
  "  RAISE NOTICE 'assertions passed';",
  "END $$;",
  "",
  "COMMIT;",
  "",
];

// ── 13 — the field guide's writing, into a row that already exists ─────────
// Same shape as 12, one wave later and about twenty times the size: 42 dossiers
// and 62 star cards, roughly 170 KB against the 838 bytes the row held before.
// That is the price of the ruling this wave implements — the words have to live
// somewhere a pipeline re-run cannot reach, and the row is that place.
//
// The size is fine and was measured rather than hoped: jsonb TOASTs a value this
// large out of the row proper, the realtime wire chunks at about a megabyte, and
// the editor's history stack shares structure instead of deep-copying, so an
// undo step costs one reference and not another copy of the guide.
//
// ADDITIVE, exactly like 12: `{prose} || <the row's own props>`, so a row that
// already carries a `prose` key keeps every word of it. Re-running changes
// nothing.
const fieldGuideWordsJson = JSON.stringify({ prose: FIELD_GUIDE_PROSE }, null, 2);
if (fieldGuideWordsJson.includes(TAG)) {
  throw new Error("dollar-quote tag collision in the field guide's words");
}

const fieldGuidePatch = [
  "-- 13-starseed-fieldguide-words.sql — GENERATED. See gen-starseed-rows.mjs; do not hand-edit.",
  "--",
  "-- The Galactic Field Guide's writing, into the row 11-starseed-rows.sql",
  "-- already seeded: 42 star-system dossiers and 62 star cards.",
  "--",
  "-- WHAT MOVED AND WHAT DID NOT. Everything a person wrote moves: inhabitants,",
  "-- rumour, landscape, disposition, directive, terrestrial record, carrier",
  "-- signature, the decoded transmission and the margin note on each system, and",
  "-- each star card's council seat, core function, gift, shadow gate, council",
  "-- transmission and keywords. Nothing a telescope produced moves: positions,",
  "-- star tuples, the lines drawn between them, catalogue designations,",
  "-- distances and magnitudes stay in `engine/fieldguide/data.ts`, where the",
  "-- pipeline can rewrite them on any day of the week without touching a word of",
  "-- hers. Before this migration those two lived in one object and whichever the",
  "-- render preferred, somebody's work disappeared without an error.",
  "--",
  "-- Idempotent and non-destructive. The merge is <shipped words> || <the row's",
  "-- own props>, so a `prose` key the row already carries wins outright.",
  "--",
  "-- Nothing on screen changes when this runs. The component falls through per",
  "-- field to the same shipped words, so the guide said all of this already — the",
  "-- difference is only that from now on it says it because the row does.",
  "--",
  "--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/13-starseed-fieldguide-words.sql",
  "",
  "\\set ON_ERROR_STOP on",
  "",
  "BEGIN;",
  "",
  "SELECT set_config('app.actor', 'migration:resonantweaver-fieldguide-words', true);",
  "",
  "UPDATE public.page_models p",
  "   SET model_json = jsonb_set(",
  "         p.model_json,",
  "         '{sections}',",
  "         (SELECT jsonb_agg(",
  "                   CASE WHEN s->>'type' = 'rf-field-guide'",
  "                        THEN jsonb_set(",
  "                               s,",
  "                               '{config,props}',",
  "                               " + TAG + fieldGuideWordsJson + TAG + "::jsonb || (s->'config'->'props')",
  "                             )",
  "                        ELSE s END",
  "                   ORDER BY ord)",
  "            FROM jsonb_array_elements(p.model_json->'sections')",
  "                 WITH ORDINALITY AS t(s, ord))",
  "       ),",
  "       updated_at = now()",
  " WHERE p.site = " + q(SITE) + " AND p.slug = 'galactic-field-guide' AND p.lang = 'en'",
  "   AND p.mode = 'published' AND p.user_id IS NOT DISTINCT FROM NULL",
  "   AND p.deleted_at IS NULL",
  "   AND EXISTS (",
  "     SELECT 1 FROM jsonb_array_elements(p.model_json->'sections') s",
  "      WHERE s->>'type' = 'rf-field-guide'",
  "   );",
  "",
  "-- Assert the row can now say the whole guide by itself, counted on both axes:",
  "-- a merge that landed one level too deep would leave both counts at zero, and",
  "-- a truncated bundle would leave them short.",
  "DO $$",
  "DECLARE n int;",
  "BEGIN",
  "  SELECT count(*) INTO n",
  "    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s",
  "   WHERE p.site = " + q(SITE) + " AND p.slug = 'galactic-field-guide' AND p.mode = 'published'",
  "     AND s->>'type' = 'rf-field-guide'",
  "     AND (SELECT count(*) FROM jsonb_object_keys(s->'config'->'props'->'prose'->'systems')) = " +
    SYSTEM_COUNT,
  "     AND (SELECT coalesce(sum(k.n), 0)",
  "            FROM jsonb_each(s->'config'->'props'->'prose'->'stars') e,",
  "                 LATERAL (SELECT count(*) AS n FROM jsonb_object_keys(e.value)) k) = " +
    STAR_COUNT,
  // One string read all the way through, so the check is not only structural.
  "     AND length(s->'config'->'props'->'prose'->'systems'->'lyra'->>'landscape') > 40;",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-field-guide section carrying " +
    SYSTEM_COUNT +
    " dossiers and " +
    STAR_COUNT +
    " star cards, found %', n;",
  "  END IF;",
  "  RAISE NOTICE 'assertions passed';",
  "END $$;",
  "",
  "COMMIT;",
  "",
];

const write = (name, lines) => {
  const dest = path.join(ROOT, "clients/office.tinyglobalvillage.com/sql/resonantweaver-migration", name);
  const text = lines.join("\n");
  fs.writeFileSync(dest, text);
  return Math.round(text.length / 1024);
};

console.log(
  "wrote 11-starseed-rows.sql — 2 rows, " +
    plateCount +
    " plate pairs, 8 currents, 2 reference essays, " +
    write("11-starseed-rows.sql", sql) +
    " KB",
);
console.log(
  "wrote 12-starseed-sunwalk-words.sql — 8 currents + 2 reference essays, additive, " +
    write("12-starseed-sunwalk-words.sql", patch) +
    " KB",
);
console.log(
  "wrote 13-starseed-fieldguide-words.sql — " +
    SYSTEM_COUNT +
    " dossiers + " +
    STAR_COUNT +
    " star cards, additive, " +
    write("13-starseed-fieldguide-words.sql", fieldGuidePatch) +
    " KB",
);
