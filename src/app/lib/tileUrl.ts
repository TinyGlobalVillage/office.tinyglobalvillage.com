"use client";

/**
 * The address bar as a description of what you are looking at.
 *
 * Office's tiles open modals and drawers over whatever page you are on, so
 * without this the URL says "/dashboard" whether you are staring at the
 * dashboard, the Sandbox's Atom Library, or the Front Desk — and there is
 * nothing to send anyone (Gio 2026-08-03: "every tile and its selection should
 * have a hyperlink associated with it, so i can share links to specific places
 * with staff when needed").
 *
 *   ?tile=<key>   which tile is open  — a page key ("processes") for the links
 *                 already in circulation, or a registry key ("Sandbox")
 *   ?view=<sub>   which surface inside it (Sandbox → "atoms")
 *
 * Deliberately window.history rather than next/navigation: router.push would
 * re-run a server component just to record that a modal opened, and
 * useSearchParams would force every page that reads this under a Suspense
 * boundary. Opening is a pushState so Back closes it; moving around INSIDE one
 * tile is a replaceState, so clicking through a modal's tabs doesn't bury the
 * page under twenty history entries.
 */

export const TILE_PARAM = "tile";
export const VIEW_PARAM = "view";

/** The URL for a tile+view, preserving every other query param on the page. */
export function tileUrlFor(tile: string | null, view?: string | null): string {
  const params = new URLSearchParams(window.location.search);
  params.delete(TILE_PARAM);
  params.delete(VIEW_PARAM);
  if (tile) {
    params.set(TILE_PARAM, tile);
    if (view) params.set(VIEW_PARAM, view);
  }
  const qs = params.toString();
  return `${window.location.pathname}${qs ? `?${qs}` : ""}`;
}

/** What the current URL says is open. */
export function currentTile(): { tile: string | null; view: string | null } {
  if (typeof window === "undefined") return { tile: null, view: null };
  const params = new URLSearchParams(window.location.search);
  return { tile: params.get(TILE_PARAM), view: params.get(VIEW_PARAM) };
}

/** Opening is a navigation. */
export function pushTileUrl(tile: string, view?: string | null): void {
  if (typeof window === "undefined") return;
  const next = tileUrlFor(tile, view);
  if (next === `${window.location.pathname}${window.location.search}`) return;
  window.history.pushState({}, "", next);
}

/** Changing surface inside an open tile is not. */
export function replaceTileUrl(tile: string, view?: string | null): void {
  if (typeof window === "undefined") return;
  window.history.replaceState({}, "", tileUrlFor(tile, view));
}

/**
 * Drop ?tile/?view when the thing closes.
 *
 * `only` guards the case that actually happens: two surfaces open, you close
 * the one the URL is NOT describing. Clearing then would wipe a link that still
 * points at something on screen.
 */
export function clearTileUrl(only?: string): void {
  if (typeof window === "undefined") return;
  const { tile } = currentTile();
  if (!tile) return;
  if (only && tile.toLowerCase() !== only.toLowerCase()) return;
  window.history.pushState({}, "", tileUrlFor(null));
}
