import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const ROOT = "/srv/refusion-core/logs/tgv-office/readmes";

interface ReadMe {
  id: string;
  title: string;
  category: string;
  content: string;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const [k, ...rest] = line.split(":");
    if (k && rest.length) meta[k.trim()] = rest.join(":").trim();
  }
  return { meta, body: m[2] };
}

export async function GET() {
  try {
    const files = await fs.readdir(ROOT);
    const items: ReadMe[] = [];
    for (const f of files) {
      if (!f.endsWith(".md")) continue;
      const raw = await fs.readFile(path.join(ROOT, f), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      items.push({
        id: meta.id ?? f.replace(/\.md$/, ""),
        title: meta.title ?? f,
        category: meta.category ?? "general",
        content: body,
      });
    }
    items.sort((a, b) => a.title.localeCompare(b.title));
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
