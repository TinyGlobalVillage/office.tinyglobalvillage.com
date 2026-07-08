"use client";

// GlobalEscClose — an app-root Escape safety net for modals.
//
// Office modals close on Escape via two mechanisms: (1) the shared window-based useEscapeToClose
// stack (focus-INDEPENDENT — the good one), and (2) on some modals a focus-DEPENDENT onKeyDown on
// the modal container. Mechanism (2) silently fails when focus isn't inside the modal — which is
// exactly what happens right after you close another modal (focus falls back to <body>), or after a
// click lands on a bare element. Result: Escape does nothing and the modal feels "stuck" (Gio, 2026-07-07).
//
// This net closes THAT gap without changing any working behavior. On Escape it stands down if:
//   • something already handled the key (e.defaultPrevented) — e.g. a nested dropdown/menu closing, or
//   • a hook-based modal is on the shared stack (window.__tgvEscapeStack) — it will close its own layer.
// Otherwise, if a modal is visibly open, it closes the TOPMOST one by clicking its shared ModalBackdrop
// (every backdrop closes on a backdrop click). Focus-independent, last-resort only — so nested
// dropdowns and hook modals still win, and non-modal Escape usage is untouched.
import { useEffect } from "react";

export default function GlobalEscClose() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const stack = (window as unknown as { __tgvEscapeStack?: unknown[] }).__tgvEscapeStack;
      if (stack && stack.length > 0) return; // a hook-based modal will handle its own layer

      const backdrops = Array.from(
        document.querySelectorAll<HTMLElement>("[data-modal-backdrop]"),
      ).filter((el) => {
        const s = getComputedStyle(el);
        return s.display !== "none" && s.visibility !== "hidden" && el.getBoundingClientRect().width > 0;
      });
      if (backdrops.length === 0) return;

      // Topmost = highest z-index, tie-break by DOM order (later wins).
      let top = backdrops[0];
      let topZ = -Infinity;
      for (const el of backdrops) {
        const z = parseInt(getComputedStyle(el).zIndex, 10);
        const zi = Number.isNaN(z) ? 0 : z;
        if (zi >= topZ) {
          topZ = zi;
          top = el;
        }
      }
      e.preventDefault();
      top.click(); // shared ModalBackdrop closes on a backdrop click (onClick={onClose})
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
