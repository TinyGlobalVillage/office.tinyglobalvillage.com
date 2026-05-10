/**
 * Server-side persistence for saved QR-code configurations.
 *
 * Why "configuration" not "image" — a QR code is deterministic from its
 * input + settings, so we never store the rendered PNG/SVG bytes. We store
 * the text + render settings + a user-chosen name, and the modal regenerates
 * the image client-side every time. This keeps storage tiny and avoids
 * stale-image problems (rename a TinyURL → its QR keeps working because the
 * config encodes the short URL, not the destination).
 *
 * Storage: /srv/refusion-core/data/qrcodes/qrcodes.json — sibling of the
 * shortener's data dir. Same atomic .tmp + rename pattern.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const STORE_PATH =
  process.env.QRCODES_STORE_PATH ||
  "/srv/refusion-core/data/qrcodes/qrcodes.json";

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

export type Store = Record<string, QRCodeRecord>;

const ERROR_LEVELS: ReadonlyArray<QRErrorCorrection> = ["L", "M", "Q", "H"];

function readStore(): Store {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  const tmp = STORE_PATH + ".tmp";
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, STORE_PATH);
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

export function listQRCodes(context: QRContext): QRCodeRecord[] {
  const store = readStore();
  const owner = ownerKey(context);
  return Object.values(store)
    .filter((r) => !r.deleted && r.createdBy === owner)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function createQRCode(input: CreateQRInput): QRCodeRecord {
  validateName(input.name);
  validateText(input.text);
  const ec: QRErrorCorrection = input.errorCorrection ?? "H";
  if (!ERROR_LEVELS.includes(ec)) {
    throw new Error("errorCorrection must be one of L, M, Q, H.");
  }
  const store = readStore();
  const now = new Date().toISOString();
  const record: QRCodeRecord = {
    id: newId(),
    name: input.name.trim(),
    text: input.text,
    errorCorrection: ec,
    transparentBg: !!input.transparentBg,
    linkedShortCode: input.linkedShortCode ?? null,
    tags: input.tags ?? [],
    createdBy: ownerKey(input.context),
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  store[record.id] = record;
  writeStore(store);
  return record;
}

export function updateQRCode(
  id: string,
  patch: UpdateQRInput,
  callerOwner: string,
): QRCodeRecord {
  const store = readStore();
  const existing = store[id];
  if (!existing || existing.deleted) throw new Error("QR code not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only edit QR codes you created in the active context");
  }
  const next = { ...existing };
  if (patch.name !== undefined) {
    validateName(patch.name);
    next.name = patch.name.trim();
  }
  if (patch.text !== undefined) {
    validateText(patch.text);
    next.text = patch.text;
  }
  if (patch.errorCorrection !== undefined) {
    if (!ERROR_LEVELS.includes(patch.errorCorrection)) {
      throw new Error("errorCorrection must be one of L, M, Q, H.");
    }
    next.errorCorrection = patch.errorCorrection;
  }
  if (patch.transparentBg !== undefined) next.transparentBg = !!patch.transparentBg;
  if (patch.linkedShortCode !== undefined) next.linkedShortCode = patch.linkedShortCode;
  if (patch.tags !== undefined) next.tags = patch.tags;
  next.updatedAt = new Date().toISOString();
  store[id] = next;
  writeStore(store);
  return next;
}

export function deleteQRCode(id: string, callerOwner: string): void {
  const store = readStore();
  const existing = store[id];
  if (!existing || existing.deleted) throw new Error("QR code not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only delete QR codes you created in the active context");
  }
  store[id] = { ...existing, deleted: true, updatedAt: new Date().toISOString() };
  writeStore(store);
}

export function getQRCode(id: string): QRCodeRecord | null {
  const store = readStore();
  const r = store[id];
  return r && !r.deleted ? r : null;
}

export function ownerKeyOf(context: QRContext): string {
  return ownerKey(context);
}
