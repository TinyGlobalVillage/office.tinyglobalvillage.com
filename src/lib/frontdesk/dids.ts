import type { Did, DidAssignment } from "./types";
import { readJson, writeJson, shortId, toE164 } from "./store";

const FILE = "dids.json";

type Db = { dids: Did[] };

function read(): Db {
  return readJson<Db>(FILE, { dids: [] });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

export function listDids(): Did[] {
  return read().dids.filter(d => !d.releasedAt);
}

export function getDid(id: string): Did | null {
  return read().dids.find(d => d.id === id) ?? null;
}

export function getDidByE164(e164: string): Did | null {
  return read().dids.find(d => d.e164 === e164) ?? null;
}

/**
 * Returns the DID that should handle an inbound call to `e164`. Falls back to
 * the first unassigned / frontdesk-assigned DID if no exact match is found.
 */
export function resolveInboundDid(e164: string): Did | null {
  const db = read();
  const direct = db.dids.find(d => d.e164 === e164 && !d.releasedAt);
  if (direct) return direct;
  return db.dids.find(d => d.assignment.kind === "frontdesk" && !d.releasedAt) ?? null;
}

export function createDid(params: {
  e164: string;
  label: string;
  assignment?: DidAssignment;
  telnyxId?: string | null;
  createdBy: string;
}): Did {
  const normalized = toE164(params.e164);
  if (!normalized) {
    throw new Error(`Invalid E.164 number: ${params.e164}`);
  }
  const db = read();
  if (db.dids.some(d => d.e164 === normalized && !d.releasedAt)) {
    throw new Error(`DID ${normalized} is already registered`);
  }
  const did: Did = {
    id: shortId("did"),
    e164: normalized,
    label: params.label.trim().slice(0, 60) || normalized,
    assignment: params.assignment ?? { kind: "frontdesk" },
    telnyxId: params.telnyxId ?? null,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    releasedAt: null,
  };
  db.dids.push(did);
  write(db);
  return did;
}

export function updateDidAssignment(id: string, assignment: DidAssignment): Did | null {
  const db = read();
  const did = db.dids.find(d => d.id === id);
  if (!did || did.releasedAt) return null;
  did.assignment = assignment;
  write(db);
  return did;
}

export function renameDid(id: string, label: string): Did | null {
  const db = read();
  const did = db.dids.find(d => d.id === id);
  if (!did || did.releasedAt) return null;
  did.label = label.trim().slice(0, 60) || did.e164;
  write(db);
  return did;
}

export function releaseDid(id: string): Did | null {
  const db = read();
  const did = db.dids.find(d => d.id === id);
  if (!did || did.releasedAt) return null;
  did.releasedAt = new Date().toISOString();
  did.assignment = { kind: "unassigned" };
  write(db);
  return did;
}
