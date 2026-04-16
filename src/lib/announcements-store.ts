import fs from "fs";
import path from "path";

const STORE_PATH = "/srv/refusion-core/logs/tgv-office/announcements.json";

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

export type Announcement = {
  id: string;
  created_at: string;
  title: string;
  type: "dep-update";
  status: "pending" | "dismissed";
  dismissed_by?: string;
  dismissed_at?: string;
  data: {
    projects: ProjectUpdates[];
    total_updates: number;
  };
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
