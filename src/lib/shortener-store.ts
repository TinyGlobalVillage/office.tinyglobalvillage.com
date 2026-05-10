/**
 * Server-side persistence helpers for the shortener.
 *
 * Reads/writes /srv/refusion-core/data/shortener/shortlinks.json — the same
 * file the tgv-shortener pm2 service reads on each redirect to look up the
 * destination. Write pattern: write to .tmp + rename, so a partially-written
 * JSON is never visible to the resolver mid-update.
 *
 * No DB today. Designed to graduate later — swap this module for a
 * Drizzle-backed impl when TGV-members come online; the API-route shape
 * above doesn't have to change.
 */
import fs from "fs";
import path from "path";

const STORE_PATH =
  process.env.SHORTENER_STORE_PATH ||
  "/srv/refusion-core/data/shortener/shortlinks.json";

export type ShortLinkContext =
  | { kind: "user"; username: string }
  | { kind: "org"; orgId: "tgv-office" };

export type FrameMode = "redirect" | "iframe";

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

export type Store = Record<string, ShortLink>;

const ALIAS_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const RESERVED_CODES = new Set(["health", "robots.txt", "favicon.ico", "api", "_next"]);

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/i/l ambiguity

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

function generateCode(store: Store, length = 7): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let s = "";
    for (let i = 0; i < length; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    if (!store[s] && !RESERVED_CODES.has(s)) return s;
  }
  // Fallback to longer
  return generateCode(store, length + 1);
}

function ownerKey(context: ShortLinkContext): string {
  return context.kind === "user" ? context.username : `org:${context.orgId}`;
}

export function listLinks(context: ShortLinkContext): ShortLink[] {
  const store = readStore();
  const owner = ownerKey(context);
  return Object.values(store)
    .filter((l) => !l.deleted && l.createdBy === owner)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function createLink(input: CreateInput): ShortLink {
  if (!/^https?:\/\//.test(input.destination)) {
    throw new Error("Destination must start with http:// or https://");
  }
  const store = readStore();
  let code = input.code?.trim() || generateCode(store);
  if (!ALIAS_RE.test(code)) {
    throw new Error("Alias must be 1–40 chars (letters, digits, underscore, hyphen)");
  }
  if (RESERVED_CODES.has(code)) {
    throw new Error(`Alias "${code}" is reserved`);
  }
  if (store[code] && !store[code].deleted) {
    throw new Error(`Alias "${code}" is already in use`);
  }

  const now = new Date().toISOString();
  const link: ShortLink = {
    code,
    destination: input.destination,
    createdBy: ownerKey(input.context),
    createdAt: now,
    expiresAt: input.expiresAt ?? null,
    tags: input.tags ?? [],
    clicks: 0,
    lastClickAt: null,
    renamedFrom: [],
    deleted: false,
    frameMode: input.frameMode ?? "redirect",
  };
  store[code] = link;
  writeStore(store);
  return link;
}

export function updateLink(
  code: string,
  patch: UpdateInput,
  callerOwner: string,
): ShortLink {
  const store = readStore();
  const existing = store[code];
  if (!existing || existing.deleted) throw new Error("Link not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only edit links you created in the active context");
  }

  let result = { ...existing };

  if (patch.destination !== undefined) {
    if (!/^https?:\/\//.test(patch.destination)) {
      throw new Error("Destination must start with http:// or https://");
    }
    result.destination = patch.destination;
  }
  if (patch.expiresAt !== undefined) result.expiresAt = patch.expiresAt;
  if (patch.tags !== undefined) result.tags = patch.tags;
  if (patch.frameMode !== undefined) {
    if (patch.frameMode !== "redirect" && patch.frameMode !== "iframe") {
      throw new Error("frameMode must be 'redirect' or 'iframe'");
    }
    result.frameMode = patch.frameMode;
  }

  if (patch.code !== undefined && patch.code !== code) {
    if (!ALIAS_RE.test(patch.code)) {
      throw new Error("New alias must be 1–40 chars (letters, digits, underscore, hyphen)");
    }
    if (RESERVED_CODES.has(patch.code)) {
      throw new Error(`Alias "${patch.code}" is reserved`);
    }
    if (store[patch.code] && !store[patch.code].deleted) {
      throw new Error(`Alias "${patch.code}" is already in use`);
    }
    // Rename: move entry, leave a tombstone-redirect-by-soft-pointer so old
    // code 404s? Per scope: we move + record the prior code in renamedFrom.
    result = { ...result, code: patch.code, renamedFrom: [code, ...existing.renamedFrom] };
    delete store[code];
    store[patch.code] = result;
  } else {
    store[code] = result;
  }

  writeStore(store);
  return result;
}

export function deleteLink(code: string, callerOwner: string): void {
  const store = readStore();
  const existing = store[code];
  if (!existing || existing.deleted) throw new Error("Link not found");
  if (existing.createdBy !== callerOwner) {
    throw new Error("You can only delete links you created in the active context");
  }
  // Soft-delete: keeps the row so click history isn't lost; resolver returns 404.
  store[code] = { ...existing, deleted: true };
  writeStore(store);
}

export function getLink(code: string): ShortLink | null {
  const store = readStore();
  const l = store[code];
  return l && !l.deleted ? l : null;
}

export function ownerKeyOf(context: ShortLinkContext): string {
  return ownerKey(context);
}
