/**
 * Web presence store.
 * In-memory map for live "online" detection, backed by a JSON file for
 * persistent "last seen" that survives app restarts.
 * Uses globalThis so the in-memory map survives Next.js hot reloads.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

const WEB_TIMEOUT_MS = 60_000; // mark offline after 60s without a ping
const PERSIST_PATH = "/srv/refusion-core/logs/tgv-office/web-presence.json";

declare global {
  // eslint-disable-next-line no-var
  var __tgvWebPresence: Map<string, number> | undefined;
}

// ── Persistent file ──────────────────────────────────────────────────────────

function loadPersisted(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(PERSIST_PATH, "utf8"));
  } catch {
    return {};
  }
}

function persist(data: Record<string, number>) {
  try {
    mkdirSync(path.dirname(PERSIST_PATH), { recursive: true });
    writeFileSync(PERSIST_PATH, JSON.stringify(data), "utf8");
  } catch { /* best-effort */ }
}

// ── In-memory map (hot-reload safe) ─────────────────────────────────────────

function getStore(): Map<string, number> {
  if (!globalThis.__tgvWebPresence) {
    // Seed from persisted file on first load
    const saved = loadPersisted();
    globalThis.__tgvWebPresence = new Map(Object.entries(saved));
  }
  return globalThis.__tgvWebPresence;
}

// ── Public API ───────────────────────────────────────────────────────────────

export function recordHeartbeat(username: string): void {
  const store = getStore();
  const now = Date.now();
  store.set(username, now);
  // Persist the updated map so last-seen survives restarts
  persist(Object.fromEntries(store));
}

export function isWebOnline(username: string): boolean {
  const last = getStore().get(username);
  if (!last) return false;
  return Date.now() - last < WEB_TIMEOUT_MS;
}

/** Returns epoch ms of last web ping, or null if never seen */
export function lastWebSeen(username: string): number | null {
  return getStore().get(username) ?? null;
}
