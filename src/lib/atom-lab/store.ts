/**
 * Atom Lab spec store — file-backed, index+entry layout (same pattern as
 * svg-lab): data/atom-lab/index.json (pointers) + data/atom-lab/<key>.json
 * (one saved AtomSpec per atom key). Specs are sanitized by the API route
 * via clampSpec on both write and read; this layer only moves JSON.
 */
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const LAB_DIR = path.join(process.cwd(), "data", "atom-lab");
const INDEX = path.join(LAB_DIR, "index.json");

export type SpecRecord = {
  key: string;
  spec: unknown;
  updatedBy: string;
  updatedAt: string;
};

type IndexRow = { key: string; file: string; updatedAt: string };

const KEY_RE = /^[a-z0-9-]{1,40}$/;

export function isValidAtomKey(key: string): boolean {
  return KEY_RE.test(key);
}

async function readIndex(): Promise<IndexRow[]> {
  if (!existsSync(INDEX)) return [];
  try {
    const rows = JSON.parse(await readFile(INDEX, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function readSpecs(): Promise<SpecRecord[]> {
  const rows = await readIndex();
  const out: SpecRecord[] = [];
  for (const row of rows) {
    try {
      const rec = JSON.parse(
        await readFile(path.join(LAB_DIR, row.file), "utf8"),
      ) as SpecRecord;
      if (rec && typeof rec.key === "string") out.push(rec);
    } catch {
      // orphaned pointer — skip
    }
  }
  return out;
}

export async function saveSpec(
  key: string,
  spec: unknown,
  updatedBy: string,
): Promise<SpecRecord> {
  const rec: SpecRecord = { key, spec, updatedBy, updatedAt: new Date().toISOString() };
  await mkdir(LAB_DIR, { recursive: true });
  await writeFile(path.join(LAB_DIR, `${key}.json`), JSON.stringify(rec, null, 2));
  const rows = await readIndex();
  const next = rows.filter((r) => r.key !== key);
  next.push({ key, file: `${key}.json`, updatedAt: rec.updatedAt });
  await writeFile(INDEX, JSON.stringify(next, null, 2));
  return rec;
}

export async function deleteSpec(key: string): Promise<boolean> {
  const rows = await readIndex();
  const row = rows.find((r) => r.key === key);
  if (!row) return false;
  await writeFile(INDEX, JSON.stringify(rows.filter((r) => r.key !== key), null, 2));
  try {
    await unlink(path.join(LAB_DIR, row.file));
  } catch {
    // entry file already gone — pointer removal is what matters
  }
  return true;
}
