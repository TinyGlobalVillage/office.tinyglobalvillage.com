import { promises as fs } from "node:fs";
import path from "node:path";

export const ROOT = "/srv/refusion-core/data/rcs-diary";
export const TEMPLATE_PATH =
  "/srv/refusion-core/skills/rcs-diary/references/01-entry-template.md";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export const isDate = (s: string) => DATE_RE.test(s);
export const isSlug = (s: string) => SLUG_RE.test(s) && s.length <= 80;

export interface EntryFrontmatter {
  date?: string;
  time?: string;
  slug?: string;
  title?: string;
  type?: string;
  /** Optional gold "milestone" highlight on the card (e.g. a first/launch moment). */
  featured?: boolean;
  /** Optional short ALL-CAPS overline shown above the headline on a featured card. */
  subtitle?: string;
  tags?: string[];
  links?: Array<{ kind: string; target: string; label?: string }>;
}

export interface ParsedEntry {
  meta: EntryFrontmatter;
  summary: string;
  body: string;
  raw: string;
}

export function parseFrontmatter(raw: string): ParsedEntry {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  const meta: EntryFrontmatter = {};
  let body = raw;
  if (m) {
    body = m[2];
    for (const line of m[1].split("\n")) {
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (!k) continue;
      if (k === "tags") {
        meta.tags = v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
      } else if (k === "links") {
        // Simple multi-line parse: "- kind: …" / "  target: …" / "  label: …"
        // Crude but adequate; the file is markdown, not strict YAML.
        meta.links = [];
      } else if (k === "featured") {
        meta.featured = v === "true";
      } else if (k in meta || ["date", "time", "slug", "title", "type", "subtitle"].includes(k)) {
        (meta as Record<string, unknown>)[k] = v;
      }
    }
  }
  const sumMatch = /^>\s+(.+?)$/m.exec(body);
  const summary = sumMatch ? sumMatch[1].trim() : "";
  return { meta, summary, body: body.trimStart(), raw };
}

export async function listDates(): Promise<string[]> {
  const entries = await fs.readdir(ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && isDate(e.name))
    .map((e) => e.name)
    .sort()
    .reverse();
}

export async function listEntriesForDate(date: string): Promise<
  Array<{ slug: string; nn: string; meta: EntryFrontmatter; summary: string }>
> {
  if (!isDate(date)) throw new Error("invalid date");
  const dir = path.join(ROOT, date);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const out: Array<{ slug: string; nn: string; meta: EntryFrontmatter; summary: string }> = [];
  for (const f of files) {
    const m = /^(\d{2})-(.+)\.md$/.exec(f);
    if (!m) continue;
    const raw = await fs.readFile(path.join(dir, f), "utf8");
    const parsed = parseFrontmatter(raw);
    out.push({ nn: m[1], slug: m[2], meta: parsed.meta, summary: parsed.summary });
  }
  return out.sort((a, b) => a.nn.localeCompare(b.nn));
}

export async function readEntry(date: string, slug: string): Promise<ParsedEntry | null> {
  if (!isDate(date) || !isSlug(slug)) return null;
  const dir = path.join(ROOT, date);
  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }
  const match = files.find((f) => /^\d{2}-(.+)\.md$/.exec(f)?.[1] === slug);
  if (!match) return null;
  const raw = await fs.readFile(path.join(dir, match), "utf8");
  return parseFrontmatter(raw);
}

export async function nextSequenceNumber(date: string): Promise<string> {
  const items = await listEntriesForDate(date);
  const maxNn = items.reduce((m, e) => Math.max(m, parseInt(e.nn, 10)), 0);
  return String(maxNn + 1).padStart(2, "0");
}

export function rcsToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function rcsTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function ensureDayDir(date: string): Promise<string> {
  const dir = path.join(ROOT, date);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function appendDayIndexEntry(
  date: string,
  nn: string,
  slug: string,
  time: string,
  type: string,
  summary: string,
): Promise<void> {
  const dir = path.join(ROOT, date);
  const indexPath = path.join(dir, "INDEX.md");
  let header: string;
  try {
    const existing = await fs.readFile(indexPath, "utf8");
    const line = `- [${nn}-${slug}](${nn}-${slug}.md) · ${time} · \`${type}\` · "${summary}"`;
    if (existing.includes(`${nn}-${slug}`)) return;
    await fs.writeFile(indexPath, existing.trimEnd() + "\n" + line + "\n");
    return;
  } catch {
    header = `# ${date}\n\n`;
  }
  const line = `- [${nn}-${slug}](${nn}-${slug}.md) · ${time} · \`${type}\` · "${summary}"\n`;
  await fs.writeFile(indexPath, header + line);
}

export async function refreshTopIndex(): Promise<void> {
  const dates = await listDates();
  const lines: string[] = [
    "# RCS Diary — Index",
    "",
    "Most recent on top. Each link opens that day's index.",
    "",
  ];
  for (const d of dates) {
    const items = await listEntriesForDate(d);
    const summaryHints = items.map((it) => it.summary).filter(Boolean);
    const headline = summaryHints[0]
      ? summaryHints.length > 1
        ? `${summaryHints[0].slice(0, 80)}${summaryHints[0].length > 80 ? "…" : ""} (+${summaryHints.length - 1})`
        : summaryHints[0].slice(0, 140) + (summaryHints[0].length > 140 ? "…" : "")
      : "(no entries)";
    lines.push(
      `- [${d}](${d}/INDEX.md) — ${items.length} ${items.length === 1 ? "entry" : "entries"} · ${headline}`,
    );
  }
  await fs.writeFile(path.join(ROOT, "INDEX.md"), lines.join("\n") + "\n");
}

export async function readTemplate(): Promise<string> {
  return fs.readFile(TEMPLATE_PATH, "utf8");
}
