// The Office e-sign document library ("My Documents" in the New Document wizard).
//
// Two shelves, one list:
//   template — PDFs shipped with the repo at data/esign/library/ (the three Agreement
//              templates: 1 / 2 / 3 signers, three pages, initials on every page). Read-only.
//   library  — PDFs an operator uploaded from disk and asked to keep, at
//              /srv/refusion-core/data/legal/library/ (ESIGN_LIBRARY_DIR overrides it, which is
//              how a Mac dev run gets a writable shelf). Each shelf carries a manifest.json with
//              the display title and, for templates, the signer and page counts.
//
// Nothing here talks to Documenso: a library entry is a plain PDF on disk until the wizard stages
// it, and staging is still "nothing happens until you press Send".
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type LibrarySource = "template" | "library";
export type LibraryEntry = {
  source: LibrarySource;
  name: string;
  title: string;
  size: number;
  addedAt: string;
  addedBy?: string;
  signers?: number;
  pages?: number;
};

type Manifest = Record<string, { title?: string; signers?: number; pages?: number; addedAt?: string; addedBy?: string }>;

export const TEMPLATE_DIR = path.join(process.cwd(), "data", "esign", "library");
export const LIBRARY_DIR = process.env.ESIGN_LIBRARY_DIR || "/srv/refusion-core/data/legal/library";
export const MAX_PDF_BYTES = 20 * 1024 * 1024; // the same cap the Send route enforces
const MANIFEST = "manifest.json";

// A library file name is lower-case, dotted or dashed, and ends in .pdf — nothing that could
// walk a directory, and nothing the route would then have to quote.
export const NAME_RE = /^[a-z0-9][a-z0-9._-]*\.pdf$/;
export const isSource = (s: string): s is LibrarySource => s === "template" || s === "library";
export const dirFor = (source: LibrarySource) => (source === "template" ? TEMPLATE_DIR : LIBRARY_DIR);

/** Resolve a (source, name) pair to a file path, refusing anything outside its shelf. */
export function resolveEntry(source: LibrarySource, name: string): string | null {
  if (!NAME_RE.test(name)) return null;
  const root = dirFor(source);
  const resolved = path.resolve(root, name);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

async function readManifest(dir: string): Promise<Manifest> {
  try {
    const raw = await readFile(path.join(dir, MANIFEST), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Manifest) : {};
  } catch {
    return {};
  }
}

async function writeManifest(dir: string, m: Manifest) {
  await writeFile(path.join(dir, MANIFEST), JSON.stringify(m, null, 2) + "\n", "utf8");
}

/** Turn a file name into a readable title when the manifest has none. */
function titleFromName(name: string) {
  const base = name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : name;
}

/** Turn an operator's title or a file's original name into a shelf-safe file name. */
export function slugName(raw: string): string {
  const base = raw.replace(/\.pdf$/i, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return `${base || "document"}.pdf`;
}

async function listShelf(source: LibrarySource): Promise<LibraryEntry[]> {
  const dir = dirFor(source);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return []; // the shelf does not exist yet — an empty list, not an error
  }
  const manifest = await readManifest(dir);
  const out: LibraryEntry[] = [];
  for (const name of names) {
    if (!NAME_RE.test(name)) continue;
    let st;
    try {
      st = await stat(path.join(dir, name));
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const m = manifest[name] ?? {};
    out.push({
      source,
      name,
      title: m.title || titleFromName(name),
      size: st.size,
      addedAt: m.addedAt || st.mtime.toISOString(),
      ...(m.addedBy ? { addedBy: m.addedBy } : {}),
      ...(typeof m.signers === "number" ? { signers: m.signers } : {}),
      ...(typeof m.pages === "number" ? { pages: m.pages } : {}),
    });
  }
  // Templates by signer count; uploads newest first.
  out.sort((a, b) =>
    source === "template"
      ? (a.signers ?? 99) - (b.signers ?? 99) || a.title.localeCompare(b.title)
      : b.addedAt.localeCompare(a.addedAt),
  );
  return out;
}

export async function listLibrary(): Promise<LibraryEntry[]> {
  const [templates, mine] = await Promise.all([listShelf("template"), listShelf("library")]);
  return [...templates, ...mine];
}

/** Keep an uploaded PDF on the library shelf. Returns the entry as the list will show it. */
export async function addToLibrary(opts: { pdf: Buffer; title: string; originalName: string; addedBy: string }): Promise<LibraryEntry> {
  await mkdir(LIBRARY_DIR, { recursive: true });
  const manifest = await readManifest(LIBRARY_DIR);
  // A second upload with the same name gets a numbered twin rather than overwriting the first.
  let name = slugName(opts.title || opts.originalName);
  const stem = name.replace(/\.pdf$/, "");
  for (let i = 2; manifest[name] || (await exists(path.join(LIBRARY_DIR, name))); i++) name = `${stem}-${i}.pdf`;
  const file = resolveEntry("library", name);
  if (!file) throw new Error("Could not derive a library file name");
  await writeFile(file, opts.pdf);
  const addedAt = new Date().toISOString();
  const title = opts.title || titleFromName(name);
  manifest[name] = { title, addedAt, addedBy: opts.addedBy };
  await writeManifest(LIBRARY_DIR, manifest);
  return { source: "library", name, title, size: opts.pdf.length, addedAt, addedBy: opts.addedBy };
}

/** Remove an uploaded PDF from the library shelf (templates are never removable). */
export async function removeFromLibrary(name: string): Promise<boolean> {
  const file = resolveEntry("library", name);
  if (!file) return false;
  try {
    await unlink(file);
  } catch {
    return false;
  }
  const manifest = await readManifest(LIBRARY_DIR);
  if (manifest[name]) {
    delete manifest[name];
    await writeManifest(LIBRARY_DIR, manifest);
  }
  return true;
}

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}
