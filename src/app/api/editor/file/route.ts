/**
 * GET  /api/editor/file?path=...  → read file content
 * POST /api/editor/file           → { path, content } → write file
 * Both restricted to /srv/refusion-core/client/
 */
import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, statSync } from "fs";
import path from "path";

const ROOT = "/srv/refusion-core/client";
const MAX_READ = 2 * 1024 * 1024; // 2 MB

function safe(p: string): string | null {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(ROOT)) return null;
  return resolved;
}

export async function GET(req: NextRequest) {
  const rawPath = req.nextUrl.searchParams.get("path");
  if (!rawPath) return NextResponse.json({ error: "Missing path" }, { status: 400 });
  const fp = safe(rawPath);
  if (!fp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const stat = statSync(fp);
    if (stat.size > MAX_READ) {
      return NextResponse.json({ error: "File too large to edit (>2 MB)" }, { status: 413 });
    }
    const content = readFileSync(fp, "utf8");
    const ext = path.extname(fp).slice(1).toLowerCase();
    return NextResponse.json({ path: fp, content, size: stat.size, ext });
  } catch {
    return NextResponse.json({ error: "Cannot read file" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.path || typeof body.content !== "string") {
    return NextResponse.json({ error: "Missing path or content" }, { status: 400 });
  }
  const fp = safe(body.path);
  if (!fp) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    writeFileSync(fp, body.content, "utf8");
    return NextResponse.json({ ok: true, path: fp, savedAt: Date.now() });
  } catch {
    return NextResponse.json({ error: "Cannot write file" }, { status: 500 });
  }
}
