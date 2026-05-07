import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  isDate,
  isSlug,
  listEntriesForDate,
  ensureDayDir,
  nextSequenceNumber,
  appendDayIndexEntry,
  refreshTopIndex,
  rcsTime,
} from "../_lib";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set(["log", "decision", "observation", "learning", "incident"]);

export async function GET(_req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!isDate(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  try {
    const items = await listEntriesForDate(date);
    return NextResponse.json({
      date,
      entries: items.map((it) => ({
        nn: it.nn,
        slug: it.slug,
        time: it.meta.time ?? "",
        type: it.meta.type ?? "log",
        title: it.meta.title ?? it.slug,
        summary: it.summary,
        tags: it.meta.tags ?? [],
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ date: string }> }) {
  const { date } = await ctx.params;
  if (!isDate(date)) return NextResponse.json({ error: "invalid date" }, { status: 400 });
  const body = (await req.json()) as {
    slug: string;
    title: string;
    type?: string;
    content: string;
    tags?: string[];
    time?: string;
  };
  if (!body.slug || !isSlug(body.slug)) {
    return NextResponse.json({ error: "slug must be kebab-case ([a-z0-9-]+)" }, { status: 400 });
  }
  if (!body.title || !body.content) {
    return NextResponse.json({ error: "title + content required" }, { status: 400 });
  }
  const type = body.type ?? "log";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json({ error: `type must be one of ${[...ALLOWED_TYPES].join(", ")}` }, { status: 400 });
  }
  const time = body.time ?? rcsTime();
  const dir = await ensureDayDir(date);
  const items = await listEntriesForDate(date);
  if (items.some((it) => it.slug === body.slug)) {
    return NextResponse.json({ error: "slug already used today; pick another" }, { status: 409 });
  }
  const nn = await nextSequenceNumber(date);

  const tagsLine = body.tags && body.tags.length > 0 ? `tags: [${body.tags.join(", ")}]\n` : "tags: []\n";
  const fm =
    `---\n` +
    `date: ${date}\n` +
    `time: ${time}\n` +
    `slug: ${body.slug}\n` +
    `title: ${body.title}\n` +
    `type: ${type}\n` +
    tagsLine +
    `---\n\n`;
  const file = `${nn}-${body.slug}.md`;
  await fs.writeFile(path.join(dir, file), fm + body.content.trimEnd() + "\n");

  const summaryMatch = /^>\s+(.+?)$/m.exec(body.content);
  const summary = summaryMatch ? summaryMatch[1].trim() : "";
  await appendDayIndexEntry(date, nn, body.slug, time, type, summary);
  await refreshTopIndex();

  return NextResponse.json({ ok: true, date, nn, slug: body.slug, file }, { status: 201 });
}
