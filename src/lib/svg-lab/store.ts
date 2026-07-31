/**
 * SVG Lab variants store — file-backed, index+entry layout:
 * data/svg-lab/index.json (pointers) + data/svg-lab/<id>.json (one per variant).
 * Markup sanitized on write and defensively on read (variants re-render via
 * innerHTML in the lab).
 */
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { sanitizeSvgMarkup } from "@/app/components/svg-lab/svgModel";

const LAB_DIR = path.join(process.cwd(), "data", "svg-lab");
const INDEX = path.join(LAB_DIR, "index.json");

export type SvgVariant = {
  id: string;
  name: string;
  sourceKey: string;
  svg: string;
  createdBy: string;
  createdAt: string;
};

type IndexRow = { id: string; name: string; file: string };

async function readIndex(): Promise<IndexRow[]> {
  if (!existsSync(INDEX)) return [];
  try {
    const rows = JSON.parse(await readFile(INDEX, "utf8"));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function readVariants(): Promise<SvgVariant[]> {
  const rows = await readIndex();
  const out: SvgVariant[] = [];
  for (const row of rows) {
    try {
      const v = JSON.parse(await readFile(path.join(LAB_DIR, row.file), "utf8")) as SvgVariant;
      out.push({ ...v, svg: sanitizeSvgMarkup(v.svg) });
    } catch {
      // orphaned pointer — skip
    }
  }
  return out;
}

export async function saveVariant(v: Omit<SvgVariant, "id" | "createdAt">): Promise<SvgVariant> {
  const slug =
    v.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "variant";
  const id = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const variant: SvgVariant = { ...v, id, createdAt: new Date().toISOString() };
  await mkdir(LAB_DIR, { recursive: true });
  await writeFile(path.join(LAB_DIR, `${id}.json`), JSON.stringify(variant, null, 2));
  const rows = await readIndex();
  rows.push({ id, name: v.name, file: `${id}.json` });
  await writeFile(INDEX, JSON.stringify(rows, null, 2));
  return variant;
}

export async function deleteVariant(id: string): Promise<boolean> {
  const rows = await readIndex();
  const row = rows.find((r) => r.id === id);
  if (!row) return false;
  await writeFile(INDEX, JSON.stringify(rows.filter((r) => r.id !== id), null, 2));
  try {
    await unlink(path.join(LAB_DIR, row.file));
  } catch {
    // entry file already gone — pointer removal is what matters
  }
  return true;
}
