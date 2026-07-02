// src/lib/course-config.ts
//
// Office-owned shared config for the @tgv/module-course suite (Phase 9). Office WRITES this JSON;
// each host's /api/course dispatcher READS the same file (via @tgv/module-course's isCourseEnabled)
// to honour the operator killswitch with no restart. Same box ⇒ no network seam needed (unlike the
// wallet config, which is tenant-owned money and goes through the internal-secret proxy).
//
// `perTenant[siteId].schema` is the Postgres schema that tenant's `course_*` tables live in — the
// registry the cross-tenant analytics routes loop over. Office's pool has NO search_path, so those
// reads MUST schema-qualify (`refusionist.course_*`); the schema name is interpolated raw into SQL,
// hence isSafeSchema().
import "server-only";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CourseTenantConfig = {
  enabled: boolean;
  label?: string;
  schema: string;
  maxCourses?: number | null; // null/0 ⇒ unlimited
};

export type CourseEnablementConfig = {
  globalKillswitch: boolean;
  perTenant: Record<string, CourseTenantConfig>; // keyed by site_id
};

export const COURSE_CONFIG_PATH =
  process.env.COURSE_CONFIG_PATH ?? "/srv/refusion-core/data/course/course-config.json";

// Seed registry — refusionist is the only host with courses today. New tenants are added here (or
// via a future "add tenant" action). SITE_ID mirrors refusionist's venue constant.
export const SEED_CONFIG: CourseEnablementConfig = {
  globalKillswitch: false,
  perTenant: {
    "a0a0a0a0-0000-4000-8000-0000005ec0de": {
      enabled: true,
      label: "refusionist.com",
      schema: "refusionist",
      maxCourses: null,
    },
  },
};

export function readCourseConfig(): CourseEnablementConfig {
  try {
    const parsed = JSON.parse(readFileSync(COURSE_CONFIG_PATH, "utf8")) as Partial<CourseEnablementConfig>;
    const perTenant =
      parsed.perTenant && typeof parsed.perTenant === "object" && !Array.isArray(parsed.perTenant)
        ? (parsed.perTenant as Record<string, CourseTenantConfig>)
        : {};
    return { globalKillswitch: parsed.globalKillswitch === true, perTenant };
  } catch {
    // No file yet ⇒ hand back the seed so the console + analytics resolve on first open.
    return SEED_CONFIG;
  }
}

export function writeCourseConfig(cfg: CourseEnablementConfig): void {
  mkdirSync(dirname(COURSE_CONFIG_PATH), { recursive: true });
  writeFileSync(COURSE_CONFIG_PATH, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

// Strict Postgres identifier guard — canonical impl lives in suite-oversight.ts; re-exported here
// so existing import sites (usage/audit routes) keep working.
export { isSafeSchema } from "./suite-oversight";
