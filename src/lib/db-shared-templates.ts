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
import { and, asc, desc, eq, isNull, like, or } from "drizzle-orm";
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
    /** Business-vertical tags (migration 0095) — the wizard's curated gallery
     *  filters on these; the Template Gallery shows them on each tile. */
    tags: text("tags").array().notNull().default([]),
    /** 0105 vocabulary: 'private' | 'submitted' | 'declined' (member states)
     *  + 'sandbox' | 'published' (staff states). App-enforced. */
    status: text("status").notNull().default("sandbox"),
    model: jsonb("model_json").notNull(),
    /** 0105 — owning member for personal templates (FK-less uuid). */
    ownerMemberId: uuid("owner_member_id"),
    /** 0105 — 'page' | 'bundle' (bundle_json snapshot; private-only v1). */
    kind: text("kind").notNull().default("page"),
    bundle: jsonb("bundle_json"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by"),
    /** Always stored members.id — 0105 dropped the mistaken villager_sites FK. */
    createdBy: uuid("created_by"),
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

export type SharedTemplateStatus =
  | "sandbox"
  | "published"
  // 0105 member states — surfaced ONLY via listSubmittedTemplates (private/
  // declined member rows never enter staff listings).
  | "private"
  | "submitted"
  | "declined";

export type SharedTemplateSummary = {
  id: string;
  templateId: string;
  label: string;
  description: string;
  category: string;
  thumbnail: string | null;
  suggestedSlug: string;
  suggestedTitle: string;
  tags: string[];
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
    tags: row.tags ?? [],
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

/** 0105 — member submissions awaiting review (FIFO). Extra fields the queue
 *  row needs beyond the summary: kind + owner. */
export type SubmittedTemplateSummary = SharedTemplateSummary & {
  kind: string;
  ownerMemberId: string | null;
  submittedAt: string | null;
};

export async function listSubmittedTemplates(): Promise<SubmittedTemplateSummary[]> {
  const rows = await db
    .select()
    .from(sharedTemplates)
    .where(
      and(
        eq(sharedTemplates.status, "submitted"),
        isNull(sharedTemplates.deletedAt),
      ),
    )
    .orderBy(asc(sharedTemplates.submittedAt));
  return rows.map((row) => ({
    ...rowToSummary(row),
    kind: row.kind,
    ownerMemberId: row.ownerMemberId,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  }));
}

/** Every live row regardless of status — the Template Gallery's "All" pill.
 *  Live first, then most-recently-touched, so the gallery leads with what
 *  members can actually pick. */
export async function listAllSharedTemplates(): Promise<
  SharedTemplateSummary[]
> {
  const rows = await db
    .select()
    .from(sharedTemplates)
    .where(isNull(sharedTemplates.deletedAt))
    .orderBy(asc(sharedTemplates.status), desc(sharedTemplates.updatedAt));

  // Members' personal rows (private/declined) stay OUT of staff listings —
  // the Submitted pill is the only member-row surface (0105).
  return rows
    .filter((r) => r.status !== "private" && r.status !== "declined")
    .map(rowToSummary);
}

/** Soft delete — stamps deleted_at, row stays for audit/restore. The unique
 *  index on template_id is NOT partial, so a deleted id can't be recreated
 *  from the gallery; restoring means clearing deleted_at directly. */
export async function softDeleteSharedTemplate(
  templateId: string,
): Promise<boolean> {
  const rows = await db
    .update(sharedTemplates)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(sharedTemplates.templateId, templateId),
        isNull(sharedTemplates.deletedAt),
      ),
    )
    .returning({ id: sharedTemplates.id });

  return rows.length > 0;
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

// ────────────────────────────────────────────────────────────────────────────
// Create — the Template Gallery's "New template" (canon P4).
//
// Everything else in this file edits a row that already exists, because until
// now a template could only be BORN from an existing page: the studio overlay
// snapshotted a draft. Marthe's loop starts the other way round — an empty
// canvas she composes from the ratified library — so the gallery needs a row to
// exist before there is anything to compose into.
//
// The row is born `sandbox`. There is no create-as-Live: publishing is a
// separate decision with its own route, and a template nobody has laid a single
// section into is not one the wizard should be offering members.
// ────────────────────────────────────────────────────────────────────────────

/** A template id is a URL path segment on both apps — keep it to that alphabet. */
export function slugifyTemplateId(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base || "template";
}

/** `template_id` is UNIQUE across the whole table — soft-deleted rows included,
 *  since the index carries no predicate. So the suffix search must see deleted
 *  rows too, or naming a template after one Marthe threw away fails the insert
 *  with a constraint error nobody can read. */
async function uniqueTemplateId(base: string): Promise<string> {
  const taken = await db
    .select({ templateId: sharedTemplates.templateId })
    .from(sharedTemplates)
    .where(
      or(
        eq(sharedTemplates.templateId, base),
        like(sharedTemplates.templateId, `${base}-%`),
      ),
    );
  const set = new Set(taken.map((r) => r.templateId));
  if (!set.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!set.has(candidate)) return candidate;
  }
  throw new Error(`Too many templates named "${base}".`);
}

/** An empty PageModel — the same `{ id, sections: [] }` shape the editor makes
 *  for a brand-new page (`createEmptyPageModel`). Checkout rewrites `slug` and
 *  `title` onto the scratch draft, so those two are a convenience here, not a
 *  contract. */
function emptyTemplateModel(templateId: string, title: string) {
  return {
    id: `page_tmpl-${templateId}_${Date.now()}`,
    slug: `tmpl-${templateId}`,
    title,
    sections: [] as unknown[],
  };
}

export async function createSharedTemplate(args: {
  label: string;
  description?: string;
  category?: string;
  tags?: string[];
  suggestedSlug?: string;
  suggestedTitle?: string;
  createdBy?: string | null;
}): Promise<SharedTemplateFull> {
  const label = args.label.trim();
  if (!label) throw new Error("A template needs a name.");

  const templateId = await uniqueTemplateId(slugifyTemplateId(label));
  const suggestedSlug = slugifyTemplateId(args.suggestedSlug?.trim() || label);
  const suggestedTitle = (args.suggestedTitle ?? "").trim() || label;

  const [row] = await db
    .insert(sharedTemplates)
    .values({
      templateId,
      label,
      description: (args.description ?? "").trim(),
      category: (args.category ?? "").trim() || "misc",
      tags: (args.tags ?? []).map((t) => t.trim()).filter(Boolean),
      suggestedSlug,
      suggestedTitle,
      status: "sandbox",
      kind: "page",
      model: emptyTemplateModel(templateId, suggestedTitle),
      createdBy: args.createdBy ?? null,
    })
    .returning();

  return { ...rowToSummary(row), model: row.model };
}
