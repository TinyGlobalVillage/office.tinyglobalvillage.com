/**
 * GET /api/playbooks/readme?path=<rel>
 *
 * Returns the markdown content of a single README under /srv/refusion-core/utils/.
 * `rel` is the path relative to UTILS_ROOT as returned by /api/playbooks/index
 * in the `readmeRel` field. Validates that the resolved path stays inside
 * UTILS_ROOT and ends in `.md` (no traversal, no arbitrary file read).
 */
import { type NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const UTILS_ROOT = "/srv/refusion-core/utils";

export async function GET(req: NextRequest) {
  const token = await requireAuth(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  if (rel.includes("..") || rel.startsWith("/")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }
  if (!rel.endsWith(".md")) {
    return NextResponse.json({ error: "Not a markdown file" }, { status: 400 });
  }
  const abs = path.resolve(UTILS_ROOT, rel);
  if (!abs.startsWith(UTILS_ROOT + path.sep) && abs !== UTILS_ROOT) {
    return NextResponse.json({ error: "Path escapes utils root" }, { status: 400 });
  }
  try {
    const body = await fs.readFile(abs, "utf8");
    return NextResponse.json({ path: rel, body });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return NextResponse.json({ error: "README not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
