// /api/sandbox/component-update-apply — Phase 4.4 (preview) + 4.5 (apply) of office-sandbox-catalog-mirror.
//
// Rebase a tenant's overlay onto a NEW component version ("update available → apply"). Runs the
// 3-way merge ENTIRELY SERVER-SIDE from DB data (no catalog needed — 4.2 stores default VALUES per
// version in component_versions): base = vFrom snapshot, incoming = vTo snapshot, theirs = the
// tenant's overlay. See @tgv/module-page-editor editor/defaults/reconcile.ts for the outcomes.
//
//   POST { mode:'preview', catalogId, tenantId, lang?, fromVersion, toVersion }
//        → { outcome, classification, reconciled, preservedFields, flaggedFields, blastRadius }
//   POST { mode:'apply',   ... }
//        → writes the reconciled overlay (published+draft @ toVersion) + audits to data/reconcile/*.jsonl
//
// NOTE — the overlay-based cascade makes a page_models REWRITE unnecessary: sections that render
// from the default automatically pick up the reconciled overlay; sections with explicit props are
// independent of it. So `blastRadius` is INFORMATIONAL (which pages render this block) — apply only
// writes the overlay. (Component-global, not tenant-scoped: page_models.user_id↔members isn't linked.)

import { type NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import { loadSnapshot, type QueryFn } from "@/lib/domains/editor/component-library/versionStore";
import { readTenantOverlay, writeTenantOverlay } from "@/lib/domains/editor/defaults/overlayStore";
import { reconcile } from "@/lib/domains/editor/defaults/reconcile";

export const runtime = "nodejs";

const poolQuery: QueryFn = (text, params) => pgPool.query(text, params as unknown[]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/i;
const LANG_RE = /^[a-z]{2}(-[a-z]{2})?$/i;

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

/** Pages that render this block (informational blast radius). Component-global. */
async function blastRadius(catalogId: string) {
  try {
    const r = await poolQuery(
      `SELECT id, slug, lang, site, mode, COALESCE(title,'') AS title,
              (SELECT count(*) FROM jsonb_array_elements(model_json->'sections') s
                 WHERE s->>'type' = $1)::int AS section_hits
         FROM page_models
        WHERE deleted_at IS NULL
          AND jsonb_typeof(model_json->'sections') = 'array'
          AND model_json->'sections' @> $2::jsonb
        ORDER BY site, slug
        LIMIT 200`,
      [catalogId, JSON.stringify([{ type: catalogId }])],
    );
    return r.rows.map((row) => ({
      slug: String(row.slug),
      lang: String(row.lang),
      site: String(row.site),
      mode: String(row.mode),
      title: String(row.title),
      sectionHits: Number(row.section_hits),
    }));
  } catch {
    return []; // blast radius is informational — never fail the reconcile on it
  }
}

async function audit(record: Record<string, unknown>) {
  try {
    const dir = path.join(process.cwd(), "data", "reconcile");
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(path.join(dir, "reconcile.jsonl"), JSON.stringify(record) + "\n", "utf8");
  } catch {
    /* audit is best-effort — never fail the apply on a log write */
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;
  const actor = (gate as { username?: string } | null)?.username ?? "admin";

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const mode = b?.mode === "apply" ? "apply" : "preview";
  const catalogId = String(b?.catalogId ?? "");
  const tenantId = String(b?.tenantId ?? "");
  const lang = String(b?.lang ?? "en");
  const fromVersion = Number(b?.fromVersion);
  const toVersion = Number(b?.toVersion);

  if (!ID_RE.test(catalogId)) return NextResponse.json({ error: "bad catalogId" }, { status: 400 });
  if (!UUID_RE.test(tenantId)) return NextResponse.json({ error: "bad tenantId" }, { status: 400 });
  if (!LANG_RE.test(lang)) return NextResponse.json({ error: "bad lang" }, { status: 400 });
  if (!Number.isInteger(toVersion) || toVersion < 1) return NextResponse.json({ error: "bad toVersion" }, { status: 400 });
  // fromVersion is advisory: a stale overlay can carry version 0 (pre-versioning / older than any
  // tracked snapshot). Don't 400 on a low value — effectiveFrom below falls back to the overlay's
  // own version and reconcile() degrades safely when the base snapshot is missing. Only reject a
  // negative or non-integer value.
  if (b?.fromVersion != null && (!Number.isInteger(fromVersion) || fromVersion < 0))
    return NextResponse.json({ error: "bad fromVersion" }, { status: 400 });

  // Incoming (new) version must have a snapshot — run "Sync versions" first if not.
  const incoming = await loadSnapshot(poolQuery, catalogId, toVersion);
  if (!incoming) {
    return NextResponse.json(
      { error: `no component_versions snapshot for ${catalogId}@${toVersion} — Sync versions first` },
      { status: 400 },
    );
  }

  // The tenant's current overlay (what we're rebasing). None → nothing to reconcile; they ride the cascade.
  const overlay = await readTenantOverlay(poolQuery, { catalogId, tenantId, lang, mode: "published" });
  if (!overlay) {
    return NextResponse.json({
      outcome: "NO_OVERLAY",
      message: "Tenant has no overlay for this block — the new version's default applies automatically.",
      blastRadius: await blastRadius(catalogId),
      fromVersion: fromVersion || null,
      toVersion,
    });
  }

  const effectiveFrom = Number.isInteger(fromVersion) && fromVersion >= 1 ? fromVersion : overlay.version;
  const base = await loadSnapshot(poolQuery, catalogId, effectiveFrom); // may be null → reconcile treats all as customised

  const result = reconcile({
    baseDefaults: (base?.defaultProps as Record<string, unknown> | undefined) ?? null,
    newDefaults: incoming.defaultProps as Record<string, unknown>,
    baseShape: base?.propShape,
    newShape: incoming.propShape,
    overlay: overlay.data,
    breaking: incoming.breaking,
  });

  const radius = await blastRadius(catalogId);

  if (mode === "preview") {
    return NextResponse.json({
      mode: "preview",
      catalogId,
      tenantId,
      lang,
      fromVersion: effectiveFrom,
      toVersion,
      baseSnapshotMissing: !base,
      ...result,
      blastRadius: radius,
    });
  }

  // APPLY — persist the reconciled overlay at toVersion (published + draft), then audit.
  try {
    await withClient(async (q) => {
      await writeTenantOverlay(q, { catalogId, tenantId, lang, mode: "published", version: toVersion, data: result.reconciled });
      await writeTenantOverlay(q, { catalogId, tenantId, lang, mode: "draft", version: toVersion, data: result.reconciled });
    });
  } catch (e) {
    return fkErrorResponse(e) ?? NextResponse.json({ error: "failed to persist reconciled overlay" }, { status: 500 });
  }
  await audit({
    ts: new Date().toISOString(),
    actor,
    catalogId,
    tenantId,
    lang,
    fromVersion: effectiveFrom,
    toVersion,
    outcome: result.outcome,
    classification: result.classification,
    preservedFields: result.preservedFields,
    flaggedFields: result.flaggedFields,
    baseSnapshotMissing: !base,
  });

  return NextResponse.json({
    mode: "apply",
    applied: true,
    catalogId,
    tenantId,
    lang,
    fromVersion: effectiveFrom,
    toVersion,
    outcome: result.outcome,
    classification: result.classification,
    preservedFields: result.preservedFields,
    flaggedFields: result.flaggedFields,
    blastRadius: radius,
  });
}
