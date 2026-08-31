// src/lib/storage/deps.ts — Office's wiring of @tgv/module-storage: the COMPANY gallery.
//
// Office is an operator surface with no member session of its own, so this mount does NOT use
// createTenantStorage (which resolves member → active site from the tgv.com session). Instead every
// admin who passes requireAdmin acts in ONE pinned HOUSE scope: the HQ villager_sites row
// (tinyglobalvillage.com) + its founding owner member — so "our gallery" is the same set of files for
// every Office admin, and the same rows the HQ dashboard gallery reads (shared tgv_db). Uploads land
// on R2 via the same adapter tgv.com prod uses; Office has all R2_* creds but no STORAGE_DRIVER env,
// so the driver is requested in code (disk fallback with a warn, mirroring tenant.ts).
//
// Public picks are served by tgv.com's tokenized share route (readShared is a pure token lookup —
// no site/host scoping), which is why the email workbench passes
// assetOrigin="https://tinyglobalvillage.com" and Office needs no public byte route of its own.
import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  createStorageHandlers,
  createStorageDiskAdapter,
  createStorageR2AdapterFromEnv,
  createPgQuotaProvider,
  type StorageAdapterExt,
  type StorageScope,
} from "@tgv/module-storage/server";
import { pgPool } from "@/lib/pg-pool";
import { requireAdmin } from "@/lib/api-admin";

const CDN_ROOT = process.env.CDN_ROOT ?? "/srv/refusion-core/cdn";
const CDN_BASE_URL = process.env.CDN_BASE_URL ?? "https://office.tinyglobalvillage.com/media";
const HOUSE_DOMAIN = "tinyglobalvillage.com";

// R2 requested in code (no STORAGE_DRIVER on Office) — same fallback discipline as tenant.ts.
let adapter: StorageAdapterExt = createStorageDiskAdapter({ cdnRoot: CDN_ROOT, cdnBaseUrl: CDN_BASE_URL });
try {
  const r2 = createStorageR2AdapterFromEnv();
  if (r2) adapter = r2;
  else console.warn("[office storage] R2_* env incomplete — falling back to disk");
} catch (e) {
  console.warn("[office storage] R2 adapter init failed — falling back to disk:", e);
}

// The pinned house scope: HQ site + its founding owner, resolved from the DB (never hardcoded ids —
// build-for-sharing) and cached briefly. tenantSlug mirrors tenant.ts's domainSlug so Office writes
// the same object-key prefix tgv.com does.
let houseCache: { at: number; scope: Omit<StorageScope, "role"> & { role: StorageScope["role"] } } | null = null;
const HOUSE_TTL_MS = 5 * 60_000;

async function houseScope(): Promise<StorageScope | null> {
  if (houseCache && Date.now() - houseCache.at < HOUSE_TTL_MS) return houseCache.scope;
  const r = await pgPool.query(
    `SELECT vs.id AS site_id, v.member_id, m.role
       FROM villager_sites vs
       JOIN villager v ON v.site_id = vs.id AND v.status IN ('registered','active')
       JOIN members m  ON m.id = v.member_id
      WHERE lower(vs.domain) = $1
      ORDER BY v.created_at ASC
      LIMIT 1`,
    [HOUSE_DOMAIN],
  );
  const row = (r.rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  const role = String(row.role) === "superadmin" ? "superadmin" : String(row.role) === "admin" ? "admin" : "member";
  const scope: StorageScope = {
    tenantSlug: HOUSE_DOMAIN.split(".")[0],
    siteId: String(row.site_id),
    memberId: String(row.member_id),
    role,
  };
  houseCache = { at: Date.now(), scope };
  return scope;
}

// Admin gate → house scope. Null (→ the handlers' 401) for anyone requireAdmin refuses.
async function resolveScope(req: Request): Promise<StorageScope | null> {
  const gate = await requireAdmin(req as NextRequest);
  if (gate instanceof NextResponse) return null;
  return houseScope();
}

const quota = createPgQuotaProvider({
  pool: pgPool,
  // The company's own gallery on the company's own box — always the paid tier.
  resolveTier: async () => "plus",
});

export const storage = createStorageHandlers({
  adapter,
  cdnBaseUrl: CDN_BASE_URL,
  pool: pgPool,
  resolveScope,
  quota,
  readBasePath: "/api/storage/file",
});

export function storageError(e: unknown): Response {
  console.error("[office storage] unexpected", e);
  return new Response(JSON.stringify({ error: "internal" }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}
