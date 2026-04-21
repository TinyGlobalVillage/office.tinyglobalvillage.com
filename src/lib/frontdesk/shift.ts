import type { ShiftAssignment } from "./types";
import { readJson, writeJson } from "./store";

const FILE = "shift.json";

type Db = { assignment: ShiftAssignment };

const DEFAULT: ShiftAssignment = {
  username: null,
  updatedBy: "system",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

function read(): Db {
  return readJson<Db>(FILE, { assignment: DEFAULT });
}

function write(db: Db): void {
  writeJson(FILE, db);
}

export function getShift(): ShiftAssignment {
  return read().assignment;
}

export function setShift(username: string | null, actor: string): ShiftAssignment {
  const next: ShiftAssignment = {
    username: username?.trim() || null,
    updatedBy: actor,
    updatedAt: new Date().toISOString(),
  };
  write({ assignment: next });
  return next;
}
