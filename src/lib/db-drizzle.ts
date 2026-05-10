/**
 * Office Drizzle client. Wraps the existing `pgPool` (connected to shared
 * `tgv_db`) with Drizzle + the platform schema lifted from
 * `@tgv/module-registry/db` (Phase 2 Step 3, 2026-05-09).
 *
 * tgv.com owns drizzle-kit and migrations. Office consumes the shared schema
 * read+write at runtime — no kit, no migrations on this side.
 */
import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import * as registrySchema from "@tgv/module-registry/db";
import { pgPool } from "./pg-pool";

export const db = drizzle(pgPool, { schema: registrySchema });
export const schema = registrySchema;
