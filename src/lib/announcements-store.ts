import fs from "fs";
import path from "path";

// Overridable so a workshop dev server never writes the live board (lane .env.local sets it).
const STORE_PATH = process.env.ANNOUNCEMENTS_STORE_PATH || "/srv/refusion-core/logs/tgv-office/announcements.json";
/** Every stack-update version ever announced — so each one is announced once. */
const STACK_SEEN_PATH = path.join(path.dirname(STORE_PATH), "stack-updates-seen.json");

export type DepUpdate = {
  package: string;
  current: string;
  latest: string;
  type: "major" | "minor" | "patch" | "unknown";
};

export type ProjectUpdates = {
  name: string;
  dir: string;
  updates: DepUpdate[];
};

// Per-type payload shapes. dep-update is the original automation;
// recordings-storage is the Front Desk recordings storage-threshold alert
// (telephony-security Item 3 / C2, 2026-05-01).
export type DepUpdatePayload = {
  projects: ProjectUpdates[];
  total_updates: number;
};

export type RecordingsStoragePayload = {
  sizeBytes: number;
  sizeGB: number;        // rounded to 2 decimals
  thresholdGB: number;   // which integer-GB threshold triggered this alert
  recordingCount: number;
  recordingsDir: string;
};

/** One available upgrade, from utils/scripts/stack-updates (Gio 2026-11-23: "alert us whenever there
 *  are updates to our packages that can improve our current RCS stack"). Never auto-applied. */
export type StackUpdateClass = "security" | "perf" | "feature" | "major";
export type StackUpdateItem = {
  /** `${name}@${latest}` — the dedupe key. */
  key: string;
  name: string;
  /** npm = an app dependency; server = an RCS service (LiveKit, FreeSWITCH, Postgres…). */
  kind: "npm" | "server";
  current: string;
  latest: string;
  class: StackUpdateClass;
  /** One line: why it matters (advisory title or the release note's own words). */
  why: string;
  url?: string;
};
export type StackUpdatePayload = { items: StackUpdateItem[] };

export type Announcement = {
  id: string;
  created_at: string;
  title: string;
  type: "dep-update" | "recordings-storage" | "sip-attack" | "stack-update";
  status: "pending" | "dismissed";
  dismissed_by?: string;
  dismissed_at?: string;
  // Untyped on the wire — narrow on `type` at the read-site (panel + email
  // fan-out branch on type before reaching for projects/sizeGB/etc.).
  data: DepUpdatePayload | RecordingsStoragePayload | Record<string, unknown>;
};

function readAll(): Announcement[] {
  try {
    if (!fs.existsSync(STORE_PATH)) return [];
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as Announcement[];
  } catch {
    return [];
  }
}

function writeAll(items: Announcement[]): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(items, null, 2), "utf-8");
}

function readSeen(): Set<string> {
  try {
    return new Set(JSON.parse(fs.readFileSync(STACK_SEEN_PATH, "utf-8")) as string[]);
  } catch {
    return new Set();
  }
}

/** The items not announced before, marked as announced now. Keeps the newest 5000 keys. */
export function takeUnseenStackUpdates(items: StackUpdateItem[]): StackUpdateItem[] {
  const seen = readSeen();
  const fresh = items.filter((i) => i && typeof i.key === "string" && !seen.has(i.key));
  if (fresh.length) {
    const all = [...seen, ...fresh.map((i) => i.key)].slice(-5000);
    fs.mkdirSync(path.dirname(STACK_SEEN_PATH), { recursive: true });
    fs.writeFileSync(STACK_SEEN_PATH, JSON.stringify(all), "utf-8");
  }
  return fresh;
}

export function getAllAnnouncements(): Announcement[] {
  return readAll();
}

export function getPendingAnnouncements(): Announcement[] {
  return readAll().filter((a) => a.status === "pending");
}

export function addAnnouncement(
  a: Omit<Announcement, "id" | "created_at">
): Announcement {
  const items = readAll();
  const id = crypto.randomUUID();
  const created_at = new Date().toISOString();
  const full: Announcement = { id, created_at, ...a };
  items.unshift(full);
  writeAll(items.slice(0, 100)); // keep last 100
  return full;
}

export function dismissAnnouncement(
  id: string,
  dismissedBy: string
): boolean {
  const items = readAll();
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  items[idx].status = "dismissed";
  items[idx].dismissed_by = dismissedBy;
  items[idx].dismissed_at = new Date().toISOString();
  writeAll(items);
  return true;
}
