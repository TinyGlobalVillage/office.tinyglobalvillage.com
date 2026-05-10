"use client";

import { useEffect } from "react";
import { closeTop, getTopId, bringToTop, DRAWER_DATA_ATTR } from "../lib/drawerStack";

// Mounted once at the app shell. Owns ESC + outside-click semantics for the
// drawer stack: ESC closes the topmost drawer; a click whose target is not
// inside any drawer surface closes the topmost drawer. Drawers stay open
// underneath until the user closes them one by one.

export default function DrawerStackController() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!getTopId()) return;
      // Don't fight modals — they still own ESC when one is open. Modals set
      // a `data-modal-open` flag on body via useModalLifecycle's ref count.
      if (document.body.dataset.modalOpen === "1") return;
      closeTop();
    };

    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Ignore clicks inside modals — they own their own focus.
      if (target.closest("[data-tgv-modal]")) return;

      const drawerEl = target.closest(`[${DRAWER_DATA_ATTR}]`) as HTMLElement | null;
      if (drawerEl) {
        // Click-to-focus: any click inside an open drawer's surface brings
        // that drawer to the top of the stack. No-op if it's already on top.
        const id = drawerEl.getAttribute(DRAWER_DATA_ATTR);
        if (id) bringToTop(id);
        return;
      }

      // Click landed outside every drawer — close the top.
      if (!getTopId()) return;
      closeTop();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown, true);
    };
  }, []);

  return null;
}
