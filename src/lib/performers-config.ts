// src/lib/performers-config.ts
//
// Office-owned shared config for the @tgv/module-performers suite (Villagers → Performers Suite
// tile). Office WRITES this JSON; each host's performers dispatcher READS the same file (via
// @tgv/module-performers's isPerformersEnabled) to honour the operator killswitch with no restart.
// Same box ⇒ no network seam needed (unlike the wallet config, which is tenant-owned money and goes
// through the internal-secret proxy). Mirrors lib/course-config.ts + lib/studio-config.ts.
//
// `perTenant[memberId].schema` is the Postgres schema that tenant's `performer_*` tables live in —
// the registry the cross-tenant analytics routes loop over. Office's pool has NO search_path, so
// those reads MUST schema-qualify (`refusionist.performer_*`); the schema name is interpolated raw
// into SQL, hence isSafeSchema().
//
// ⚠ Cross-schema GRANT wall: Office connects as role `tgv_app`. The `refusionist` tenant's performer
// tables are owned by `refusionist_app`, so `tgv_app` needs an explicit `GRANT SELECT` (run as the
// owner) before the usage/audit routes can read them — see checklist feature-suite-villagers-tiles
// + rcs-stack/postgres.md §"Cross-schema operator read grants".
import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PerformersTenantConfig = {
  enabled: boolean;
  label?: string;
  schema: string;
};

export type PerformersEnablementConfig = {
  globalKillswitch: boolean;
  perTenant: Record<string, PerformersTenantConfig>; // keyed by member_id
};

export const PERFORMERS_CONFIG_PATH =
  process.env.PERFORMERS_CONFIG_PATH ?? "/srv/refusion-core/data/performers/performers-config.json";

// Seed registry — refusionist is the only host with the performers schema deployed today (its
// `performer_*` tables live in the `refusionist` schema; member_id mirrors its fixed venue
// constant). New tenants are added here (or via a future "add tenant" action).
export const SEED_CONFIG: PerformersEnablementConfig = {
  globalKillswitch: false,
  perTenant: {
    "a0a0a0a0-0000-4000-8000-0000005ec0de": {
      enabled: true,
      label: "refusionist.com",
      schema: "refusionist",
    },
  },
};

export function readPerformersConfig(): PerformersEnablementConfig {
  try {
    const parsed = JSON.parse(readFileSync(PERFORMERS_CONFIG_PATH, "utf8")) as Partial<PerformersEnablementConfig>;
    const perTenant =
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? (parsed.perTenant as Record<string, PerformersTenantConfig>)
        : {};
    return { globalKillswitch: parsed.globalKillswitch === true, perTenant };
  } catch {
    // No file yet ⇒ hand back the seed so the console + analytics resolve on first open.
    return SEED_CONFIG;
  }
}

export function writePerformersConfig(cfg: PerformersEnablementConfig): void {
  mkdirSync(dirname(PERFORMERS_CONFIG_PATH), { recursive: true });
  writeFileSync(PERFORMERS_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

// Canonical Postgres identifier guard lives in suite-oversight.ts; re-exported for the usage/audit
// routes that schema-qualify raw.
export { isSafeSchema } from "./suite-oversight";
