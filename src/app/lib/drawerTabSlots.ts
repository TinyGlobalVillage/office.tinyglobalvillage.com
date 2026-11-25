/**
 * Default vertical slot of each edge-drawer tab (Gio 2026-11-25: "the 4 drawers
 * are not alphabetically ordered and spaced apart").
 * Each edge holds its own alphabetical stack, top → bottom, evenly spaced around
 * the middle of the screen and never closer than MIN_GAP px, so tall tabs
 * (Front Desk) can't overlap their neighbour. Legend stays on the right edge.
 * Add a new drawer by inserting its id, alphabetically, in its edge's list.
 */
export const DRAWER_TAB_EDGES = {
  left: ["chat", "frontdesk", "inbox", "sessions"],
  right: ["legend"],
} as const;
export type DrawerTabId = (typeof DRAWER_TAB_EDGES)[keyof typeof DRAWER_TAB_EDGES][number];

const MIN_GAP = 190;
const TOP = 40;
const BOTTOM = 180;

export function defaultDrawerTabY(id: DrawerTabId, fallback = 400): number {
  if (typeof window === "undefined") return fallback;
  const h = window.innerHeight;
  const stack: readonly string[] = (DRAWER_TAB_EDGES.left as readonly string[]).includes(id)
    ? DRAWER_TAB_EDGES.left
    : DRAWER_TAB_EDGES.right;
  const n = stack.length;
  const i = stack.indexOf(id);
  // Tabs live between TOP and h − BOTTOM (BOTTOM clears a tab's own height plus the desktop app's
  // Home pill, fixed 20px off the bottom-left). MIN_GAP apart, but never wider than that band
  // allows — on a short window (desktop min 640px) clamping each tab alone piled them up.
  const lo = TOP, hi = h - BOTTOM;
  const gap = n > 1 ? Math.max(0, Math.min(Math.max(h / (n + 1), MIN_GAP), (hi - lo) / (n - 1))) : 0;
  const first = Math.max(lo, Math.min(h / 2 - ((n - 1) / 2) * gap, hi - (n - 1) * gap));
  return Math.round(first + i * gap);
}
