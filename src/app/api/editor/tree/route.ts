/**
 * GET /api/editor/tree?path=/srv/refusion-core/client/projectname
 * Returns directory listing. Restricted to /srv/refusion-core/client/
 */
import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync } from "fs";
import path from "path";

const ROOT = "/srv/refusion-core/client";

const IGNORE = new Set([
  "node_modules", ".next", ".git", ".turbo", "dist", "build", ".cache",
  ".npm", "coverage", "__pycache__", ".DS_Store",
]);

function safe(p: string): string | null {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path") ?? ROOT;
  const dir = safe(rawPath);
  if (!dir) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter((e) => !IGNORE.has(e.name) && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
        isDir: e.isDirectory(),
        size: e.isFile() ? (() => { try { return statSync(path.join(dir, e.name)).size; } catch { return 0; } })() : 0,
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    return NextResponse.json({ path: dir, entries });
  } catch {
    return NextResponse.json({ error: "Cannot read directory" }, { status: 500 });
  }
}
