// src/db/schema/projects.ts
import { office } from "./0-office-schema";
import {
  uuid,
  text,
  timestamp,
  date,
  integer,
  varchar,
} from "drizzle-orm/pg-core";

export const officeProjects = office.table("projects", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  // "current" | "new" | "pending_contract"
  status: varchar("status", { length: 32 }).notNull().default("pending_contract"),

  deadline: date("deadline", { mode: "date" }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),

  // Optional: for manual priority within a status category
  sortIndex: integer("sort_index"),

  // VS Code / repo wiring
  vscodeUri: text("vscode_uri"),
  repoPath: text("repo_path"),

  // Visuals
  thumbnailUrl: text("thumbnail_url"),

  // Free-form notes
  notes: text("notes"),
});
