// src/lib/workshop-config.ts
// Single source of truth for "has the Box (RCS) RAM upgrade landed?" — gates the
// On-RCS / Multi-site neon warnings in the Workshop UI and the server-side RCS
// concurrency cap. Default false; flip `boxRamUpgraded` to true (edit the JSON, or
// a future settings toggle) once the upgrade is in and the RCS guards auto-relax.
// Mirrors lib/course-config.ts's read pattern (JSON file + seed fallback).
import { existsSync, readFileSync } from "node:fs";

export type WorkshopSettings = {
  boxRamUpgraded: boolean; // false ⇒ RCS picks warn + cap at 1 concurrent RCS site
};

export const WORKSHOP_SETTINGS_PATH =
  process.env.WORKSHOP_SETTINGS_PATH ?? "/srv/refusion-core/data/workshop/workshop-settings.json";

const SEED: WorkshopSettings = { boxRamUpgraded: false };

export function readWorkshopSettings(): WorkshopSettings {
  try {
    if (!existsSync(WORKSHOP_SETTINGS_PATH)) return { ...SEED };
    const raw = JSON.parse(readFileSync(WORKSHOP_SETTINGS_PATH, "utf8"));
    return { boxRamUpgraded: !!raw.boxRamUpgraded };
  } catch {
    return { ...SEED };
  }
}
