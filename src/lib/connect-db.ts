/**
 * Singleton Drizzle client wired to office's pg pool, scoped to the
 * connect_* tables provided by @tgv/module-connect.
 *
 * Usage:
 *   import { connectDb, ensureConnectBootstrapped } from "@/lib/connect-db";
 *   await ensureConnectBootstrapped();          // idempotent — called by webhook routes
 *   const tasks = await listActiveTasks(connectDb);
 */
import "server-only";
import { createConnectDb, ensureBootstrapped } from "@tgv/module-connect";
import { pgPool } from "./pg-pool";

export const connectDb = createConnectDb(pgPool);

let bootstrapped: Promise<void> | null = null;

/** Idempotent bootstrap — seeds superAdmin + admin recipients from env. */
export async function ensureConnectBootstrapped(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = ensureBootstrapped(connectDb).catch((err) => {
      bootstrapped = null;
      throw err;
    });
  }
  return bootstrapped;
}
