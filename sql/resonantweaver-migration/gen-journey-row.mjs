// Author the rf-journey comparison row straight from her data, so the section
// and the package render the SAME content and any difference in the browser is
// the mechanism rather than the words.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/Users/macbookpro/Documents/REFUSIONBOX/MAC RCS/.claude/worktrees/office";
const RW = path.join(ROOT, "clients/resonantweaver.com");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rwj-"));
const entry = path.join(tmp, "e.ts");
const out = path.join(tmp, "d.mjs");
fs.writeFileSync(
  entry,
  "export { chakraSections } from " +
    JSON.stringify(path.join(RW, "src/data/journey/chakraSections")) +
    ";",
);
execFileSync(path.join(ROOT, "node_modules/.bin/esbuild"), [
  entry,
  "--bundle",
  "--format=esm",
  "--platform=node",
  "--outfile=" + out,
  "--log-level=error",
]);
const { chakraSections } = await import(pathToFileURL(out).href);
fs.rmSync(tmp, { recursive: true, force: true });

const model = {
  id: "pm-rw-journey",
  slug: "journey-preview",
  title: "The Starwoven Journey",
  // Nav and footer OFF: the section owns the viewport and its own scroll.
  chrome: { navEnabled: false, footerEnabled: false },
  sections: [
    {
      id: "sec-journey",
      type: "rf-journey",
      label: "The Seven Gates",
      blocks: [],
      enabled: true,
      config: {
        props: {
          eyebrow: "An embodied inquiry",
          title: "The Seven",
          titleAccent: "Gates",
          lede:
            "A journey through some of the body's energetic architecture. Each gate is a world. At each one, a breathing practice and a reflection are waiting. Move at your own pace.",
          ctaLabel: "Begin the Journey",
          ground: "#030008",
          transitionMs: 700,
          stops: chakraSections,
        },
      },
    },
  ],
};

const TAG = "$rwj$";
const json = JSON.stringify(model, null, 2);
if (json.includes(TAG)) throw new Error("dollar-quote tag collision");
const n = chakraSections.length;

const sql = [
  "-- 03-journey-preview.sql — GENERATED. See scratchpad/gen-journey-row.mjs.",
  "--",
  "-- The journey as an `rf-journey` SECTION, authored at slug `journey-preview`",
  "-- so it can be driven side by side with the package version still serving",
  "-- /journey, before anything is deleted. Both carry the same stops, straight",
  "-- out of her own `src/data/journey/chakraSections.ts`, so a difference in the",
  "-- browser is the mechanism and not the words.",
  "--",
  "-- Nav and footer are OFF and this is the page's only section: it owns the",
  "-- viewport and its own scroll container. That is the one thing about being a",
  "-- section rather than a route that had to be proven rather than asserted.",
  "--",
  "--   psql -v ON_ERROR_STOP=1 -d tgv_db -f sql/resonantweaver-migration/03-journey-preview.sql",
  "",
  "\\set ON_ERROR_STOP on",
  "",
  "BEGIN;",
  "",
  "SELECT set_config('app.actor', 'migration:resonantweaver-journey-preview', true);",
  "",
  "INSERT INTO public.page_models",
  "  (slug, lang, mode, user_id, deleted_at, title, is_public, in_nav, model_json, updated_at, site)",
  "SELECT 'journey-preview', 'en', 'published', NULL, NULL, 'The Starwoven Journey', true, false,",
  "       " + TAG + json + TAG + "::jsonb, now(), 'resonantweaver'",
  " WHERE NOT EXISTS (",
  "   SELECT 1 FROM public.page_models",
  "    WHERE site = 'resonantweaver' AND slug = 'journey-preview' AND lang = 'en'",
  "      AND mode = 'published' AND user_id IS NOT DISTINCT FROM NULL",
  " );",
  "",
  "DO $$",
  "DECLARE n int;",
  "BEGIN",
  "  SELECT count(*) INTO n",
  "    FROM public.page_models p, LATERAL jsonb_array_elements(p.model_json->'sections') s",
  "   WHERE p.site = 'resonantweaver' AND p.slug = 'journey-preview'",
  "     AND s->>'type' = 'rf-journey'",
  "     AND jsonb_array_length(s->'config'->'props'->'stops') = " + n + ";",
  "  IF n <> 1 THEN",
  "    RAISE EXCEPTION 'assert: expected one rf-journey section carrying " + n + " stops, found %', n;",
  "  END IF;",
  "  RAISE NOTICE 'assertions passed';",
  "END $$;",
  "",
  "COMMIT;",
  "",
].join("\n");

fs.writeFileSync(
  path.join(
    ROOT,
    "clients/office.tinyglobalvillage.com/sql/resonantweaver-migration/03-journey-preview.sql",
  ),
  sql,
);
console.log(
  "wrote 03-journey-preview.sql — " + n + " stops, " + Math.round(json.length / 1024) + " KB of props",
);
