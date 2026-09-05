// Author Marthe's two starseed rows straight from the code the ROUTES render,
// so the section and the route say the same words and any difference in the
// browser is the mechanism rather than the content.
//
// Forked from `gen-journey-row.mjs`, and thinner than it: the journey's stops
// are ~8 KB of authored content that had to be lifted out of a client app,
// whereas the Sun Walk's 52-week grid and the Field Guide's 42 systems are
// COMPILED IN and stay that way through W8. What a row carries today is the
// small surface a host is allowed to differ on:
//
//   rf-sun-walk    — the three strings above the calendar
//   rf-field-guide — paper stock, reading size, and WHOSE photographs
//
// Two things are still read from source rather than retyped here, because those
// are the two the row could silently disagree with the route about:
//
//   SUN_WALK_COPY          — `@tgv/module-starseed/starseed/sunwalk/copy.ts`
//   fieldGuidePlatesForSite — tinyglobalvillage.com's `lib/starseed/fieldGuidePlates.ts`
//
// Both are dependency-free modules, so esbuild bundles them without dragging in
// React or styled-components.
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
    "export { SUN_WALK_COPY } from " +
      JSON.stringify(
        path.join(ROOT, "packages/@tgv/module-orakle/module-starseed/starseed/sunwalk/copy"),
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
const { SUN_WALK_COPY, fieldGuidePlatesForSite } = await import(pathToFileURL(out).href);
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
          // Straight from the package. The grid, the eight currents' prose and
          // the four reference essays are NOT here: the grid never will be
          // (Swiss Ephemeris output), the prose arrives in W9.
          config: { props: { ...SUN_WALK_COPY } },
        },
      ],
    },
    assert: { type: "rf-sun-walk", note: "the three header strings" },
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
            },
          },
        },
      ],
    },
    assert: { type: "rf-field-guide", note: plateCount + " plate pairs" },
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
  "     AND s->'config'->'props'->>'title' = " + q(SUN_WALK_COPY.title) + ";",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-sun-walk section titled %, found %', " +
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
    plateCount +
    ";",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-field-guide section carrying " +
    plateCount +
    " plate pairs, found %', n;",
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

const dest = path.join(
  ROOT,
  "clients/office.tinyglobalvillage.com/sql/resonantweaver-migration/11-starseed-rows.sql",
);
const text = sql.join("\n");
fs.writeFileSync(dest, text);
console.log(
  "wrote 11-starseed-rows.sql — 2 rows, " +
    plateCount +
    " plate pairs, " +
    Math.round(text.length / 1024) +
    " KB",
);
