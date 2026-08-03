// /api/admin/storage-metering — per-site storage usage across the fleet.
//
// GET → { sites, buckets, totals }. Three sources merged per site:
//   media (DB-tracked)  member_storage_files.size_bytes (module-storage rows; only
//                       tenants that mount the module write here — tgv.com today)
//   media (disk)        recursive walk of the site's CDN bucket dir(s); covers the
//                       legacy flat layout (media-reducer, cdn/upload) that has no
//                       DB rows at all
//   db footprint        SUM(pg_column_size(row)) over the heavy per-site content
//                       tables — page_models, blog_posts, shared_templates (site
//                       lives inside bundle_json), forms + form_responses,
//                       member_storage_files. Approximate (compressed value size,
//                       no index overhead) but proportionally honest.
//
// Site keying: villager_sites rows are the spine (uuid tables join by site_id,
// text tables by subdomain); text scopes with no site row (main/demo/demo2 house
// scopes, 'shared' templates) surface as house rows. CDN top-level dirs that match
// no site (office, chat, project buckets) are listed separately as buckets.
//
// Raw SQL via db.execute() — none of these tables are in Office's drizzle schema
// (same rationale as /api/admin/dashboard-config). Every query is individually
// guarded: a missing table (migration not applied) degrades to zeros, never a 500.
import { type NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/api-admin";
import { db } from "@/lib/db-drizzle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CDN_ROOT = "/srv/refusion-core/cdn";

type Agg = { n: number; b: number };
type MediaAgg = Agg & { media: number };

type SiteRow = {
  id: string;
  client_name: string | null;
  domain: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  storage_gb: number | null;
};

async function rows<T>(query: ReturnType<typeof sql>): Promise<T[]> {
  try {
    const res = await db.execute(query);
    return ((res as unknown as { rows?: T[] }).rows ?? []) as T[];
  } catch {
    return []; // table absent / privilege — degrade to empty, never 500
  }
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function walkDir(dir: string): { bytes: number; files: number } {
  let bytes = 0;
  let files = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return { bytes, files };
  }
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = walkDir(p);
      bytes += sub.bytes;
      files += sub.files;
    } else if (entry.isFile()) {
      try {
        bytes += statSync(p).size;
        files += 1;
      } catch {}
    }
  }
  return { bytes, files };
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const [sites, pageModels, blogPosts, sharedTemplates, forms, formResponses, storageFiles, dbSize, demoClones] =
    await Promise.all([
      rows<SiteRow>(sql`
        SELECT id, client_name, domain, subdomain, custom_domain, storage_gb
        FROM public.villager_sites ORDER BY domain ASC
      `),
      rows<{ site: string; n: string; b: string }>(sql`
        SELECT site, count(*) AS n, COALESCE(SUM(pg_column_size(t.*)), 0) AS b
        FROM public.page_models t GROUP BY site
      `),
      rows<{ site: string; n: string; b: string }>(sql`
        SELECT site, count(*) AS n, COALESCE(SUM(pg_column_size(t.*)), 0) AS b
        FROM public.blog_posts t GROUP BY site
      `),
      rows<{ site: string; n: string; b: string }>(sql`
        SELECT COALESCE(bundle_json->>'site', 'shared') AS site,
               count(*) AS n, COALESCE(SUM(pg_column_size(t.*)), 0) AS b
        FROM public.shared_templates t GROUP BY 1
      `),
      rows<{ site_id: string; n: string; b: string }>(sql`
        SELECT site_id, count(*) AS n, COALESCE(SUM(pg_column_size(t.*)), 0) AS b
        FROM public.forms t GROUP BY site_id
      `),
      rows<{ site_id: string; n: string; b: string }>(sql`
        SELECT f.site_id, count(*) AS n, COALESCE(SUM(pg_column_size(r.*)), 0) AS b
        FROM public.form_responses r JOIN public.forms f ON f.id = r.form_id
        GROUP BY f.site_id
      `),
      rows<{ site_id: string; n: string; media: string; b: string }>(sql`
        SELECT site_id, count(*) AS n, COALESCE(SUM(size_bytes), 0) AS media,
               COALESCE(SUM(pg_column_size(t.*)), 0) AS b
        FROM public.member_storage_files t GROUP BY site_id
      `),
      rows<{ b: string }>(sql`SELECT pg_database_size(current_database()) AS b`),
      rows<{ n: string; b: string }>(sql`
        SELECT count(*) AS n, COALESCE(SUM(pg_database_size(datname)), 0) AS b
        FROM pg_database WHERE datname ~ '^demo_[0-9a-f]{24}$'
      `),
    ]);

  // Aggregate maps: text-scoped tables keyed by site text, uuid tables by site_id.
  const byText = new Map<string, Record<string, Agg>>();
  const addText = (table: string, list: { site: string; n: string; b: string }[]) => {
    for (const r of list) {
      const key = r.site ?? "";
      const entry = byText.get(key) ?? {};
      entry[table] = { n: num(r.n), b: num(r.b) };
      byText.set(key, entry);
    }
  };
  addText("page_models", pageModels);
  addText("blog_posts", blogPosts);
  addText("shared_templates", sharedTemplates);

  const byUuid = new Map<string, Record<string, Agg | MediaAgg>>();
  const addUuid = (table: string, list: { site_id: string; n: string; b: string; media?: string }[]) => {
    for (const r of list) {
      const entry = byUuid.get(r.site_id) ?? {};
      entry[table] =
        r.media !== undefined
          ? { n: num(r.n), b: num(r.b), media: num(r.media) }
          : { n: num(r.n), b: num(r.b) };
      byUuid.set(r.site_id, entry);
    }
  };
  addUuid("forms", forms);
  addUuid("form_responses", formResponses);
  addUuid("member_storage_files", storageFiles);

  // Disk: one level of top dirs under the CDN root, each walked recursively.
  const diskDirs = new Map<string, { bytes: number; files: number }>();
  if (existsSync(CDN_ROOT)) {
    for (const entry of readdirSync(CDN_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory()) diskDirs.set(entry.name, walkDir(path.join(CDN_ROOT, entry.name)));
    }
  }

  const claimedText = new Set<string>();
  const claimedDirs = new Set<string>();

  const siteEntries = sites.map((s) => {
    const textKey = s.subdomain?.trim() || null;
    if (textKey) claimedText.add(textKey);
    const text = textKey ? (byText.get(textKey) ?? {}) : {};
    const uuid = byUuid.get(s.id) ?? {};

    let disk = { bytes: 0, files: 0 };
    for (const candidate of [s.subdomain, s.domain, s.custom_domain]) {
      const dir = candidate?.trim();
      if (dir && diskDirs.has(dir) && !claimedDirs.has(dir)) {
        claimedDirs.add(dir);
        const d = diskDirs.get(dir)!;
        disk = { bytes: disk.bytes + d.bytes, files: disk.files + d.files };
      }
    }

    const tables = { ...text, ...uuid };
    const dbBytes = Object.values(tables).reduce((acc, t) => acc + t.b, 0);
    const dbRows = Object.values(tables).reduce((acc, t) => acc + t.n, 0);
    const storage = tables.member_storage_files as MediaAgg | undefined;

    return {
      key: textKey ?? s.domain ?? s.id,
      label: s.client_name?.trim() || s.domain || s.subdomain || s.id,
      siteId: s.id,
      domain: s.domain,
      subdomain: s.subdomain,
      quotaGb: s.storage_gb ?? null,
      mediaDbBytes: storage?.media ?? 0,
      mediaDbFiles: storage?.n ?? 0,
      diskBytes: disk.bytes,
      diskFiles: disk.files,
      dbBytes,
      dbRows,
      tables,
    };
  });

  // Text scopes with no villager_sites row: house page scopes + shared templates.
  const houseEntries = [...byText.entries()]
    .filter(([key]) => !claimedText.has(key))
    .map(([key, tables]) => ({
      key,
      label: `${key} (house)`,
      siteId: null,
      domain: null,
      subdomain: null,
      quotaGb: null,
      mediaDbBytes: 0,
      mediaDbFiles: 0,
      diskBytes: 0,
      diskFiles: 0,
      dbBytes: Object.values(tables).reduce((acc, t) => acc + t.b, 0),
      dbRows: Object.values(tables).reduce((acc, t) => acc + t.n, 0),
      tables,
    }));

  const buckets = [...diskDirs.entries()]
    .filter(([dir]) => !claimedDirs.has(dir))
    .map(([dir, d]) => ({ dir, bytes: d.bytes, files: d.files }))
    .sort((a, b) => b.bytes - a.bytes);

  const cdn = [...diskDirs.values()].reduce(
    (acc, d) => ({ bytes: acc.bytes + d.bytes, files: acc.files + d.files }),
    { bytes: 0, files: 0 },
  );

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    cdnRoot: CDN_ROOT,
    cdnPresent: existsSync(CDN_ROOT),
    sites: [...siteEntries, ...houseEntries].sort(
      (a, b) => b.diskBytes + b.mediaDbBytes + b.dbBytes - (a.diskBytes + a.mediaDbBytes + a.dbBytes),
    ),
    buckets,
    totals: {
      databaseBytes: num(dbSize[0]?.b),
      demoClones: demoClones.length ? { count: num(demoClones[0].n), bytes: num(demoClones[0].b) } : null,
      cdnBytes: cdn.bytes,
      cdnFiles: cdn.files,
    },
  });
}
