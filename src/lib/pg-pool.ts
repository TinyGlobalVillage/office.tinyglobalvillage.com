/**
 * Office Postgres pool — first introduced 2026-05-01 for @tgv/module-calendar
 * (personal alerts). Office historically used JSON-file stores; this is the
 * bootstrap of a real DB layer.
 *
 * Note: there is also a `db.ts` in this directory that wraps `sudo psql` for
 * admin-tab DB inspection. That file is unrelated — keep them separate.
 *
 * The pool connects to the shared `tgv_db` Postgres database (same instance
 * tinyglobalvillage.com uses). When auth canonicalizes (per `tgv-canonicalization.md`),
 * office's user IDs will join the same `users` table and FK constraints can
 * tighten on the alerts schema.
 */
import "server-only";
import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __officePgPool: Pool | undefined;
}

function build(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set in office .env.local — required for personal alerts and any other Postgres-backed office feature"
    );
  }
  // JIT off (2026-11-25): the planner over-estimates the shared docs/storage CTEs and JIT then spends ~400 ms
  // compiling queries that run in ~10 ms. Same setting as tgv.com's src/db/db.ts.
  return new Pool({ connectionString, max: 10, options: "-c jit=off" });
}

export const pgPool: Pool = global.__officePgPool ?? (global.__officePgPool = build());
