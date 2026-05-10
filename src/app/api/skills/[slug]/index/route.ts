/**
 * GET /api/skills/[slug]/index
 *
 * Serves the INDEX.md of a skill from /srv/refusion-core/skills/<slug>/INDEX.md.
 * Auth-gated. Used by SkillLibraryModal to render skill content on demand.
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const SKILLS_ROOT = "/srv/refusion-core/skills";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { slug } = await ctx.params;
  if (!/^[a-z0-9][a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }
  const file = path.join(SKILLS_ROOT, slug, "INDEX.md");
  try {
    const body = await fs.readFile(file, "utf8");
    return NextResponse.json({ slug, body });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "Skill INDEX.md not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
