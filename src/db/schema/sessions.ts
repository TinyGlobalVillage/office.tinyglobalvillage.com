// src/db/schema/sessions.ts
import { office } from "./0-office-schema";
import { officeUsers } from "./users";
import { uuid, text, timestamp } from "drizzle-orm/pg-core";

export const officeSessions = office.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => officeUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
