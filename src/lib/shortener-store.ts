/**
 * Server-side persistence for the shortener: `public.short_links` in tgv_db,
 * the table the tgv-shortener pm2 service resolves every redirect from.
 *
 * Until 2026-10-31 this was /srv/refusion-core/data/shortener/shortlinks.json
 * inside the mono checkout (migration 0208 in tinyglobalvillage.com moved it;
 * Decision 5, ~/.claude/checklist/rcs-pipeline-hardening.md). The API-route
 * shape did not change; the functions became async.
 */
import { pgPool } from "@/lib/pg-pool";

export type ShortLinkContext =
  | { kind: "user"; username: string }
  | { kind: "org"; orgId: "tgv-office" };

export type FrameMode = "redirect" | "iframe" | "landing";

export interface ShortLink {
  code: string;
  destination: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  tags: string[];
  clicks: number;
  lastClickAt: string | null;
  renamedFrom: string[];
  deleted: boolean;
  frameMode?: FrameMode;
  description?: string | null;
}

export type CreateInput = {
  destination: string;
  code?: string;
  expiresAt?: string | null;
  tags?: string[];
  frameMode?: FrameMode;
  context: ShortLinkContext;
};

export type UpdateInput = Partial<{
  destination: string;
  code: string;
  expiresAt: string | null;
  tags: string[];
  frameMode: FrameMode;
}>;

const ALIAS_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const RESERVED_CODES = new Set(["health", "robots.txt", "favicon.ico", "api", "_next"]);
const FRAME_MODES: ReadonlyArray<FrameMode> = ["redirect", "iframe", "landing"];

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/i/l ambiguity

type Row = {
  code: string; destination: string; created_by: string; created_at: Date; expires_at: Date | null;
  tags: string[]; clicks: number; last_click_at: Date | null; renamed_from: string[]; deleted: boolean;
  frame_mode: string; description: string | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toLink(r: Row): ShortLink {
  return {
    code: r.code,
    destination: r.destination,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    expiresAt: iso(r.expires_at),
    tags: r.tags ?? [],
    clicks: r.clicks,
    lastClickAt: iso(r.last_click_at),
    renamedFrom: r.renamed_from ?? [],
    deleted: r.deleted,
    frameMode: (r.frame_mode as FrameMode) ?? "redirect",
    description: r.description,
  };
}

async function liveRow(code: string): Promise<Row | null> {
  const { rows } = await pgPool.query<Row>(
    "SELECT * FROM public.short_links WHERE code = $1 AND NOT deleted", [code]);
  return rows[0] ?? null;
}

function randomCode(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

function ownerKey(context: ShortLinkContext): string {
  return context.kind === "user" ? context.username : `org:${context.orgId}`;
}

function checkAlias(code: string, label = "Alias") {
  if (!ALIAS_RE.test(code)) {
    throw new Error(`${label} must be 1–40 chars (letters, digits, underscore, hyphen)`);
  }
  if (RESERVED_CODES.has(code)) throw new Error(`Alias "${code}" is reserved`);
}

export async function listLinks(context: ShortLinkContext): Promise<ShortLink[]> {
  const { rows } = await pgPool.query<Row>(
    "SELECT * FROM public.short_links WHERE NOT deleted AND created_by = $1 ORDER BY created_at DESC",
    [ownerKey(context)]);
  return rows.map(toLink);
}

export async function createLink(input: CreateInput): Promise<ShortLink> {
  if (!/^https?:\/\//.test(input.destination)) {
    throw new Error("Destination must start with http:// or https://");
  }
  const frameMode = input.frameMode ?? "redirect";
  if (!FRAME_MODES.includes(frameMode)) throw new Error("frameMode must be 'redirect', 'iframe' or 'landing'");
  const custom = input.code?.trim();
  if (custom) checkAlias(custom);

  // A soft-deleted row keeps its code, so a custom alias may reclaim it; a
  // generated code only ever takes a free one.
  for (let attempt = 0; attempt < 60; attempt++) {
    const code = custom || randomCode(attempt < 50 ? 7 : 8);
    if (!custom && RESERVED_CODES.has(code)) continue;
    const { rows } = await pgPool.query<Row>(
      `INSERT INTO public.short_links (code, destination, created_by, expires_at, tags, frame_mode)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         destination = EXCLUDED.destination, created_by = EXCLUDED.created_by, created_at = now(),
         expires_at = EXCLUDED.expires_at, tags = EXCLUDED.tags, frame_mode = EXCLUDED.frame_mode,
         clicks = 0, last_click_at = NULL, renamed_from = '{}', deleted = false, description = NULL
       WHERE public.short_links.deleted AND $7::boolean
       RETURNING *`,
      [code, input.destination, ownerKey(input.context), input.expiresAt ?? null,
        input.tags ?? [], frameMode, !!custom]);
    if (rows[0]) return toLink(rows[0]);
    if (custom) throw new Error(`Alias "${code}" is already in use`);
  }
  throw new Error("Could not allocate a unique short code");
}

export async function updateLink(
  code: string,
  patch: UpdateInput,
  callerOwner: string,
): Promise<ShortLink> {
  const existing = await liveRow(code);
  if (!existing) throw new Error("Link not found");
  if (existing.created_by !== callerOwner) {
    throw new Error("You can only edit links you created in the active context");
  }
  if (patch.destination !== undefined && !/^https?:\/\//.test(patch.destination)) {
    throw new Error("Destination must start with http:// or https://");
  }
  if (patch.frameMode !== undefined && !FRAME_MODES.includes(patch.frameMode)) {
    throw new Error("frameMode must be 'redirect', 'iframe' or 'landing'");
  }
  const renaming = patch.code !== undefined && patch.code !== code;
  if (renaming) checkAlias(patch.code!, "New alias");

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    if (renaming) {
      const taken = await client.query<{ deleted: boolean }>(
        "SELECT deleted FROM public.short_links WHERE code = $1 FOR UPDATE", [patch.code]);
      if (taken.rows[0] && !taken.rows[0].deleted) throw new Error(`Alias "${patch.code}" is already in use`);
      // A soft-deleted row under the new code gives way, as the JSON store's overwrite did.
      if (taken.rows[0]) await client.query("DELETE FROM public.short_links WHERE code = $1", [patch.code]);
    }
    const { rows } = await client.query<Row>(
      `UPDATE public.short_links SET
         destination  = coalesce($2, destination),
         expires_at   = CASE WHEN $3::boolean THEN $4::timestamptz ELSE expires_at END,
         tags         = coalesce($5, tags),
         frame_mode   = coalesce($6, frame_mode),
         code         = coalesce($7, code),
         renamed_from = CASE WHEN $7::text IS NULL THEN renamed_from ELSE array_prepend(code, renamed_from) END
       WHERE code = $1 AND NOT deleted
       RETURNING *`,
      [code, patch.destination ?? null, patch.expiresAt !== undefined, patch.expiresAt ?? null,
        patch.tags ?? null, patch.frameMode ?? null, renaming ? patch.code : null]);
    await client.query("COMMIT");
    if (!rows[0]) throw new Error("Link not found");
    return toLink(rows[0]);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteLink(code: string, callerOwner: string): Promise<void> {
  const existing = await liveRow(code);
  if (!existing) throw new Error("Link not found");
  if (existing.created_by !== callerOwner) {
    throw new Error("You can only delete links you created in the active context");
  }
  // Soft-delete: keeps the row so click history isn't lost; resolver returns 404.
  await pgPool.query("UPDATE public.short_links SET deleted = true WHERE code = $1", [code]);
}

export async function getLink(code: string): Promise<ShortLink | null> {
  const r = await liveRow(code);
  return r ? toLink(r) : null;
}

export function ownerKeyOf(context: ShortLinkContext): string {
  return ownerKey(context);
}
