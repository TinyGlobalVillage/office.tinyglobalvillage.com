/**
 * Composed-component store — file-backed, index+entry layout (same pattern as
 * svg-lab and the atom spec store): data/atom-lab/components/index.json
 * (pointers) + data/atom-lab/components/<id>.json (one ComponentDoc each).
 * Docs are sanitized by the API route via clampComponentDoc on read and write;
 * this layer only moves JSON.
 */
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DIR = path.join(process.cwd(), "data", "atom-lab", "components");
const INDEX = path.join(DIR, "index.json");

export type DocRow = { id: string; name: string; file: string; updatedAt: string };

async function readIndex(): Promise<DocRow[]> {
  if (!existsSync(INDEX)) return [];
  try {
    const rows = JSON.parse(await readFile(INDEX, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listDocs(): Promise<DocRow[]> {
  return readIndex();
}

export async function readDocs(): Promise<unknown[]> {
  const rows = await readIndex();
  const out: unknown[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(await readFile(path.join(DIR, row.file), "utf8")));
    } catch {
      // orphaned pointer — skip
    }
  }
  return out;
}

export async function readDoc(id: string): Promise<unknown | null> {
  const rows = await readIndex();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  try {
    return JSON.parse(await readFile(path.join(DIR, row.file), "utf8"));
  } catch {
    return null;
  }
}

export async function saveDoc(id: string, doc: unknown, name: string): Promise<void> {
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, `${id}.json`), JSON.stringify(doc, null, 2));
  const rows = await readIndex();
  const next = rows.filter((r) => r.id !== id);
  next.push({ id, name, file: `${id}.json`, updatedAt: new Date().toISOString() });
  await writeFile(INDEX, JSON.stringify(next, null, 2));
}

export async function deleteDoc(id: string): Promise<boolean> {
  const rows = await readIndex();
  const row = rows.find((r) => r.id === id);
  if (!row) return false;
  await writeFile(INDEX, JSON.stringify(rows.filter((r) => r.id !== id), null, 2));
  try {
    await unlink(path.join(DIR, row.file));
  } catch {
    // entry file already gone — pointer removal is what matters
  }
  return true;
}

/** Unique id from a display name, avoiding collisions with existing rows. */
export async function nextId(slug: string): Promise<string> {
  const rows = await readIndex();
  const taken = new Set(rows.map((r) => r.id));
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 500; i++) {
    const candidate = `${slug}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${slug}-${rows.length + 1}`;
}
