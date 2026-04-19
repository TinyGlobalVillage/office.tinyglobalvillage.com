import fs from "fs";
import path from "path";

const CLEARS_FILE = path.join(process.cwd(), "data", "chat-clears.json");

type ClearsDb = Record<string, Record<string, string>>;

function read(): ClearsDb {
  try {
    if (!fs.existsSync(CLEARS_FILE)) return {};
    return JSON.parse(fs.readFileSync(CLEARS_FILE, "utf8")) as ClearsDb;
  } catch { return {}; }
}

function write(db: ClearsDb) {
  fs.mkdirSync(path.dirname(CLEARS_FILE), { recursive: true });
  fs.writeFileSync(CLEARS_FILE, JSON.stringify(db, null, 2));
}

export function getClearCutoff(username: string, channel: string): string | null {
  const db = read();
  const iso = db[username]?.[channel];
  return iso ?? null;
}

export function setClearCutoff(username: string, channel: string, iso: string) {
  const db = read();
  if (!db[username]) db[username] = {};
  db[username][channel] = iso;
  write(db);
}

export function clearCutoff(username: string, channel: string) {
  const db = read();
  if (db[username] && db[username][channel]) {
    delete db[username][channel];
    if (Object.keys(db[username]).length === 0) delete db[username];
    write(db);
  }
}

export function dmChannelKey(a: string, b: string): string {
  const pair = [a, b].sort().join("_");
  return `dm:${pair}`;
}

export function tgvChannelKey(): string {
  return "tgv";
}

export function groupChannelKey(groupId: string): string {
  return `group:${groupId}`;
}

export function filterByCutoff<T extends { createdAt: string }>(messages: T[], cutoff: string | null): T[] {
  if (!cutoff) return messages;
  return messages.filter((m) => m.createdAt > cutoff);
}
