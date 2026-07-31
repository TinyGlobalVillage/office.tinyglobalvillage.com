#!/usr/bin/env node
/**
 * SVG Lab manifest engine — scans every icon source the office app can import
 * (local icons + @tgv package icon files) and writes
 * src/app/components/svg-lab/manifest.generated.ts.
 *
 * Run from the office client root INSIDE the monorepo lane (needs ../../packages/@tgv
 * on disk to scan sources; imports in the generated file resolve via each package's
 * exports map at build time). Re-run whenever icons are added:  npm run svg:manifest
 *
 * Detection is deliberately dumb: `export default function X` / `export function X`
 * in designated icon files. Components needing required props must be excluded here.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PKGS = join(ROOT, "..", "..", "packages", "@tgv");

// Named exports that are not zero-prop icon components.
const EXCLUDE = new Set(["TrustIcon", "FacebookIframe"]);

/** @type {Array<{id:string,label:string,kind:"dir-default"|"dir-parse"|"file-named"|"explicit",dir?:string,file?:string,importBase?:string,importPath?:string,files?:Array<{file:string,importPath:string}>}>} */
const SOURCES = [
  {
    id: "office",
    label: "Office icons",
    kind: "dir-default",
    dir: join(ROOT, "src/app/components/icons"),
    importBase: "@/app/components/icons",
  },
  {
    id: "office-brand",
    label: "Office brand",
    kind: "explicit",
    files: [
      { file: join(ROOT, "src/app/components/LibraryIcon.tsx"), importPath: "@/app/components/LibraryIcon" },
      { file: join(ROOT, "src/app/components/sandbox/SandboxIcon.tsx"), importPath: "@/app/components/sandbox/SandboxIcon" },
      { file: join(ROOT, "src/app/components/claude/ClaudeIcon.tsx"), importPath: "@/app/components/claude/ClaudeIcon" },
    ],
  },
  {
    id: "library",
    label: "Component Library",
    kind: "dir-parse",
    dir: join(PKGS, "module-core/module-component-library/components/icons"),
    importBase: "@tgv/module-component-library/components/icons",
  },
  {
    id: "tgv-v5",
    label: "TGV v5 Feature",
    kind: "file-named",
    file: join(PKGS, "module-core/module-component-library/components/tgv-v5/icons/FeatureIcons.tsx"),
    importPath: "@tgv/module-component-library/components/tgv-v5",
  },
  {
    id: "video-stage",
    label: "Video Calls",
    kind: "file-named",
    file: join(PKGS, "module-connect/module-video-calls/meetings/stage/icons.tsx"),
    importPath: "@tgv/module-video-calls/meetings/stage/icons",
  },
  {
    id: "video-leave",
    label: "Video Calls",
    kind: "explicit",
    files: [
      { file: join(PKGS, "module-connect/module-video-calls/_icons/LeaveIcon.tsx"), importPath: "@tgv/module-video-calls/_icons/LeaveIcon" },
    ],
  },
  {
    id: "editor-toolbar",
    label: "Page Editor toolbar",
    kind: "file-named",
    file: join(PKGS, "module-core/module-page-editor/editor/page-editor/toolbar/EditorToolbar.icons.tsx"),
    importPath: "@tgv/module-page-editor/editor/page-editor/toolbar/EditorToolbar.icons",
  },
  {
    id: "paint",
    label: "Paint Mode",
    kind: "file-named",
    file: join(PKGS, "module-core/module-page-editor/editor/paint/icons.tsx"),
    importPath: "@tgv/module-page-editor/editor/paint/icons",
  },
  {
    id: "link-tools",
    label: "Link Tools",
    kind: "file-named",
    file: join(PKGS, "module-core/module-page-editor/editor/component-library/marketing/link-tools/shared/icons.tsx"),
    importPath: "@tgv/module-page-editor/editor/component-library/marketing/link-tools/shared/icons",
  },
];

const DEFAULT_RE = /^export\s+default\s+function\s+([A-Za-z0-9_]+)/m;
const NAMED_RE = /^export\s+function\s+([A-Za-z0-9_]+)/gm;

function tsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => {
      if (e.isDirectory()) return tsxFiles(join(dir, e.name)).map((f) => join(e.name, f));
      return e.name.endsWith(".tsx") ? [e.name] : [];
    })
    .sort();
}

const imports = [];
const entries = [];
let n = 0;
const skipped = [];

function addEntry({ sourceId, sourceLabel, name, importPath, exportName }) {
  if (EXCLUDE.has(name) || EXCLUDE.has(exportName)) { skipped.push(`${sourceId}/${name}`); return; }
  const alias = `I${n++}`;
  imports.push(
    exportName === "default"
      ? `import ${alias} from "${importPath}";`
      : `import { ${exportName} as ${alias} } from "${importPath}";`,
  );
  entries.push({ key: `${sourceId}/${name}`, name, source: sourceId, sourceLabel, importPath, exportName, alias });
}

for (const src of SOURCES) {
  if (src.kind === "dir-default" || src.kind === "dir-parse") {
    if (!existsSync(src.dir)) { console.error(`missing dir: ${src.dir}`); process.exit(1); }
    for (const rel of tsxFiles(src.dir)) {
      const code = readFileSync(join(src.dir, rel), "utf8");
      const base = rel.replace(/\.tsx$/, "");
      const importPath = `${src.importBase}/${base}`;
      const def = code.match(DEFAULT_RE);
      if (def) {
        addEntry({ sourceId: src.id, sourceLabel: src.label, name: base.split("/").pop(), importPath, exportName: "default" });
        continue;
      }
      let found = false;
      for (const m of code.matchAll(NAMED_RE)) {
        addEntry({ sourceId: src.id, sourceLabel: src.label, name: m[1], importPath, exportName: m[1] });
        found = true;
      }
      if (!found) skipped.push(`${src.id}/${base} (no export match)`);
    }
  } else if (src.kind === "file-named") {
    const code = readFileSync(src.file, "utf8");
    for (const m of code.matchAll(NAMED_RE)) {
      addEntry({ sourceId: src.id, sourceLabel: src.label, name: m[1], importPath: src.importPath, exportName: m[1] });
    }
  } else if (src.kind === "explicit") {
    for (const f of src.files) {
      const code = readFileSync(f.file, "utf8");
      const def = code.match(DEFAULT_RE);
      const base = f.file.split("/").pop().replace(/\.tsx$/, "");
      if (def) addEntry({ sourceId: src.id, sourceLabel: src.label, name: base, importPath: f.importPath, exportName: "default" });
      else skipped.push(`${src.id}/${base} (no default export)`);
    }
  }
}

const bySource = [];
for (const e of entries) {
  const g = bySource.find((s) => s.label === e.sourceLabel);
  if (g) g.count++;
  else bySource.push({ id: e.source, label: e.sourceLabel, count: 1 });
}

const out = `/**
 * AUTO-GENERATED by scripts/generate-svg-manifest.mjs — DO NOT EDIT BY HAND.
 * Re-run \`npm run svg:manifest\` (from the monorepo lane) after adding icons.
 * ${entries.length} icons across ${bySource.length} source groups.${skipped.length ? `\n * Skipped: ${skipped.join(", ")}` : ""}
 */
import type { ComponentType } from "react";
${imports.join("\n")}

// Icon components have heterogeneous prop shapes ({size?} & SVGProps etc.) — the
// lab renders them bare and edits serialized output, so props are irrelevant here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SvgLabComponent = ComponentType<any>;

export type SvgManifestEntry = {
  key: string;
  name: string;
  source: string;
  sourceLabel: string;
  importPath: string;
  Comp: SvgLabComponent;
};

export const SVG_MANIFEST: SvgManifestEntry[] = [
${entries
  .map(
    (e) =>
      `  { key: ${JSON.stringify(e.key)}, name: ${JSON.stringify(e.name)}, source: ${JSON.stringify(e.source)}, sourceLabel: ${JSON.stringify(e.sourceLabel)}, importPath: ${JSON.stringify(e.importPath)}, Comp: ${e.alias} },`,
  )
  .join("\n")}
];

export const SVG_SOURCE_GROUPS: { id: string; label: string; count: number }[] = ${JSON.stringify(bySource, null, 2)};
`;

const outPath = join(ROOT, "src/app/components/svg-lab/manifest.generated.ts");
writeFileSync(outPath, out);
console.log(`wrote ${outPath}: ${entries.length} icons, ${bySource.length} groups${skipped.length ? `, skipped ${skipped.length}` : ""}`);
