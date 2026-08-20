#!/usr/bin/env node
// scripts/check-override-scope.mjs — the content_overrides access gate
// (scope-architecture P6, 2026-08-19).
//
// content_overrides is scope-columned (site 0110, user_id, tenant_id 0013):
// an unfiltered column is a wildcard, and NULL-means-platform makes a
// forgotten filter silent (bug class: duplicate-published-theme-rows). All
// access goes through the overrideStore accessor
// (@tgv/module-page-editor editor/data/overrideStore) where it can mount;
// Office mounts no drizzle schema for this table, so any new access here
// needs its own justified allowlist entry. This gate fails the build when any other file names the table —
// in raw SQL (`content_overrides`) or via the drizzle handle
// (`contentOverrides`) — outside the allowlist below. Comments don't count.
//
// Wired as `prebuild` so `pnpm run build` refuses to ship a new raw reader.
// Adding a file to the allowlist is a conscious act that needs the same
// justification the existing entries carry.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOTS = ["src"];
const EXTS = new Set([".ts", ".tsx", ".mts", ".cts"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", ".turbo"]);

const ALLOWLIST = new Set([
  // Sandbox block-default editor: Office mounts no drizzle schema for this
  // table, so the route speaks the accessor's sandbox semantics in raw
  // parameterized SQL — every statement states `site IS NULL` + the
  // platform-draft actor rules (scope-architecture P4, 2026-08-19).
  "src/app/api/sandbox/block-default/route.ts",
]);

const offenders = [];

function scan(file, rel) {
  let s = readFileSync(file, "utf8");
  // Blank out block comments but keep line numbers.
  s = s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  s.split("\n").forEach((line, i) => {
    const code = line.split("//")[0];
    if (code.includes("content_overrides") || /\bcontentOverrides\b/.test(code)) {
      offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  });
}

function walk(dir, relDir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(path.join(dir, entry.name), rel);
    } else if (EXTS.has(path.extname(entry.name)) && !ALLOWLIST.has(rel)) {
      scan(path.join(dir, entry.name), rel);
    }
  }
}

for (const root of ROOTS) walk(path.join(process.cwd(), root), root);

if (offenders.length) {
  console.error(
    "override-scope gate: content_overrides accessed outside the accessor.\n" +
      "Office has no scoped accessor mounted for this table — copy the allowlisted\n" +
      "route's scope discipline (site IS NULL + actor rules), then allowlist with a why.\n" +
      "or add a justified allowlist entry in scripts/check-override-scope.mjs.\n"
  );
  for (const o of offenders) console.error("  " + o);
  process.exit(1);
}
console.log("override-scope gate: clean");
