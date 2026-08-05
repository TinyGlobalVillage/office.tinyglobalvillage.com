// The two places an Office file manager upload can land, behind one shape.
//
// Office's CDN browser (/dashboard/storage) has always written to the RCS disk at
// /srv/refusion-core/cdn/{project}/{name}, served by office's own /media/ nginx alias. Cloudflare R2 is
// now the other option: the same file, keyed `public/{project}/{name}`, served by cdn.<domain>. The
// `public/` prefix is not decoration — it is the bucket boundary, the only prefix the CDN custom domain
// is bound to, so an Office upload can never accidentally land somewhere anonymous readers can't reach
// (or worse, somewhere they can reach that they shouldn't).
//
// WHY BOTH, AND WHY LISTING MATTERS: the store is chosen per upload, so the browser has to show files
// from both or a cloud upload would simply vanish from the page that made it. Nothing records where a
// file went — the answer is "wherever it is", discovered by listing both — which is also why delete and
// rename take the store as an argument instead of guessing.
//
// R2 has no rename. `rename` there is read → write → remove, which is fine at Office's 20 MB cap and
// honest about what it costs; disk keeps its atomic fs.rename.
import "server-only";
import path from "path";
import { readdirSync, statSync, existsSync } from "fs";
import { mkdir, writeFile, unlink, rename as fsRename } from "fs/promises";
import { createStorageR2AdapterFromEnv, PUBLIC_PREFIX } from "@tgv/module-storage/server";

export type CdnStore = "disk" | "cloud";

export const CDN_ROOT = process.env.CDN_ROOT ?? "/srv/refusion-core/cdn";
export const CDN_BASE_URL = process.env.CDN_BASE_URL ?? "https://office.tinyglobalvillage.com/media";

export type CdnFile = {
  name: string;
  url: string;
  size: number;
  type: string;
  project: string;
  modifiedAt: number;
  store: CdnStore;
};

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  avif: "image/avif", mp4: "video/mp4", webm: "video/webm",
  mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav",
  pdf: "application/pdf", woff: "font/woff", woff2: "font/woff2",
};

export function mimeFromName(name: string): string {
  const ext = name.split(".").pop() ?? "";
  return MIME_BY_EXT[ext.toLowerCase()] ?? "application/octet-stream";
}

/** One segment, no traversal. Both stores route every project/name through this. */
function seg(v: string): string {
  return path.basename(String(v ?? "").trim());
}

/** The R2 key for an Office CDN file. `public/` first, always — see the header. */
export function cloudKey(project: string, name: string): string {
  return `${PUBLIC_PREFIX}${seg(project)}/${seg(name)}`;
}

/** The R2 adapter, or null when this box has no R2 credentials. Null is a supported state: the UI
 *  offers disk only, rather than the surface breaking. */
export function cloudAdapter() {
  return createStorageR2AdapterFromEnv();
}

export function cloudAvailable(): boolean {
  return cloudAdapter() !== null;
}

/* ── read ─────────────────────────────────────────────────────────── */

export function listDisk(project: string): CdnFile[] {
  const p = seg(project);
  const dir = path.join(CDN_ROOT, p);
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => !f.startsWith("."))
      .flatMap((name) => {
        try {
          const st = statSync(path.join(dir, name));
          if (!st.isFile()) return []; // a project dir can hold subfolders (users/, documents/) — not files here
          return [{
            name,
            url: `${CDN_BASE_URL}/${p}/${name}`,
            size: st.size,
            type: mimeFromName(name),
            project: p,
            modifiedAt: st.mtimeMs,
            store: "disk" as const,
          }];
        } catch { return []; }
      });
  } catch { return []; }
}

export async function listCloud(project: string): Promise<CdnFile[]> {
  const r2 = cloudAdapter();
  if (!r2) return [];
  const p = seg(project);
  const prefix = `${PUBLIC_PREFIX}${p}/`;
  try {
    const objects = await r2.list(prefix);
    return objects.flatMap((o) => {
      const rest = o.key.slice(prefix.length);
      if (!rest || rest.includes("/")) return []; // flat listing, same as the disk side
      return [{
        name: rest,
        url: r2.publicUrl(o.key),
        size: o.size,
        type: mimeFromName(rest),
        project: p,
        modifiedAt: o.modifiedAt,
        store: "cloud" as const,
      }];
    });
  } catch { return []; }
}

/** Both stores, newest first. A name present in both appears twice, on purpose: they are two files. */
export async function listAll(project: string): Promise<CdnFile[]> {
  const [disk, cloud] = await Promise.all([
    Promise.resolve(listDisk(project)),
    listCloud(project),
  ]);
  return [...disk, ...cloud].sort((a, b) => b.modifiedAt - a.modifiedAt);
}

/** Project names across both stores (disk dirs ∪ the prefixes R2 holds objects under). */
export async function listProjects(): Promise<{ name: string; count: number }[]> {
  const names = new Set<string>();
  if (existsSync(CDN_ROOT)) {
    try {
      for (const d of readdirSync(CDN_ROOT)) {
        try { if (statSync(path.join(CDN_ROOT, d)).isDirectory()) names.add(d); } catch { /* skip */ }
      }
    } catch { /* no disk root */ }
  }
  const r2 = cloudAdapter();
  if (r2) {
    try {
      for (const o of await r2.list(PUBLIC_PREFIX)) {
        const rest = o.key.slice(PUBLIC_PREFIX.length);
        const first = rest.split("/")[0];
        if (first && rest.includes("/")) names.add(first);
      }
    } catch { /* cloud unreachable — disk projects still list */ }
  }
  const out: { name: string; count: number }[] = [];
  for (const name of [...names].sort()) {
    out.push({ name, count: (await listAll(name)).length });
  }
  return out;
}

/* ── write ────────────────────────────────────────────────────────── */

export async function writeFileTo(
  store: CdnStore,
  project: string,
  name: string,
  body: Buffer,
  contentType: string,
): Promise<{ url: string }> {
  const p = seg(project);
  const n = seg(name);
  if (store === "cloud") {
    const r2 = cloudAdapter();
    if (!r2) throw new Error("Cloud storage is not configured on this host");
    const key = cloudKey(p, n);
    await r2.write(key, body, contentType);
    return { url: r2.publicUrl(key) };
  }
  const dir = path.join(CDN_ROOT, p);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, n), body);
  return { url: `${CDN_BASE_URL}/${p}/${n}` };
}

export async function removeFile(store: CdnStore, project: string, name: string): Promise<void> {
  const p = seg(project);
  const n = seg(name);
  if (store === "cloud") {
    const r2 = cloudAdapter();
    if (!r2) throw new Error("Cloud storage is not configured on this host");
    await r2.remove(cloudKey(p, n));
    return;
  }
  const fp = path.join(CDN_ROOT, p, n);
  if (!existsSync(fp)) throw new Error("File not found");
  await unlink(fp);
}

export async function fileExists(store: CdnStore, project: string, name: string): Promise<boolean> {
  const p = seg(project);
  const n = seg(name);
  if (store === "cloud") {
    const r2 = cloudAdapter();
    if (!r2) return false;
    return r2.exists(cloudKey(p, n));
  }
  return existsSync(path.join(CDN_ROOT, p, n));
}

export async function renameFile(
  store: CdnStore,
  project: string,
  oldName: string,
  newName: string,
): Promise<{ url: string }> {
  const p = seg(project);
  const from = seg(oldName);
  const to = seg(newName);
  if (store === "cloud") {
    const r2 = cloudAdapter();
    if (!r2) throw new Error("Cloud storage is not configured on this host");
    const fromKey = cloudKey(p, from);
    const toKey = cloudKey(p, to);
    // No server-side rename in the S3 API. Copy then delete — and delete only after the write resolved,
    // so a failure leaves the original rather than nothing.
    const buf = await r2.read(fromKey);
    await r2.write(toKey, buf, mimeFromName(to));
    await r2.remove(fromKey);
    return { url: r2.publicUrl(toKey) };
  }
  const dir = path.join(CDN_ROOT, p);
  await fsRename(path.join(dir, from), path.join(dir, to));
  return { url: `${CDN_BASE_URL}/${p}/${to}` };
}

/** `store` off the wire, defaulting to disk — the historical behaviour, so an old caller is unchanged. */
export function parseStore(v: unknown): CdnStore {
  return String(v ?? "").toLowerCase() === "cloud" ? "cloud" : "disk";
}
