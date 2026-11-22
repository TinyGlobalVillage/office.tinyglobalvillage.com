// Diary share links — every RCS Diary entry opens straight from a URL (Gio 2026-11-21).
//
//   /diary/<name>  → redirect → /dashboard?tile=Diary&view=<date>/<slug> (the diary opens on that entry)
//
// An entry's link name is its slug (or <date>-<slug> when two days share a slug) until someone
// renames it. A rename never breaks a link that's already out: the old name becomes a redirect.
// State lives beside the entries: <diary root>/links.json
//   { "names":     { "<date>/<slug>": "<current name>" },   // only renamed entries
//     "redirects": { "<old name>":   "<date>/<slug>" } }
// Server-only (fs). The name rule is the template-link one (src/lib/template-link-name.ts).
import { promises as fs } from "node:fs";
import path from "node:path";
import { ROOT, isDate, isSlug, listDates, listEntriesForDate } from "@/app/api/diary/_lib";
import { cleanLinkName, isValidLinkName } from "@/lib/template-link-name";

const FILE = () => path.join(ROOT, "links.json");
type Links = { names: Record<string, string>; redirects: Record<string, string> };

export class LinkError extends Error {
  constructor(msg: string, public status = 400) { super(msg); }
}

async function readLinks(): Promise<Links> {
  try {
    const j = JSON.parse(await fs.readFile(FILE(), "utf8")) as Partial<Links>;
    return { names: { ...(j.names ?? {}) }, redirects: { ...(j.redirects ?? {}) } };
  } catch {
    return { names: {}, redirects: {} };
  }
}
async function writeLinks(l: Links): Promise<void> {
  const tmp = `${FILE()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(l, null, 2) + "\n", { mode: 0o664 });
  await fs.rename(tmp, FILE());
}

/** Every entry key (<date>/<slug>), newest day first. */
async function allKeys(): Promise<string[]> {
  const out: string[] = [];
  for (const d of await listDates()) for (const e of await listEntriesForDate(d)) out.push(`${d}/${e.slug}`);
  return out;
}

/** key → its current link name, for every entry. */
export async function linkNames(): Promise<Record<string, string>> {
  const [keys, links] = await Promise.all([allKeys(), readLinks()]);
  const slugCount = new Map<string, number>();
  for (const k of keys) { const s = k.split("/")[1]; slugCount.set(s, (slugCount.get(s) ?? 0) + 1); }
  const out: Record<string, string> = {};
  for (const k of keys) {
    const [date, slug] = k.split("/");
    out[k] = links.names[k] ?? ((slugCount.get(slug) ?? 0) > 1 ? `${date}-${slug}` : slug);
  }
  return out;
}

/** A link name (or a literal <date>/<slug>) → the entry key it opens, or null. */
export async function resolveLink(parts: string[]): Promise<string | null> {
  if (parts.length === 2 && isDate(parts[0]) && isSlug(parts[1])) {
    const key = `${parts[0]}/${parts[1]}`;
    return (await allKeys()).includes(key) ? key : null;
  }
  if (parts.length !== 1) return null;
  const name = parts[0].toLowerCase();
  const names = await linkNames();
  const hit = Object.entries(names).find(([, n]) => n === name);
  if (hit) return hit[0];
  const red = (await readLinks()).redirects[name];
  return red && names[red] ? red : null;
}

/** Rename an entry's link. The old name keeps working as a redirect. Returns the new name. */
export async function renameLink(key: string, raw: string): Promise<string> {
  const [date, slug] = key.split("/");
  if (!isDate(date) || !isSlug(slug)) throw new LinkError("bad entry");
  const name = cleanLinkName(raw).replace(/-+$/, "");
  if (!isValidLinkName(name)) throw new LinkError("Use 2–60 lowercase letters, numbers and dashes.");
  const names = await linkNames();
  if (!(key in names)) throw new LinkError("no such entry", 404);
  const current = names[key];
  if (current === name) return name;
  const owner = Object.entries(names).find(([k, n]) => n === name && k !== key);
  if (owner) throw new LinkError(`"${name}" is already the link of another entry (${owner[0]}).`, 409);
  const links = await readLinks();
  const red = links.redirects[name];
  if (red && red !== key) throw new LinkError(`"${name}" still redirects to another entry (${red}).`, 409);
  delete links.redirects[name];
  links.redirects[current] = key;      // the old link keeps opening this entry
  links.names[key] = name;
  await writeLinks(links);
  return name;
}

/** How many old names redirect to this entry. */
export async function redirectsTo(key: string): Promise<string[]> {
  const links = await readLinks();
  return Object.entries(links.redirects).filter(([, k]) => k === key).map(([n]) => n);
}
