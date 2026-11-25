/**
 * Default vertical slot of each edge-drawer tab, alphabetical top → bottom
 * (Gio 2026-11-25: "the 4 drawers are not alphabetically ordered and spaced apart").
 * Slots are evenly spaced around the middle of the screen, never closer than
 * MIN_GAP px, so tall tabs (Front Desk) can't overlap their neighbour.
 * Add a new drawer by inserting its id in alphabetical order.
 */
export const DRAWER_TAB_ORDER = ["frontdesk", "inbox", "legend", "sessions"] as const;
export type DrawerTabId = (typeof DRAWER_TAB_ORDER)[number];

const MIN_GAP = 190;

export function defaultDrawerTabY(id: DrawerTabId, fallback = 400): number {
  if (typeof window === "undefined") return fallback;
  const h = window.innerHeight;
  const n = DRAWER_TAB_ORDER.length;
  const i = DRAWER_TAB_ORDER.indexOf(id);
  const gap = Math.max(h / (n + 1), MIN_GAP);
  const y = h / 2 + (i - (n - 1) / 2) * gap;
  return Math.round(Math.max(40, Math.min(h - 100, y)));
}
