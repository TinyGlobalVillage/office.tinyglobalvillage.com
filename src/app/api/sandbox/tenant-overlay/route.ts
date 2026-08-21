// /api/sandbox/tenant-overlay — Phase 4.3 of office-sandbox-catalog-mirror.
//
// The WRITE side of the per-site overlay model (the resolver's READ side shipped in 4.1). A
// site's customisation of a catalog block's DEFAULT is a `content_overrides` row keyed
// `block-default:<id>` with `site = <subdomain>` and the `version` it was authored against.
// The resolver already prefers a site row over the platform default.
//
//   GET  ?id=&site=&lang=&mode=draft|published     → the site's overlay (or {exists:false})
//   PUT  {catalogId, site, lang?, version, data}   → save/replace the site DRAFT
//   POST {catalogId, site, lang?}                  → publish: copy site DRAFT → PUBLISHED
//   DELETE ?id=&site=&lang=&mode?                  → drop the overlay (revert to platform/in-code)
//
// The scope key is the SUBDOMAIN since D2 (2026-08-20) retired content_overrides.tenant_id.
// That column carried an FK to villager_sites, so a bad id used to fail as a 23503; `site` is
// free text, and requireKnownSite() replaces that guarantee with an explicit existence check —
// otherwise a typo'd subdomain would write an overlay no site can ever read.
//
// `version` is CLIENT-supplied (the browser knows the catalog's current version — the server can't
// read the "use client" catalog). Admin-gated; raw node-pg via pgPool. Writes use a PINNED
// connection so the overlay upsert's UPDATE-then-INSERT runs in one real transaction.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import {
  writeTenantOverlay,
  readTenantOverlay,
  deleteTenantOverlay,
  validateWriteOverlay,
  type QueryFn,
  type OverlayMode,
} from "@/lib/domains/editor/defaults/overlayStore";

export const runtime = "nodejs";

const poolQuery: QueryFn = (text, params) => pgPool.query(text, params as unknown[]);
const SITE_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const LANG_RE = /^[a-z]{2}(-[a-z]{2})?$/i;

/** Run a writer on a PINNED pooled connection so its BEGIN/UPDATE/INSERT/COMMIT are one txn. */
async function withClient<T>(fn: (q: QueryFn) => Promise<T>): Promise<T> {
  const client = await pgPool.connect();
  try {
    return await fn((text, params) => client.query(text, params as unknown[]));
  } finally {
    client.release();
  }
}

/** The FK that `tenant_id` carried, restated in code: refuse a subdomain no villager site has.
 *  Returns a 400 response when the site is unknown, null when it checks out. */
async function requireKnownSite(site: string): Promise<NextResponse | null> {
  const r = await pgPool.query(`SELECT 1 FROM villager_sites WHERE subdomain = $1 LIMIT 1`, [site]);
  return r.rowCount
    ? null
    : NextResponse.json({ error: "invalid site (no such villager site)" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const site = u.searchParams.get("site") ?? "";
  const lang = u.searchParams.get("lang") ?? "en";
  const mode = (u.searchParams.get("mode") ?? "published") as OverlayMode;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!SITE_RE.test(site)) return NextResponse.json({ error: "bad site" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (mode !== "draft" && mode !== "published") return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const row = await readTenantOverlay(poolQuery, { catalogId: id, site, lang, mode });
  return NextResponse.json(
    row
      ? { id, site, lang, mode, exists: true, version: row.version, data: row.data, updatedAt: row.updatedAt }
      : { id, site, lang, mode, exists: false, data: null },
  );
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = validateWriteOverlay({ ...body, mode: "draft" });
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  const unknown = await requireKnownSite(input.site);
  if (unknown) return unknown;

  try {
    await withClient((q) => writeTenantOverlay(q, input));
  } catch {
    return NextResponse.json({ error: "failed to save overlay" }, { status: 500 });
  }
  return NextResponse.json({ id: input.catalogId, site: input.site, lang: input.lang, mode: "draft", version: input.version, saved: true });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as { catalogId?: string; site?: string; lang?: string } | null;
  const id = body?.catalogId ?? "";
  const site = body?.site ?? "";
  const lang = body?.lang ?? "en";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad catalogId" }, { status: 400 });
  if (!SITE_RE.test(site)) return NextResponse.json({ error: "bad site" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });

  const draft = await readTenantOverlay(poolQuery, { catalogId: id, site, lang, mode: "draft" });
  if (!draft) return NextResponse.json({ error: "no site draft to publish" }, { status: 400 });

  try {
    await withClient((q) =>
      writeTenantOverlay(q, { catalogId: id, site, lang, mode: "published", version: draft.version, data: draft.data }),
    );
  } catch {
    return NextResponse.json({ error: "failed to publish overlay" }, { status: 500 });
  }
  return NextResponse.json({ id, site, lang, mode: "published", version: draft.version, published: true });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const site = u.searchParams.get("site") ?? "";
  const lang = u.searchParams.get("lang") ?? "en";
  const mode = u.searchParams.get("mode") as OverlayMode | null;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!SITE_RE.test(site)) return NextResponse.json({ error: "bad site" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (mode && mode !== "draft" && mode !== "published") return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const deleted = await deleteTenantOverlay(poolQuery, { catalogId: id, site, lang, mode: mode ?? undefined });
  return NextResponse.json({ id, site, lang, deleted, revertedToPlatformDefault: true });
}
