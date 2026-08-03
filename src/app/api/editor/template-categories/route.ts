/**
 * Template categories the Sandbox knows about but the DB doesn't yet.
 *
 * A template's category is a column on `shared_templates` — that stays the
 * source of truth. This route only remembers categories a staffer CREATED in
 * the Templates drawer that no template has been dragged into yet: an empty
 * group has nowhere to live in the DB, because nothing carries its name.
 * Once a template is assigned, the category exists in both places and the
 * drawer stops needing this list to show it.
 *
 * GET    → { categories: string[] }
 * POST   { name } → { categories }
 * DELETE ?name=<name> → { categories }
 */
import { NextRequest, NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireAdmin } from "@/lib/api-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILE = path.join(process.cwd(), "data", "templates", "categories.json");
const MAX = 60;
const MAX_COUNT = 60;

async function read(): Promise<string[]> {
  if (!existsSync(FILE)) return [];
  try {
    const rows = JSON.parse(await readFile(FILE, "utf8"));
    return Array.isArray(rows) ? rows.filter((r) => typeof r === "string") : [];
  } catch {
    return [];
  }
}

async function write(rows: string[]): Promise<void> {
  await mkdir(path.dirname(FILE), { recursive: true });
  await writeFile(FILE, JSON.stringify(rows, null, 2));
}

function clean(name: string): string {
  return name.trim().replace(/\s+/g, " ").slice(0, MAX);
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  return NextResponse.json({ categories: await read() });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const name = clean(typeof body.name === "string" ? body.name : "");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const rows = await read();
  if (rows.length >= MAX_COUNT)
    return NextResponse.json({ error: "too many categories" }, { status: 409 });
  if (!rows.some((r) => r.toLowerCase() === name.toLowerCase())) rows.push(name);
  await write(rows);
  return NextResponse.json({ categories: rows });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const name = clean(req.nextUrl.searchParams.get("name") ?? "");
  const rows = (await read()).filter((r) => r.toLowerCase() !== name.toLowerCase());
  await write(rows);
  return NextResponse.json({ categories: rows });
}
