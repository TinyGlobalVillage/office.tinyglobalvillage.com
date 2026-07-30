/**
 * POST /api/media-reducer/upload
 * multipart/form-data: site (villager_sites.id), file (already-converted media)
 * Stores to /srv/refusion-core/cdn/{tenantDomain}/{slug}-{random}.{ext} — the
 * same bucket layout the Storage page + nginx /media alias already serve, so
 * reduced media shows up in the tenant's bucket immediately.
 *
 * Storage-tier enforcement (first real quota check on the CDN write path):
 * usage = recursive size of the tenant's bucket dir; cap = villager_sites
 * .storage_gb (fallback 5 GB, tiers.ts includedGB). Over cap → HTTP 507,
 * mirroring the chat-upload pattern. The walk is scoped to ONE tenant bucket
 * per request — cheap — not a whole-CDN du.
 *
 * Hardening mirrors api/cdn/upload: requireAuth, MIME allowlist (media only,
 * no SVG), per-user rate limit, size re-check after read, audit-logged writes.
 */
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { requireAuth } from "@/lib/api-auth";
import { db } from "@/lib/db-drizzle";
import { logHardeningAction } from "@/lib/audit-log";

export const runtime = "nodejs";

const CDN_ROOT = "/srv/refusion-core/cdn";
const CDN_BASE_URL = "https://office.tinyglobalvillage.com/media";
const MAX_BYTES = 500 * 1024 * 1024; // converted videos can be large; nginx body cap is 500mb too
const DEFAULT_QUOTA_GB = 5; // tiers.ts STORAGE.includedGB — used when storage_gb is null/0
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30; // batches are sequential per-file requests

// Media only — this endpoint exists for the Media Reducer's outputs.
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

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

function randomHex(n = 8): string {
  return Math.random().toString(36).slice(2, 2 + n);
}

function sanitizeBucket(p: string): string {
  return p.replace(/[^a-z0-9._-]/gi, "-").replace(/-+/g, "-").slice(0, 60);
}

function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirBytes(p);
    else if (entry.isFile()) total += statSync(p).size;
  }
  return total;
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
  const siteId = form.get("site");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (typeof siteId !== "string" || !siteId) {
    return NextResponse.json({ error: "No tenant selected" }, { status: 400 });
  }

  const res = await db.execute(sql`
    select id, domain, coalesce(client_name, domain) as label, storage_gb
      from villager_sites where id = ${siteId} limit 1`);
  const tenant = res.rows[0] as
    | { id: string; domain: string | null; label: string; storage_gb: number | null }
    | undefined;
  if (!tenant) {
    return NextResponse.json({ error: "Unknown tenant" }, { status: 404 });
  }

  const mime = file.type || "application/octet-stream";
  if (!(mime in ALLOWED)) {
    return NextResponse.json({ error: "unsupported_type", mime }, { status: 415 });
  }
  const ext = ALLOWED[mime];

  const origName = (file as File).name ?? "file";
  if (((file as File).size ?? 0) > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  const bucket = sanitizeBucket(tenant.domain || `tenant-${tenant.id}`);
  if (!bucket) {
    return NextResponse.json({ error: "Tenant has no usable bucket name" }, { status: 422 });
  }
  const bucketDir = path.join(CDN_ROOT, bucket);

  const buf = Buffer.from(await (file as File).arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", maxBytes: MAX_BYTES }, { status: 413 });
  }

  // Storage tier: bucket usage + this file must fit under the tenant's GB cap.
  const quotaBytes = (tenant.storage_gb || DEFAULT_QUOTA_GB) * 1024 * 1024 * 1024;
  const usedBytes = dirBytes(bucketDir);
  if (usedBytes + buf.byteLength > quotaBytes) {
    return NextResponse.json(
      {
        error: "storage_tier_full",
        message: `${tenant.label} is at ${(usedBytes / 1073741824).toFixed(2)} of ${(quotaBytes / 1073741824).toFixed(0)} GB — upgrade their tier or clear space.`,
        usedBytes,
        quotaBytes,
      },
      { status: 507 },
    );
  }

  const baseName = origName.replace(/\.[^.]+$/, "");
  const filename = `${slugify(baseName)}-${randomHex()}.${ext}`;
  if (!existsSync(bucketDir)) await mkdir(bucketDir, { recursive: true });
  await writeFile(path.join(bucketDir, filename), buf);

  logHardeningAction({
    action: "media-reducer.upload",
    target: bucket,
    user: token.username,
    success: true,
    details: { tenantId: tenant.id, file: filename, bytes: buf.byteLength },
  });

  return NextResponse.json({
    url: `${CDN_BASE_URL}/${bucket}/${filename}`,
    name: filename,
    size: buf.byteLength,
    usedBytes: usedBytes + buf.byteLength,
    quotaBytes,
  });
}
