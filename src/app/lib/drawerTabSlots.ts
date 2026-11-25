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

export function defaultDrawerTabY(id: DrawerTabId, fallback = 400): number {
  if (typeof window === "undefined") return fallback;
  const h = window.innerHeight;
  const stack: readonly string[] = (DRAWER_TAB_EDGES.left as readonly string[]).includes(id)
    ? DRAWER_TAB_EDGES.left
    : DRAWER_TAB_EDGES.right;
  const n = stack.length;
  const i = stack.indexOf(id);
  const gap = Math.max(h / (n + 1), MIN_GAP);
  const y = h / 2 + (i - (n - 1) / 2) * gap;
  return Math.round(Math.max(40, Math.min(h - 100, y)));
}
