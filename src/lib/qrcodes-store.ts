/**
 * Server-side persistence for saved QR-code configurations: `public.qr_codes`
 * in tgv_db (migration 0208 in tinyglobalvillage.com; until 2026-10-31 it was
 * /srv/refusion-core/data/qrcodes/qrcodes.json in the mono checkout).
 *
 * Why "configuration" not "image" — a QR code is deterministic from its
 * input + settings, so we never store the rendered PNG/SVG bytes. We store
 * the text + render settings + a user-chosen name, and the modal regenerates
 * the image client-side every time. This keeps storage tiny and avoids
 * stale-image problems (rename a TinyURL → its QR keeps working because the
 * config encodes the short URL, not the destination).
 */
import crypto from "crypto";
import { pgPool } from "@/lib/pg-pool";

export type QRContext =
  | { kind: "user"; username: string }
  | { kind: "org"; orgId: "tgv-office" };

export type QRErrorCorrection = "L" | "M" | "Q" | "H";

export interface QRCodeRecord {
  id: string;
  name: string;
  text: string;
  errorCorrection: QRErrorCorrection;
  transparentBg: boolean;
  /** Optional pointer to a TinyURL code so the UI can show "linked to /<code>". */
  linkedShortCode: string | null;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  deleted: boolean;
}

export type CreateQRInput = {
  name: string;
  text: string;
  errorCorrection?: QRErrorCorrection;
  transparentBg?: boolean;
  linkedShortCode?: string | null;
  tags?: string[];
  context: QRContext;
};

export type UpdateQRInput = Partial<{
  name: string;
  text: string;
  errorCorrection: QRErrorCorrection;
  transparentBg: boolean;
  linkedShortCode: string | null;
  tags: string[];
}>;

const ERROR_LEVELS: ReadonlyArray<QRErrorCorrection> = ["L", "M", "Q", "H"];

type Row = {
  id: string; name: string; text: string; error_correction: string; transparent_bg: boolean;
  linked_short_code: string | null; tags: string[]; created_by: string;
  created_at: Date; updated_at: Date; deleted: boolean;
};

function toRecord(r: Row): QRCodeRecord {
  return {
    id: r.id,
    name: r.name,
    text: r.text,
    errorCorrection: r.error_correction as QRErrorCorrection,
    transparentBg: r.transparent_bg,
    linkedShortCode: r.linked_short_code,
    tags: r.tags ?? [],
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
    deleted: r.deleted,
  };
}

async function liveRow(id: string): Promise<Row | null> {
  const { rows } = await pgPool.query<Row>("SELECT * FROM public.qr_codes WHERE id = $1 AND NOT deleted", [id]);
  return rows[0] ?? null;
}

function ownerKey(context: QRContext): string {
  return context.kind === "user" ? context.username : `org:${context.orgId}`;
}

function newId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function validateText(text: string) {
  if (!text || text.length === 0) {
    throw new Error("QR text cannot be empty.");
  }
  if (text.length > 4296) {
    throw new Error("QR text exceeds the maximum encodable length (4296 chars).");
  }
}

function validateName(name: string) {
  if (!name || name.trim().length === 0) {
    throw new Error("QR name is required so you can find it again.");
  }
  if (name.length > 120) {
    throw new Error("QR name must be 120 chars or fewer.");
  }
}

export async function listQRCodes(context: QRContext): Promise<QRCodeRecord[]> {
  const { rows } = await pgPool.query<Row>(
    "SELECT * FROM public.qr_codes WHERE NOT deleted AND created_by = $1 ORDER BY updated_at DESC",
    [ownerKey(context)]);
  return rows.map(toRecord);
}

export async function createQRCode(input: CreateQRInput): Promise<QRCodeRecord> {
  validateName(input.name);
  validateText(input.text);
  const ec: QRErrorCorrection = input.errorCorrection ?? "H";
  if (!ERROR_LEVELS.includes(ec)) {
    throw new Error("errorCorrection must be one of L, M, Q, H.");
  }
  const { rows } = await pgPool.query<Row>(
    `INSERT INTO public.qr_codes (id, name, text, error_correction, transparent_bg, linked_short_code, tags, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [newId(), input.name.trim(), input.text, ec, !!input.transparentBg,
      input.linkedShortCode ?? null, input.tags ?? [], ownerKey(input.context)]);
  return toRecord(rows[0]);
}

export async function updateQRCode(
  id: string,
  patch: UpdateQRInput,
  callerOwner: string,
): Promise<QRCodeRecord> {
  const existing = await liveRow(id);
  if (!existing) throw new Error("QR code not found");
  if (existing.created_by !== callerOwner) {
    throw new Error("You can only edit QR codes you created in the active context");
  }
  if (patch.name !== undefined) validateName(patch.name);
  if (patch.text !== undefined) validateText(patch.text);
  if (patch.errorCorrection !== undefined && !ERROR_LEVELS.includes(patch.errorCorrection)) {
    throw new Error("errorCorrection must be one of L, M, Q, H.");
  }
  const { rows } = await pgPool.query<Row>(
    `UPDATE public.qr_codes SET
       name              = coalesce($2, name),
       text              = coalesce($3, text),
       error_correction  = coalesce($4, error_correction),
       transparent_bg    = coalesce($5, transparent_bg),
       linked_short_code = CASE WHEN $6::boolean THEN $7 ELSE linked_short_code END,
       tags              = coalesce($8, tags),
       updated_at        = now()
     WHERE id = $1 AND NOT deleted
     RETURNING *`,
    [id, patch.name?.trim() ?? null, patch.text ?? null, patch.errorCorrection ?? null,
      patch.transparentBg === undefined ? null : !!patch.transparentBg,
      patch.linkedShortCode !== undefined, patch.linkedShortCode ?? null, patch.tags ?? null]);
  if (!rows[0]) throw new Error("QR code not found");
  return toRecord(rows[0]);
}

export async function deleteQRCode(id: string, callerOwner: string): Promise<void> {
  const existing = await liveRow(id);
  if (!existing) throw new Error("QR code not found");
  if (existing.created_by !== callerOwner) {
    throw new Error("You can only delete QR codes you created in the active context");
  }
  await pgPool.query("UPDATE public.qr_codes SET deleted = true, updated_at = now() WHERE id = $1", [id]);
}

export async function getQRCode(id: string): Promise<QRCodeRecord | null> {
  const r = await liveRow(id);
  return r ? toRecord(r) : null;
}

export function ownerKeyOf(context: QRContext): string {
  return ownerKey(context);
}
