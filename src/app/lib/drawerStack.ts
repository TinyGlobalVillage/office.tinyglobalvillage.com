"use client";

import { useEffect, useRef, useState } from "react";

// Centralized open-drawer stack. Drawers register themselves via `registerDrawer`
// when their `open` flag flips true and unregister when it flips false. The
// most recently opened drawer is the "top" — ESC and click-outside close only
// the top, leaving the others visually stacked beneath.

type DrawerEntry = {
  id: string;
  close: () => void;
};

let stack: DrawerEntry[] = [];
const CHANGE_EVENT = "tgv-drawer-stack-change";

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(CHANGE_EVENT, { detail: stack.map((e) => e.id) })
  );
}

export function registerDrawer(entry: DrawerEntry) {
  stack = stack.filter((e) => e.id !== entry.id);
  stack.push(entry);
  emitChange();
}

export function unregisterDrawer(id: string) {
  const before = stack.length;
  stack = stack.filter((e) => e.id !== id);
  if (stack.length !== before) emitChange();
}

export function getStack(): string[] {
  return stack.map((e) => e.id);
}

export function getTopId(): string | null {
  return stack.length > 0 ? stack[stack.length - 1].id : null;
}

export function closeTop() {
  const top = stack[stack.length - 1];
  if (top) top.close();
}

// Move an already-registered drawer to the top of the stack. No-op if the
// drawer isn't open or is already on top. Used for click-to-focus.
export function bringToTop(id: string) {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1 || idx === stack.length - 1) return;
  const [entry] = stack.splice(idx, 1);
  stack.push(entry);
  emitChange();
}

// React hook: returns the current stack and whether `id` is on top.
// Re-renders whenever any drawer registers or unregisters.
export function useDrawerStack(id: string) {
  const [snapshot, setSnapshot] = useState<string[]>(() => stack.map((e) => e.id));
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string[]>).detail;
      setSnapshot(detail ?? []);
    };
    window.addEventListener(CHANGE_EVENT, handler);
    setSnapshot(stack.map((e) => e.id));
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);
  const position = snapshot.indexOf(id);
  return {
    position: position === -1 ? -1 : position,
    isTop: position !== -1 && position === snapshot.length - 1,
    isOpen: position !== -1,
    stack: snapshot,
  };
}

// Marker the controller and other drawers use to detect "click was inside a
// drawer surface" (panel, side-tab, resize handle, header buttons, etc.).
export const DRAWER_DATA_ATTR = "data-tgv-drawer";

// Drawers call this once. It (a) listens for the global `tgv-drawer-open`
// event and opens this drawer when its id matches, (b) registers the drawer
// with the stack while it's open. The returned object has the current stack
// position, top flag, and a stable handler to close from any source.
export function useDrawerLifecycle(opts: {
  id: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onClose?: () => void;
}) {
  const { id, open, setOpen, onClose } = opts;

  // Hold onClose in a ref so it doesn't trigger re-registration. Without this,
  // a fresh arrow function on every render would re-register the drawer each
  // render — and the LAST drawer to render would end up on top of the stack
  // regardless of actual open order.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === id) setOpen(true);
    };
    window.addEventListener("tgv-drawer-open", handler);
    return () => window.removeEventListener("tgv-drawer-open", handler);
  }, [id, setOpen]);

  useEffect(() => {
    if (!open) return;
    registerDrawer({
      id,
      close: () => {
        setOpen(false);
        const cb = onCloseRef.current;
        if (cb) cb();
      },
    });
    return () => unregisterDrawer(id);
  }, [id, open, setOpen]);

  return useDrawerStack(id);
}
