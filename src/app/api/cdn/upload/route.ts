/**
 * POST /api/cdn/upload
 * Accepts multipart/form-data: file (File), project (string)
 * Stores to /srv/refusion-core/cdn/{project}/{slug}-{random}.{ext}
 * Returns: { url, name, size, type, project }
 *
 * Hardening (2026-05-14):
 *   - Requires session auth (defense in depth — nginx already gates at
 *     the proxy layer, but the route now refuses unauth requests too).
 *   - Hard-rejects unknown MIME types instead of falling back to the
 *     attacker-controlled original extension.
 *   - 20 MB per-file cap at the route level (nginx still caps at 100 MB
 *     for the outer body — defense in depth).
 *   - Per-user token-bucket rate limit (10 uploads / 60 s rolling).
 *   - SVG uploads are blocked (XSS risk in user-served SVGs); ask for
 *     PNG/WebP instead, or run an explicit sanitizer if SVG must be
 *     supported in a future iteration.
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireAuth } from "@/lib/api-auth";

const CDN_ROOT = "/srv/refusion-core/cdn";
const CDN_BASE_URL = "https://office.tinyglobalvillage.com/media";
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;

// Allowed MIME types. SVG intentionally excluded — sanitize externally
// before adding back.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "application/pdf": "pdf",
  "font/woff": "woff",
  "font/woff2": "woff2",
};

// In-memory rolling-window rate limiter keyed by username. Survives only
// the current Node process — fine for a small admin tool; swap for Redis
// if Office ever runs multi-instance.
const rateLog = new Map<string, number[]>();

function checkRate(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLog.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    return { ok: false, retryAfter };
  }
  recent.push(now);
  rateLog.set(key, recent);
  return { ok: true, retryAfter: 0 };
}

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
  const token = await requireAuth(req);
  if (!token?.username) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rate = checkRate(token.username);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: rate.retryAfter },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

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

  // Hard-reject unknown MIME types. Falling back to the original
  // extension lets an attacker upload an arbitrary blob with a chosen
  // extension by lying about the Content-Type.
  if (!(mime in ALLOWED)) {
    return NextResponse.json(
      { error: "unsupported_type", mime },
      { status: 415 },
    );
  }
  const ext = ALLOWED[mime];

  const origName = (file as File).name ?? "file";
  const declaredSize = (file as File).size ?? 0;
  if (declaredSize > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES, declaredSize },
      { status: 413 },
    );
  }

  // Build unique filename: {slug}-{random}.{ext}. The slug is derived
  // from the user-supplied name (sanitized) and the random suffix
  // prevents collisions + complicates enumeration.
  const baseName = origName.replace(/\.[^.]+$/, "");
  const slug = slugify(baseName);
  const filename = `${slug}-${randomHex(8)}.${ext}`;

  const projectDir = path.join(CDN_ROOT, project);
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
  }

  const filePath = path.join(projectDir, filename);

  const buf = Buffer.from(await (file as File).arrayBuffer());
  // Re-check actual size after reading — File.size on the FormData entry
  // may be advisory; the buffer is the truth.
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", maxBytes: MAX_BYTES, actualSize: buf.byteLength },
      { status: 413 },
    );
  }
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
