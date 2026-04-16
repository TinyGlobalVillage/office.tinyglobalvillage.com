/**
 * GET /api/cdn/files?project=office&page=1    → list files (newest first, 50/page)
 * DELETE /api/cdn/files?project=office&name=x → delete a file
 */
import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync, unlinkSync, existsSync } from "fs";
import path from "path";

const CDN_ROOT = "/srv/refusion-core/cdn";
const CDN_BASE_URL = "https://office.tinyglobalvillage.com/media";
const PAGE_SIZE = 50;

type CdnFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  project: string;
  modifiedAt: number;
};

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
    avif: "image/avif", mp4: "video/mp4", webm: "video/webm",
    mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav",
    pdf: "application/pdf", woff: "font/woff", woff2: "font/woff2",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

function listProjects(): string[] {
  if (!existsSync(CDN_ROOT)) return [];
  try {
    return readdirSync(CDN_ROOT).filter((d) => {
      try { return statSync(path.join(CDN_ROOT, d)).isDirectory(); } catch { return false; }
    });
  } catch { return []; }
}

function listFiles(project: string): CdnFile[] {
  const dir = path.join(CDN_ROOT, project);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => !f.startsWith("."))
      .map((name) => {
        const fp = path.join(dir, name);
        const stat = statSync(fp);
        const ext = name.split(".").pop() ?? "";
        return {
          name,
          url: `${CDN_BASE_URL}/${project}/${name}`,
          size: stat.size,
          type: mimeFromExt(ext),
          project,
          modifiedAt: stat.mtimeMs,
        };
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  } catch { return []; }
}

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));

  // If no project specified, return project list + file counts
  if (!project) {
    const projects = listProjects().map((p) => ({
      name: p,
      count: listFiles(p).length,
    }));
    return NextResponse.json({ projects });
  }

  const files = listFiles(project);
  const total = files.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  const slice = files.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return NextResponse.json({ files: slice, total, page, totalPages, project });
}

export async function DELETE(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project");
  const name = req.nextUrl.searchParams.get("name");

  if (!project || !name) {
    return NextResponse.json({ error: "Missing project or name" }, { status: 400 });
  }

  // Prevent path traversal
  const safeName = path.basename(name);
  const filePath = path.join(CDN_ROOT, project, safeName);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(CDN_ROOT))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  unlinkSync(filePath);
  return NextResponse.json({ ok: true });
}
