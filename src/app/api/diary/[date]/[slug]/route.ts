import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isDate, isSlug, readEntry, ROOT } from "../../_lib";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ date: string; slug: string }> }) {
  const { date, slug } = await ctx.params;
  if (!isDate(date) || !isSlug(slug)) {
    return NextResponse.json({ error: "invalid date or slug" }, { status: 400 });
  }
  const entry = await readEntry(date, slug);
  if (!entry) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    meta: entry.meta,
    summary: entry.summary,
    body: entry.body,
    raw: entry.raw,
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ date: string; slug: string }> }) {
  const { date, slug } = await ctx.params;
  if (!isDate(date) || !isSlug(slug)) {
    return NextResponse.json({ error: "invalid date or slug" }, { status: 400 });
  }
  const body = (await req.json()) as { update_text: string };
  if (!body.update_text || body.update_text.trim().length === 0) {
    return NextResponse.json({ error: "update_text required" }, { status: 400 });
  }
  const dir = path.join(ROOT, date);
  const files = await fs.readdir(dir);
  const match = files.find((f) => /^\d{2}-(.+)\.md$/.exec(f)?.[1] === slug);
  if (!match) return NextResponse.json({ error: "not found" }, { status: 404 });
  const filePath = path.join(dir, match);
  const today = new Date().toISOString().slice(0, 10);
  const block = `\n## Update ${today}\n\n${body.update_text.trim()}\n`;
  const existing = await fs.readFile(filePath, "utf8");
  await fs.writeFile(filePath, existing.trimEnd() + block);
  return NextResponse.json({ ok: true, appended: block.length });
}
