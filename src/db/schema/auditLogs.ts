// src/db/schema/auditLogs.ts
import { office } from "./0-office-schema";
import { officeUsers } from "./users";
import { uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const officeAuditLogs = office.table("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => officeUsers.id),
  action: text("action").notNull(),        // e.g. "restart_app"
  target: text("target"),                  // e.g. "resonantweaver.com"
  metadata: text("metadata"),              // JSON string if needed
  success: boolean("success").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
