// src/db/schema/users.ts
import { office } from "./0-office-schema";
import { uuid, text, timestamp } from "drizzle-orm/pg-core";

export const officeUsers = office.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  role: text("role").notNull().default("staff"), // owner, admin, staff
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
