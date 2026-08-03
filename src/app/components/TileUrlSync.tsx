"use client";

/**
 * Makes `?tile=` mean something on arrival, and stop meaning it on close.
 *
 * dispatchTileAction writes the URL when someone opens a tile; this is the
 * other half — the part that makes a link somebody was sent actually land. It
 * is mounted in ClientShell rather than on the dashboard because event and
 * drawer tiles are hosted globally: /dashboard/utils?tile=Sandbox&view=atoms
 * has to open the Sandbox on the Atom Library from whatever page you were on,
 * the same way the TgvNav Menu does.
 *
 * PAGE tiles are not handled here — the dashboard owns those, because their
 * modal is a dashboard component and it already reads the same two params.
 *
 * Closing: modals report it themselves (GlobalModals calls clearTileUrl), and
 * drawers are noticed leaving the drawer stack, which is the only close signal
 * they have — they have no close event, and adding one to eight drawers to
 * learn something the stack already knows would be the worse trade.
 */

import { useEffect, useRef } from "react";
import { OFFICE_TILES, dispatchTileAction } from "./dashboardTiles";
import { clearTileUrl, currentTile } from "@/app/lib/tileUrl";
import { DRAWER_STACK_EVENT, closeDrawerById, getStack } from "@/app/lib/drawerStack";

function defForParam(value: string | null) {
  if (!value) return null;
  return (
    OFFICE_TILES.find((t) => "page" in t.action && t.action.page === value) ??
    OFFICE_TILES.find((t) => t.key.toLowerCase() === value.toLowerCase()) ??
    null
  );
}

export default function TileUrlSync() {
  // What we last acted on. Without it, every popstate — including the one our
  // own close pushes — would re-open the tile the user just dismissed.
  const acted = useRef<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const { tile, view } = currentTile();
      const signature = tile ? `${tile}|${view ?? ""}` : null;
      if (signature === acted.current) return;
      acted.current = signature;

      // Back out of a tile and the drawer it named has to go with it, or the
      // URL says "dashboard" while a drawer is still sitting over the page.
      // Modals do their own half of this in GlobalModals, where their state is.
      const openDrawers = getStack();
      for (const id of openDrawers) {
        const def = OFFICE_TILES.find((t) => "drawer" in t.action && t.action.drawer === id);
        const stillNamed = def && tile && def.key.toLowerCase() === tile.toLowerCase();
        if (!stillNamed) closeDrawerById(id);
      }

      if (!tile) return;

      const def = defForParam(tile);
      // Page tiles: the dashboard opens those. An unknown key: ignore it rather
      // than guess — a stale link should land on the page, not on the wrong room.
      if (!def || "page" in def.action) return;

      dispatchTileAction(def.action, view ?? undefined, { url: false });
    };

    // Deferred by a tick, not called inline: the arrival dispatch is a window
    // event, and the components that listen for it (GlobalModals, the drawers)
    // register in their own mount effects. Firing during ours would land before
    // some of them are listening, and the link would silently do nothing —
    // which is exactly what a UAT caught on /dashboard/utils?tile=Sandbox.
    const first = setTimeout(sync, 0);
    window.addEventListener("popstate", sync);
    return () => {
      clearTimeout(first);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  // A drawer that has left the stack is closed. If the URL still describes it,
  // it is describing something that is no longer on screen.
  useEffect(() => {
    const onStack = (e: Event) => {
      const open = (e as CustomEvent<string[]>).detail ?? [];
      const { tile } = currentTile();
      const def = defForParam(tile);
      if (!def || !("drawer" in def.action)) return;
      if (!open.includes(def.action.drawer)) {
        clearTileUrl(def.key);
        acted.current = null;
      }
    };
    window.addEventListener(DRAWER_STACK_EVENT, onStack);
    return () => window.removeEventListener(DRAWER_STACK_EVENT, onStack);
  }, []);

  return null;
}
