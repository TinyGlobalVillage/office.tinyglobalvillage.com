// Office-local mirror of the shared_templates table. TGV.com owns the schema
// + drizzle-kit migrations (clients/tinyglobalvillage.com/src/db/schemas/
// sharedTemplates.ts); Office connects to the same tgv_db at runtime and
// reads/writes the same rows directly — no auth bridge or cross-app HTTP hop.
//
// Keep this file in sync with the TGV-side definition when columns change.

import "server-only";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { and, desc, eq, isNull } from "drizzle-orm";
import { villagerSites } from "@tgv/module-registry/db";
import { db } from "./db-drizzle";

export const sharedTemplates = pgTable(
  "shared_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: text("template_id").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("misc"),
    thumbnail: text("thumbnail"),
    suggestedSlug: text("suggested_slug").notNull(),
    suggestedTitle: text("suggested_title").notNull(),
    status: text("status").notNull().default("sandbox"),
    model: jsonb("model_json").notNull(),
    createdBy: uuid("created_by").references(() => villagerSites.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    templateIdUnique: uniqueIndex("shared_templates_template_id_uq").on(
      t.templateId,
    ),
  }),
);

export type SharedTemplateStatus = "sandbox" | "published";

export type SharedTemplateSummary = {
  id: string;
  templateId: string;
  label: string;
  description: string;
  category: string;
  thumbnail: string | null;
  suggestedSlug: string;
  suggestedTitle: string;
  status: SharedTemplateStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type SharedTemplateFull = SharedTemplateSummary & {
  model: unknown;
};

function rowToSummary(
  row: typeof sharedTemplates.$inferSelect,
): SharedTemplateSummary {
  return {
    id: row.id,
    templateId: row.templateId,
    label: row.label,
    description: row.description,
    category: row.category,
    thumbnail: row.thumbnail,
    suggestedSlug: row.suggestedSlug,
    suggestedTitle: row.suggestedTitle,
    status: row.status as SharedTemplateStatus,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}

export async function listSharedTemplatesForStatus(
  status: SharedTemplateStatus,
): Promise<SharedTemplateSummary[]> {
  const rows = await db
    .select()
    .from(sharedTemplates)
    .where(
      and(
        eq(sharedTemplates.status, status),
        isNull(sharedTemplates.deletedAt),
      ),
    )
    .orderBy(desc(sharedTemplates.updatedAt));

  return rows.map(rowToSummary);
}

export async function getSharedTemplate(
  templateId: string,
): Promise<SharedTemplateFull | null> {
  const [row] = await db
    .select()
    .from(sharedTemplates)
    .where(
      and(
        eq(sharedTemplates.templateId, templateId),
        isNull(sharedTemplates.deletedAt),
      ),
    )
    .limit(1);

  if (!row) return null;
  return {
    ...rowToSummary(row),
    model: row.model,
  };
}

export async function setSharedTemplateStatus(args: {
  templateId: string;
  status: SharedTemplateStatus;
}): Promise<SharedTemplateFull | null> {
  const { templateId, status } = args;

  const updates: Record<string, unknown> = {
    status,
    updatedAt: new Date(),
  };
  if (status === "published") {
    updates.publishedAt = new Date();
  }

  await db
    .update(sharedTemplates)
    .set(updates)
    .where(
      and(
        eq(sharedTemplates.templateId, templateId),
        isNull(sharedTemplates.deletedAt),
      ),
    );

  return getSharedTemplate(templateId);
}

export type SharedTemplatePatch = Partial<{
  label: string;
  description: string;
  category: string;
  thumbnail: string | null;
  suggestedSlug: string;
  suggestedTitle: string;
  model: unknown;
}>;

export async function patchSharedTemplate(args: {
  templateId: string;
  patch: SharedTemplatePatch;
}): Promise<SharedTemplateFull | null> {
  const { templateId, patch } = args;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.label !== undefined) updates.label = patch.label;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.thumbnail !== undefined) updates.thumbnail = patch.thumbnail;
  if (patch.suggestedSlug !== undefined) updates.suggestedSlug = patch.suggestedSlug;
  if (patch.suggestedTitle !== undefined) updates.suggestedTitle = patch.suggestedTitle;
  if (patch.model !== undefined) updates.model = patch.model;

  await db
    .update(sharedTemplates)
    .set(updates)
    .where(
      and(
        eq(sharedTemplates.templateId, templateId),
        isNull(sharedTemplates.deletedAt),
      ),
    );

  return getSharedTemplate(templateId);
}
