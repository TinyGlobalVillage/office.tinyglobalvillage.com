// /api/sandbox/component-versions — Phase 4.2 of office-sandbox-catalog-mirror.
//
// Operator surface (TGV Office = HQ editor) for the component_versions snapshot registry
// (migration 0014). Each catalog component has a CURRENT version (versions.ts sidecar); this
// table freezes the PROP SHAPE + DEFAULT VALUES that version shipped with, so a later tenant
// update can be diffed structural-vs-cosmetic (propShape.ts) and re-poured (default values).
//
// ARCHITECTURE — the catalog can only be read CLIENT-side: its entries are assembled in
// "use client" modules, so a SERVER route importing them gets client-reference proxies whose
// `.defaultProps` is undefined (verified — Phase 4.2 probe). Therefore the snapshots are
// computed in the BROWSER (versionSync.currentSnapshots) and POSTed here; this route imports
// ONLY the server-safe DB I/O (versionStore.ts), never the catalog.
//
//   GET  → the stored snapshot rows (server-only; the client diffs them against its
//          locally-computed currentSnapshots to find what needs syncing).
//   POST {snapshots:[...]} → validate each + upsert (the seed / re-sync). IDEMPOTENT.
//          Run this (from the sandbox "Sync versions" control) BEFORE bumping any component's
//          version for the first time, so each block's prior-version shape is captured.
//
// Admin-gated (requireAdmin). Raw node-pg via pgPool bound to the store's QueryFn.

import { type NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-admin";
import { pgPool } from "@/lib/pg-pool";
import {
  writeSnapshots,
  storedVersions,
  validateSnapshot,
  type QueryFn,
} from "@/lib/domains/editor/component-library/versionStore";

export const runtime = "nodejs";

const MAX_SNAPSHOTS = 500; // catalog is ~80; cap guards the POST body.

/** Bind pgPool to the QueryFn shape the store expects (node-pg query(text, params)). */
const query: QueryFn = (text, params) => pgPool.query(text, params as unknown[]);

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  try {
    const stored = await storedVersions(query);
    return NextResponse.json({ storedCount: stored.length, stored });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to read component_versions" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if (gate instanceof NextResponse) return gate;

  const body = (await req.json().catch(() => null)) as { snapshots?: unknown } | null;
  if (!body || !Array.isArray(body.snapshots)) {
    return NextResponse.json(
      { error: "expected { snapshots: ComponentVersionSnapshot[] } (compute via versionSync.currentSnapshots in the browser)" },
      { status: 400 },
    );
  }
  if (body.snapshots.length === 0) return NextResponse.json({ synced: true, upserted: 0, ids: [] });
  if (body.snapshots.length > MAX_SNAPSHOTS) {
    return NextResponse.json({ error: `too many snapshots (>${MAX_SNAPSHOTS})` }, { status: 400 });
  }

  const valid = body.snapshots.map(validateSnapshot);
  const bad = valid.findIndex((v) => v === null);
  if (bad !== -1) {
    return NextResponse.json({ error: `invalid snapshot at index ${bad}` }, { status: 400 });
  }

  try {
    const result = await writeSnapshots(query, valid as NonNullable<(typeof valid)[number]>[]);
    return NextResponse.json({ synced: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { synced: false, error: e instanceof Error ? e.message : "sync failed" },
      { status: 500 },
    );
  }
}
