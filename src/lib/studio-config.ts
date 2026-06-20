// src/lib/studio-config.ts
//
// Office-owned shared config for the @tgv/module-studio suite (Villagers → Studio Suite tile).
// Office WRITES this JSON; each host's studio dispatcher READS the same file (via
// @tgv/module-studio's isStudioEnabled) to honour the operator killswitch with no restart. Same
// box ⇒ no network seam needed (unlike the wallet config, which is tenant-owned money and goes
// through the internal-secret proxy). Mirrors lib/course-config.ts.
//
// `perTenant[memberId].schema` is the Postgres schema that tenant's `studio_*` tables live in — the
// registry the cross-tenant analytics routes loop over. Office's pool has NO search_path, so those
// reads MUST schema-qualify (`refusionist.studio_*`); the schema name is interpolated raw into SQL,
// hence isSafeSchema().
//
// ⚠ Cross-schema GRANT wall: Office connects as role `tgv_app`. The `refusionist` tenant's studio
// tables are owned by `refusionist_app`, so `tgv_app` needs an explicit `GRANT SELECT` (run as the
// owner) before the usage/audit routes can read them — see checklist feature-suite-villagers-tiles.
// The `public`-schema tenant (tinyglobalvillage.com) is owned by `tgv_app`, so it needs no grant.
import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type StudioTenantConfig = {
  enabled: boolean;
  label?: string;
  schema: string;
};

export type StudioEnablementConfig = {
  globalKillswitch: boolean;
  perTenant: Record<string, StudioTenantConfig>; // keyed by member_id
};

export const STUDIO_CONFIG_PATH =
  process.env.STUDIO_CONFIG_PATH ?? "/srv/refusion-core/data/studio/studio-config.json";

// Seed registry — the two studio "Sites" live today. refusionist runs the FULL studio (its own
// schema, real classes); tinyglobalvillage.com runs the appointments slice in the shared `public`
// schema (the custom-help studio). New tenants are added here (or via a future "add tenant" action).
// member_id mirrors each host's fixed venue constant.
export const SEED_CONFIG: StudioEnablementConfig = {
  globalKillswitch: false,
  perTenant: {
    "a0a0a0a0-0000-4000-8000-0000005ec0de": {
      enabled: true,
      label: "refusionist.com",
      schema: "refusionist",
    },
    "c0dec0de-0000-4000-8000-000000000001": {
      enabled: true,
      label: "tinyglobalvillage.com",
      schema: "public",
    },
  },
};

export function readStudioConfig(): StudioEnablementConfig {
  try {
    const parsed = JSON.parse(readFileSync(STUDIO_CONFIG_PATH, "utf8")) as Partial<StudioEnablementConfig>;
    const perTenant =
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? (parsed.perTenant as Record<string, StudioTenantConfig>)
        : {};
    return { globalKillswitch: parsed.globalKillswitch === true, perTenant };
  } catch {
    // No file yet ⇒ hand back the seed so the console + analytics resolve on first open.
    return SEED_CONFIG;
  }
}

export function writeStudioConfig(cfg: StudioEnablementConfig): void {
  mkdirSync(dirname(STUDIO_CONFIG_PATH), { recursive: true });
  writeFileSync(STUDIO_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

// Strict Postgres identifier guard — canonical impl lives in suite-oversight.ts; re-exported here
// so existing import sites (usage/audit routes) keep working.
export { isSafeSchema } from "./suite-oversight";
