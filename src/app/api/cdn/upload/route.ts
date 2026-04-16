/**
 * POST /api/cdn/upload
 * Accepts multipart/form-data: file (File), project (string)
 * Stores to /srv/refusion-core/cdn/{project}/{slug}-{original}.ext
 * Returns: { url, name, size, type, project }
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const CDN_ROOT = "/srv/refusion-core/cdn";
const CDN_BASE_URL = "https://office.tinyglobalvillage.com/media";

// Allowed MIME types
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "application/pdf": "pdf",
  "font/woff": "woff",
  "font/woff2": "woff2",
  "application/octet-stream": "bin",
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function randomHex(n = 6): string {
  return Math.random().toString(36).slice(2, 2 + n);
}

function sanitizeProject(p: string): string {
  return p.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").slice(0, 60) || "office";
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  const projectRaw = form.get("project");

  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const project = sanitizeProject(typeof projectRaw === "string" ? projectRaw : "office");
  const mime = file.type || "application/octet-stream";

  // Get original filename extension
  const origName = (file as File).name ?? "file";
  const origExt = origName.includes(".") ? origName.split(".").pop()!.toLowerCase() : "";
  const ext = ALLOWED[mime] ?? origExt ?? "bin";

  // Build unique filename: {slug}-{random}.{ext}
  const baseName = origName.replace(/\.[^.]+$/, ""); // strip ext
  const slug = slugify(baseName);
  const filename = `${slug}-${randomHex(8)}.${ext}`;

  // Ensure project dir exists
  const projectDir = path.join(CDN_ROOT, project);
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }

  const filePath = path.join(projectDir, filename);

  // Write file
  const buf = Buffer.from(await (file as File).arrayBuffer());
  await writeFile(filePath, buf);

  const url = `${CDN_BASE_URL}/${project}/${filename}`;

  return NextResponse.json({
    url,
    name: filename,
    originalName: origName,
    size: buf.byteLength,
    type: mime,
    project,
  });
}
