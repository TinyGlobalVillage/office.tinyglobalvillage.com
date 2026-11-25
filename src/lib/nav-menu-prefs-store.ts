import fs from "fs";
import path from "path";

/**
 * Per-user balloon-menu link picks (Gio 2026-11-25: "a gear icon … that allows
 * staff user to be able to pick the links on the menu"). Stores the links a user
 * HID, so a tool added to the tile registry later shows up for everyone by default.
 */
const STORE_PATH = process.env.NAV_MENU_PREFS_STORE_PATH || "/srv/refusion-core/logs/tgv-office/nav-menu-prefs.json";

type Store = Record<string, { hidden: string[]; updatedAt: string }>;

function read(): Store {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Store; } catch { return {}; }
}

export function getHiddenMenuLinks(username: string): string[] {
  return read()[username]?.hidden ?? [];
}

export function setHiddenMenuLinks(username: string, hidden: string[]): string[] {
  const clean = Array.from(new Set(hidden.filter((k) => typeof k === "string" && k.length > 0 && k.length < 80))).slice(0, 200);
  const store = read();
  store[username] = { hidden: clean, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  const tmp = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_PATH);
  return clean;
}
