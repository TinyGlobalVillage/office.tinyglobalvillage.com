/**
 * GET /api/readmes/[id]
 *
 * Serves operator-facing readmes from /srv/refusion-core/logs/tgv-office/readmes/.
 * Each file has frontmatter (id/title/category) + a markdown body.
 *
 * Used by LibraryModal-style consumers to render a specific readme without
 * shipping the markdown into the JS bundle. Auth-gated.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const READMES_ROOT = "/srv/refusion-core/logs/tgv-office/readmes";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const file = path.join(READMES_ROOT, `${id}.md`);
  try {
    const raw = await fs.readFile(file, "utf8");
    const { frontmatter, body } = splitFrontmatter(raw);
    return NextResponse.json({
      id: frontmatter.id ?? id,
      title: frontmatter.title ?? id,
      category: frontmatter.category ?? "uncategorized",
      body,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Readme not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

function splitFrontmatter(raw: string): { frontmatter: Record<string, string>; body: string } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { frontmatter: {}, body: raw };
  const fm: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { frontmatter: fm, body: m[2].trimStart() };
}
