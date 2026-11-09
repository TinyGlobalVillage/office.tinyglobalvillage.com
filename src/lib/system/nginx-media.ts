// nginx-media.ts — the /media/ (CDN) access policy: read/write the config, generate
// the nginx `map $uri $media_serve { … }`, and apply it to the live box.
//
// This is the box-apply half of the "Media Folder" hardening tile (audit 2026-11-07
// #29). It mirrors src/lib/host-metrics/config.ts (never-throwing JSON config under
// process.cwd()/data) and src/lib/system/ufw.ts (privileged box action via a single
// `sudo -n` shell-out, every input regex-validated before it reaches a shell).
//
// Policy model (see data/media-folder/media-folder-config.json._note):
//   mode=denylist (DEFAULT, = historical prod): serve everything except privateFolders.
//   mode=allowlist (deny-by-default): serve ONLY publicRoots + publicCabinets.
//   privateFolders are denied FIRST in both modes (ordered-regex, first match wins),
//   so a private name always beats a broad public root.
import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const execFileP = promisify(execFile);

export type MediaMode = "denylist" | "allowlist";

export interface MediaFolderConfig {
  mode: MediaMode;
  privateFolders: string[];
  publicCabinets: string[];
  publicRoots: string[];
  lastUpdated: string | null;
  lastAppliedAt: string | null;
}

export interface MediaFolderSnapshot extends MediaFolderConfig {
  // Preview of the nginx map the current config generates, so the GUI can show
  // exactly what an Apply would install without re-deriving it client-side.
  generatedMap: string;
}

// A folder name is matched case-sensitively as ONE path segment under /media/.
// Allow letters/digits/dot/dash/underscore; must start alnum; no slash, no "..".
// This is the ONLY thing that ever reaches the generated regex, so validate hard.
const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export function isValidFolderName(name: unknown): name is string {
  return typeof name === "string" && NAME_RE.test(name) && !name.includes("..");
}

const DIR = path.join(process.cwd(), "data", "media-folder");
const CONFIG_PATH = path.join(DIR, "media-folder-config.json");
const GENERATED_PATH = path.join(DIR, "media-allowlist.conf.generated");

const DEFAULTS: MediaFolderConfig = {
  mode: "denylist",
  privateFolders: ["documents", "users", "chat"],
  publicCabinets: ["avatars", "backgrounds", "editor-uploads", "imported", "landing", "nav", "welcome"],
  publicRoots: ["office", "embed", "gen-favicons"],
  lastUpdated: null,
  lastAppliedAt: null,
};

function dedupeValid(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  const out: string[] = [];
  for (const v of arr) if (isValidFolderName(v) && !out.includes(v)) out.push(v);
  return out;
}

function coerce(raw: unknown): MediaFolderConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const mode: MediaMode = r.mode === "allowlist" ? "allowlist" : "denylist";
  return {
    mode,
    privateFolders: dedupeValid(r.privateFolders).length ? dedupeValid(r.privateFolders) : DEFAULTS.privateFolders.slice(),
    publicCabinets: dedupeValid(r.publicCabinets),
    publicRoots: dedupeValid(r.publicRoots),
    lastUpdated: typeof r.lastUpdated === "string" ? r.lastUpdated : null,
    lastAppliedAt: typeof r.lastAppliedAt === "string" ? r.lastAppliedAt : null,
  };
}

// Never throws — a missing/corrupt file yields the safe defaults (= current prod).
export function readConfig(): MediaFolderConfig {
  try {
    return coerce(JSON.parse(readFileSync(CONFIG_PATH, "utf8")));
  } catch {
    return { ...DEFAULTS, privateFolders: DEFAULTS.privateFolders.slice(), publicCabinets: DEFAULTS.publicCabinets.slice(), publicRoots: DEFAULTS.publicRoots.slice() };
  }
}

export function writeConfig(patch: Partial<MediaFolderConfig>): MediaFolderConfig {
  const cur = readConfig();
  const next = coerce({ ...cur, ...patch });
  next.lastUpdated = new Date().toISOString();
  // keep lastAppliedAt unless the caller explicitly set it
  if (!("lastAppliedAt" in patch)) next.lastAppliedAt = cur.lastAppliedAt;
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...next, _note: NOTE }, null, 2) + "\n", "utf8");
  return next;
}

const NOTE =
  "Source of truth for the /media/ (CDN) access policy served off /srv/refusion-core/cdn. " +
  "The Office 'Media Folder' hardening tile (System Hardening) writes this file; " +
  "utils/scripts/media/media-allowlist-apply.sh installs the generated map to " +
  "/etc/nginx/conf.d/media-allowlist.conf and reloads nginx. mode=denylist (default, = the " +
  "historical prod behaviour) serves everything EXCEPT privateFolders. mode=allowlist " +
  "(deny-by-default) serves ONLY publicCabinets (<name>/ under any one tenant) and publicRoots " +
  "(whole /media/<name>/ bucket); privateFolders are ALWAYS denied on top, in both modes. " +
  "Folder names match case-sensitively as a path segment under /media/.";

// Only "." needs escaping given NAME_RE; escape "\" too for total safety.
function escapeRe(s: string): string {
  return s.replace(/[.\\]/g, "\\$&");
}

export function generateMapConf(cfg: MediaFolderConfig): string {
  const L: string[] = [];
  L.push("# AUTO-GENERATED — do not edit by hand.");
  L.push("# Written by clients/office.tinyglobalvillage.com/src/lib/system/nginx-media.ts");
  L.push("# from data/media-folder/media-folder-config.json. Tune it in TGV Office →");
  L.push("# Utils → System Hardening → Media Folder.  (audit 2026-11-07 #29)");
  L.push(`# mode=${cfg.mode}`);
  L.push("# $media_serve: 1 = nginx serves the /media/ file, 0 = return 404.");
  L.push("map $uri $media_serve {");
  L.push(`    default ${cfg.mode === "allowlist" ? "0" : "1"};`);
  L.push("");
  L.push("    # always-private — denied in BOTH modes; emitted first so they win.");
  for (const n of cfg.privateFolders) {
    L.push(`    "~^/media/(.+/)?${escapeRe(n)}/"   0;`);
  }
  if (cfg.mode === "allowlist") {
    if (cfg.publicRoots.length) {
      L.push("");
      L.push("    # public roots — a whole /media/<name>/ bucket.");
      for (const n of cfg.publicRoots) L.push(`    "~^/media/${escapeRe(n)}/"   1;`);
    }
    if (cfg.publicCabinets.length) {
      L.push("");
      L.push("    # public cabinets — <name>/ under any one tenant.");
      for (const n of cfg.publicCabinets) L.push(`    "~^/media/[^/]+/${escapeRe(n)}/"   1;`);
    }
  }
  L.push("}");
  L.push("");
  return L.join("\n");
}

export function snapshot(): MediaFolderSnapshot {
  const cfg = readConfig();
  return { ...cfg, generatedMap: generateMapConf(cfg) };
}

const REFUSION_ROOT = process.env.REFUSION_ROOT || "/srv/refusion-core";
const APPLY_SCRIPT = path.join(REFUSION_ROOT, "utils", "scripts", "media", "media-allowlist-apply.sh");

export interface ApplyResult {
  ok: boolean;
  detail: string;
  appliedAt?: string;
}

// Writes the generated map to disk, then runs the privileged apply script via a
// single `sudo -n` (the same shape ufw.ts uses). Never throws — returns a result
// the GUI can display. Stamps lastAppliedAt on success.
export async function applyPolicy(): Promise<ApplyResult> {
  const cfg = readConfig();
  const conf = generateMapConf(cfg);
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(GENERATED_PATH, conf, "utf8");
  } catch (err) {
    return { ok: false, detail: `could not write generated map: ${(err as Error).message}` };
  }
  try {
    const { stdout } = await execFileP("sudo", ["-n", "bash", APPLY_SCRIPT, GENERATED_PATH], {
      timeout: 20_000,
      maxBuffer: 1024 * 1024,
    });
    const appliedAt = new Date().toISOString();
    writeConfig({ lastAppliedAt: appliedAt });
    return { ok: true, detail: stdout.trim() || "applied", appliedAt };
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const detail = (e.stderr || e.stdout || e.message || "apply failed").toString().trim();
    return { ok: false, detail };
  }
}

type ListKey = "privateFolders" | "publicCabinets" | "publicRoots";

const LISTS: ListKey[] = ["privateFolders", "publicCabinets", "publicRoots"];

export function addFolder(list: ListKey, name: string): MediaFolderConfig {
  if (!LISTS.includes(list)) throw new Error("bad list");
  if (!isValidFolderName(name)) throw new Error("invalid folder name");
  const cur = readConfig();
  const next = cur[list].includes(name) ? cur[list] : [...cur[list], name];
  return writeConfig({ [list]: next } as Partial<MediaFolderConfig>);
}

export function removeFolder(list: ListKey, name: string): MediaFolderConfig {
  if (!LISTS.includes(list)) throw new Error("bad list");
  const cur = readConfig();
  return writeConfig({ [list]: cur[list].filter((n) => n !== name) } as Partial<MediaFolderConfig>);
}

export function setMode(mode: MediaMode): MediaFolderConfig {
  return writeConfig({ mode: mode === "allowlist" ? "allowlist" : "denylist" });
}
