// /api/sandbox/tenant-overlay — Phase 4.3 of office-sandbox-catalog-mirror.
//
// The WRITE side of the per-tenant overlay model (the resolver's READ side shipped in 4.1). A
// tenant's customisation of a catalog block's DEFAULT is a `content_overrides` row keyed
// `block-default:<id>` with `tenant_id = <members.id>` and the `version` it was authored against.
// The resolver already prefers a tenant row over the platform default.
//
//   GET  ?id=&tenantId=&lang=&mode=draft|published     → the tenant's overlay (or {exists:false})
//   PUT  {catalogId, tenantId, lang?, version, data}   → save/replace the tenant DRAFT
//   POST {catalogId, tenantId, lang?}                  → publish: copy tenant DRAFT → PUBLISHED
//   DELETE ?id=&tenantId=&lang=&mode?                  → drop the tenant overlay (revert to platform/in-code)
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

/** Map a Postgres FK violation (23503 — tenantId isn't a real members.id) to a clean 400. */
function fkErrorResponse(e: unknown): NextResponse | null {
  if ((e as { code?: string })?.code === "23503")
    return NextResponse.json({ error: "invalid tenantId (not a member)" }, { status: 400 });
  return null;
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const tenantId = u.searchParams.get("tenantId") ?? "";
  const lang = u.searchParams.get("lang") ?? "en";
  const mode = (u.searchParams.get("mode") ?? "published") as OverlayMode;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "bad tenantId" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (mode !== "draft" && mode !== "published") return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const row = await readTenantOverlay(poolQuery, { catalogId: id, tenantId, lang, mode });
  return NextResponse.json(
    row
      ? { id, tenantId, lang, mode, exists: true, version: row.version, data: row.data, updatedAt: row.updatedAt }
      : { id, tenantId, lang, mode, exists: false, data: null },
  );
}

export async function PUT(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = validateWriteOverlay({ ...body, mode: "draft" });
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });

  try {
    await withClient((q) => writeTenantOverlay(q, input));
  } catch (e) {
    return fkErrorResponse(e) ?? NextResponse.json({ error: "failed to save overlay" }, { status: 500 });
  }
  return NextResponse.json({ id: input.catalogId, tenantId: input.tenantId, lang: input.lang, mode: "draft", version: input.version, saved: true });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as { catalogId?: string; tenantId?: string; lang?: string } | null;
  const id = body?.catalogId ?? "";
  const tenantId = body?.tenantId ?? "";
  const lang = body?.lang ?? "en";
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad catalogId" }, { status: 400 });
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "bad tenantId" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });

  const draft = await readTenantOverlay(poolQuery, { catalogId: id, tenantId, lang, mode: "draft" });
  if (!draft) return NextResponse.json({ error: "no tenant draft to publish" }, { status: 400 });

  try {
    await withClient((q) =>
      writeTenantOverlay(q, { catalogId: id, tenantId, lang, mode: "published", version: draft.version, data: draft.data }),
    );
  } catch (e) {
    return fkErrorResponse(e) ?? NextResponse.json({ error: "failed to publish overlay" }, { status: 500 });
  }
  return NextResponse.json({ id, tenantId, lang, mode: "published", version: draft.version, published: true });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const u = new URL(req.url);
  const id = u.searchParams.get("id") ?? "";
  const tenantId = u.searchParams.get("tenantId") ?? "";
  const lang = u.searchParams.get("lang") ?? "en";
  const mode = u.searchParams.get("mode") as OverlayMode | null;
  if (!ID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "bad tenantId" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (mode && mode !== "draft" && mode !== "published") return NextResponse.json({ error: "bad mode" }, { status: 400 });

  const deleted = await deleteTenantOverlay(poolQuery, { catalogId: id, tenantId, lang, mode: mode ?? undefined });
  return NextResponse.json({ id, tenantId, lang, deleted, revertedToPlatformDefault: true });
}
