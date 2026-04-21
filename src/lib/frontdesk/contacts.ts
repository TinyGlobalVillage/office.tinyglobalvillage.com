import type { Contact, ContactKind } from "./types";
import { readJson, writeJson, shortId, toE164 } from "./store";

const FILE = "contacts.json";

type Db = { contacts: Contact[] };

function read(): Db {
  return readJson<Db>(FILE, { contacts: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

export function listContacts(filter?: { kind?: ContactKind; search?: string }): Contact[] {
  let rows = read().contacts;
  if (filter?.kind) rows = rows.filter(c => c.kind === filter.kind);
  if (filter?.search) {
    const q = filter.search.trim().toLowerCase();
    rows = rows.filter(c =>
      c.name.toLowerCase().includes(q) ||
      (c.company ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q),
    );
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export function getContact(id: string): Contact | null {
  return read().contacts.find(c => c.id === id) ?? null;
}

export function findContactByPhone(e164: string): Contact | null {
  return read().contacts.find(c => c.phone === e164) ?? null;
}

export function createContact(params: {
  kind: ContactKind;
  name: string;
  phone?: string | null;
  email?: string | null;
  company?: string | null;
  notes?: string;
  createdBy: string;
}): Contact {
  const now = new Date().toISOString();
  const phone = params.phone ? toE164(params.phone) : null;
  const contact: Contact = {
    id: shortId("ct"),
    kind: params.kind,
    name: params.name.trim().slice(0, 120),
    phone,
    email: params.email?.trim() || null,
    company: params.company?.trim() || null,
    notes: params.notes?.slice(0, 4000) ?? "",
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    lastContactAt: null,
  };
  const db = read();
  db.contacts.push(contact);
  write(db);
  return contact;
}

export function updateContact(id: string, patch: Partial<Omit<Contact, "id" | "createdAt" | "createdBy">>): Contact | null {
  const db = read();
  const contact = db.contacts.find(c => c.id === id);
  if (!contact) return null;
  if (patch.name !== undefined) contact.name = patch.name.trim().slice(0, 120);
  if (patch.kind !== undefined) contact.kind = patch.kind;
  if (patch.phone !== undefined) contact.phone = patch.phone ? toE164(patch.phone) : null;
  if (patch.email !== undefined) contact.email = patch.email?.trim() || null;
  if (patch.company !== undefined) contact.company = patch.company?.trim() || null;
  if (patch.notes !== undefined) contact.notes = (patch.notes ?? "").slice(0, 4000);
  if (patch.lastContactAt !== undefined) contact.lastContactAt = patch.lastContactAt;
  contact.updatedAt = new Date().toISOString();
  write(db);
  return contact;
}

export function deleteContact(id: string): boolean {
  const db = read();
  const before = db.contacts.length;
  db.contacts = db.contacts.filter(c => c.id !== id);
  const mutated = db.contacts.length !== before;
  if (mutated) write(db);
  return mutated;
}

/**
 * Touch the `lastContactAt` marker — call/sms flows call this after a
 * successful interaction so the Contacts list sorts by recency naturally.
 */
export function touchLastContact(id: string): void {
  const db = read();
  const contact = db.contacts.find(c => c.id === id);
  if (!contact) return;
  contact.lastContactAt = new Date().toISOString();
  write(db);
}

/**
 * Auto-create a stub contact for an unknown inbound caller/texter. Safe to
 * call repeatedly — no-ops when an entry with the same phone already exists.
 */
export function ensureContactStub(e164: string, source: "sms" | "call"): Contact {
  const existing = findContactByPhone(e164);
  if (existing) return existing;
  return createContact({
    kind: "client",
    name: e164,
    phone: e164,
    notes: `Auto-created from inbound ${source}.`,
    createdBy: "system",
  });
}
