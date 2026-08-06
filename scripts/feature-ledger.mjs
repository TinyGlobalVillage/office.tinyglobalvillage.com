#!/usr/bin/env node
// The convergence ledger — what each site HAS versus what the platform OFFERS.
//
// WHY IT EXISTS (Gio, 2026-08-06). Prompted by a real sighting: resonantweaver's
// Settings tab still offers Support and Cart, features dropped from the shared
// registry weeks ago. The symptom was small; the trace was not. Every guard in
// the pooling work is per-artefact and one-directional — a string checked against
// its source file, a row count against a copy, an asset path against `public/`.
// Each answers "did what we ported arrive?" NONE answers "what does this site
// have that the platform does not, and what does the platform have that this site
// has never been given?" The phases track work done, not distance remaining, so a
// gap nobody ported INTO is invisible by construction.
//
// THREE SOURCES THAT DISAGREE IN BOTH DIRECTIONS, and nothing reconciles them:
//
//   canon  — FEATURE_REGISTRY in @tgv/module-dashboard. What the platform offers.
//   wiring — each app's own DashboardFeatureDef list. What that app can render.
//            `mergeFeatureCatalog` passes a host's own keys through UNCHANGED and
//            by design; it is the same seam a bespoke `profile` engine rides in
//            on, so it cannot simply be closed.
//   data   — public.dashboard_features rows. What a member has actually toggled.
//
// READ-ONLY. It opens one connection, runs SELECTs, and writes nothing. Safe on
// production, which is the only place the data half is true.
//
//   ssh -f -N -L 15432:localhost:5432 rcs
//   DATABASE_URL='postgres://…@127.0.0.1:15432/tgv_db' node scripts/feature-ledger.mjs
//   …  --site resonantweaver     one site instead of all
//   …  --json                    machine-readable, for a future Office tile
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { Client } from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
// A worktree lane checks out only the clients it works on — `clients/giocoelho.com`
// there is an empty node_modules shell. Point MAC_RCS_ROOT at the full checkout to
// read every app's wiring; whatever is missing is reported, never skipped quietly.
const REPO = process.env.MAC_RCS_ROOT
  ? resolve(process.env.MAC_RCS_ROOT)
  : resolve(HERE, "..", "..", "..");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const onlySite = ((i) => (i === -1 ? null : args[i + 1]))(args.indexOf("--site"));

// ── canon ───────────────────────────────────────────────────────────────────
const registryPath = join(
  REPO,
  "packages/@tgv/module-core/module-dashboard/dist/helpers/featureRegistry.js",
);
if (!existsSync(registryPath)) {
  console.error(`canon not found at ${registryPath} — build @tgv/module-dashboard first`);
  process.exit(1);
}
const { FEATURE_REGISTRY } = await import(registryPath);
const canon = new Map(FEATURE_REGISTRY.map((d) => [d.key, d]));

// ── wiring ──────────────────────────────────────────────────────────────────
// Each app declares its own DashboardFeatureDef list in one file. Lifted by text:
// there is no way to import a .tsx full of JSX panels from a plain node script,
// and a hand-kept list of keys would be a fourth source of truth — the exact
// thing this script exists to count.
//
// `.deploybuild` and `demo-hq` are deliberately absent: one is a build artefact,
// the other a clone of HQ's own wiring.
const APPS = [
  ["tinyglobalvillage.com", "src/app/[lang]/(app)/dashboard/DashboardWithFeatures.tsx"],
  ["resonantweaver.com", "src/app/[lang]/dashboard/DashboardWithFeatures.tsx"],
  ["refusionist.com", "src/app/[lang]/dashboard/DashboardWithFeatures.tsx"],
  ["giocoelho.com", "src/app/[lang]/dashboard/DashboardWithFeatures.tsx"],
  ["demo-fliring.tinyglobalvillage.com", "src/app/[lang]/(session)/dashboard/DashboardWithFeatures.tsx"],
];

function wiringFor(appDir, relPath) {
  const file = join(REPO, "clients", appDir, relPath);
  if (!existsSync(file)) return null;
  const src = readFileSync(file, "utf8");
  const keys = new Set();
  // A feature def is `{ key: "x", label: "…", …, defaultVisible|panel … }`.
  //
  // THE SHAPE ALONE IS NOT ENOUGH, and the first draft of this script proved it:
  // the Settings tab's own `settingsSections` are `{ key, label, node }`, so a
  // `key`+`label` match reported five sub-panels (sites, welcome, appearance,
  // neon, mobile-bar) as dashboard features every app declared and canon had
  // never heard of — a five-line finding that was entirely this regex. So the
  // window between one `key:` and the next must also carry `defaultVisible` or
  // `panel`, which a settings section (`node:`) never does.
  const matches = [...src.matchAll(/\{\s*key:\s*["']([a-z0-9-]+)["']\s*,\s*label:/gi)];
  for (let i = 0; i < matches.length; i++) {
    const from = matches[i].index;
    const to = i + 1 < matches.length ? matches[i + 1].index : src.length;
    const window = src.slice(from, to);
    if (/\bdefaultVisible\s*:/.test(window) || /\bpanel\s*:/.test(window)) keys.add(matches[i][1]);
  }
  return keys;
}

const wiring = new Map();
const wiringMissing = [];
for (const [dir, rel] of APPS) {
  const keys = wiringFor(dir, rel);
  if (keys) wiring.set(dir, keys);
  else wiringMissing.push(dir);
}

// Which app serves which site. A pooled site is served by HQ; a site still on its
// own process is served by that. This is the one hand-maintained mapping here,
// and it is a claim somebody made rather than something the filesystem knows.
const APP_FOR_SITE = {
  resonantweaver: "resonantweaver.com", // still standalone until the nginx flip
  refusionist: "tinyglobalvillage.com", // pooled 2026-08-05
  giocoelho: "tinyglobalvillage.com", // pooled 2026-08-04
  guardians: "tinyglobalvillage.com",
  nevlo: "tinyglobalvillage.com",
  demo_fliring: "demo-fliring.tinyglobalvillage.com",
};

// ── data ────────────────────────────────────────────────────────────────────
const client = new Client(
  process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {},
);
await client.connect();

const { rows: siteRows } = await client.query(
  `select id, subdomain, client_name from public.villager_sites
    where subdomain is not null order by subdomain`,
);
const { rows: featureRows } = await client.query(
  `select df.site_id, vs.subdomain, df.feature_key, count(*)::int as rows
     from public.dashboard_features df
     left join public.villager_sites vs on vs.id = df.site_id
    group by df.site_id, vs.subdomain, df.feature_key
    order by vs.subdomain nulls first, df.feature_key`,
);
await client.end();

const dataBySite = new Map();
const unkeyed = [];
for (const r of featureRows) {
  if (!r.site_id) {
    unkeyed.push(r);
    continue;
  }
  const key = r.subdomain ?? `(site ${r.site_id})`;
  if (!dataBySite.has(key)) dataBySite.set(key, new Map());
  dataBySite.get(key).set(r.feature_key, r.rows);
}

// ── the ledger ──────────────────────────────────────────────────────────────
const sites = siteRows
  .map((s) => s.subdomain)
  .filter((s) => (onlySite ? s === onlySite : dataBySite.has(s) || APP_FOR_SITE[s]));

const report = [];
for (const site of sites) {
  const data = dataBySite.get(site) ?? new Map();
  const appDir = APP_FOR_SITE[site] ?? null;
  const app = appDir ? (wiring.get(appDir) ?? null) : null;

  const inCanon = [...canon.keys()];
  const inData = [...data.keys()];

  report.push({
    site,
    servedBy: appDir,
    // Never seeded: the platform offers it and this site has no row for it. Not
    // automatically wrong — most keys are `defaultVisible` and need no row — but
    // it is the only list that shows what a tenant has never been offered.
    neverSeeded: inCanon.filter((k) => !data.has(k)),
    // Orphans: a row naming a key the registry no longer has. A toggle that can
    // never do anything. `validRegistryKeys` refuses to PLACE these, so on the
    // pooled renderer they are inert — and they would surface anywhere the host
    // declares the key itself.
    orphanRows: inData.filter((k) => !canon.has(k)),
    // The app renders it, canon does not have it. For a site still on its own
    // process that is what the cutover will silently DROP. For a site already
    // pooled it is drift in HQ's own wiring, live right now — the same seam,
    // read from the other end.
    appOnly: app ? [...app].filter((k) => !canon.has(k)) : null,
    // Canon has it, the app never wired a panel. For a standalone site that is
    // what the cutover ADDS; for a pooled one it is what this tenant's dashboard
    // has never been able to show. Absorbed and stub keys are marked, because
    // "added" would be a lie for a key the registry itself has retired.
    canonOnly: app
      ? inCanon
          .filter((k) => !app.has(k))
          .map((k) => {
            const d = canon.get(k);
            return d?.absorbedBy ? `${k}→${d.absorbedBy}` : d?.stub ? `${k}(stub)` : k;
          })
      : null,
    pooled: appDir === "tinyglobalvillage.com",
  });
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        canonKeys: canon.size,
        sites: report,
        unkeyedRows: unkeyed,
        wiringUnreadable: wiringMissing,
        generatedFrom: registryPath,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const list = (xs) => (xs.length ? xs.join(", ") : "—");

console.log(`\nCONVERGENCE LEDGER`);
console.log(`canon: ${canon.size} keys in @tgv/module-dashboard's FEATURE_REGISTRY`);
for (const [dir, keys] of wiring) console.log(`wiring: ${dir} declares ${keys.size}`);
if (wiringMissing.length) {
  console.log(
    `wiring: NOT READ — ${wiringMissing.join(", ")} ` +
      `(not checked out under ${REPO}; set MAC_RCS_ROOT to the full checkout)`,
  );
}
console.log("");
console.log(
  "A key in `canon > app` is not automatically missing: the package's own Dashboard renders\n" +
    "some built-ins (home, settings, account…) without a host def. The ledger names the gap;\n" +
    "a person decides which side is wrong.",
);
console.log("");

for (const r of report) {
  const data = dataBySite.get(r.site) ?? new Map();
  console.log(`── ${r.site}  (served by ${r.servedBy ?? "unknown"}, ${data.size} keys in data)`);
  console.log(`   never seeded      ${list(r.neverSeeded)}`);
  console.log(`   orphan rows       ${list(r.orphanRows)}`);
  if (r.appOnly) {
    console.log(
      r.pooled
        ? `   app > canon (live)  ${list(r.appOnly)}`
        : `   DROPPED at cutover  ${list(r.appOnly)}`,
    );
    console.log(
      r.pooled
        ? `   canon > app (unseen) ${list(r.canonOnly)}`
        : `   ADDED at cutover    ${list(r.canonOnly)}`,
    );
  } else {
    console.log(`   app wiring        unknown — no entry in APP_FOR_SITE`);
  }
  console.log("");
}

if (unkeyed.length) {
  const total = unkeyed.reduce((n, r) => n + r.rows, 0);
  console.log(
    `⚠ ${total} dashboard_features row(s) carry NO site_id, across ${unkeyed.length} key(s): ` +
      `${unkeyed.map((r) => r.feature_key).join(", ")}`,
  );
  console.log(
    `  A row with no site belongs to no tenant. Since the table was re-keyed on ` +
      `(user, site, feature) these can never be read back — they are plan-29 sweep material.`,
  );
}
