/**
 * Singleton Drizzle client wired to office's pg pool, scoped to the alerts
 * tables provided by @tgv/module-calendar.
 */
import "server-only";
import { createAlertsDb } from "@tgv/module-calendar/alerts/db";
import { pgPool } from "./pg-pool";

export const alertsDb = createAlertsDb(pgPool);
