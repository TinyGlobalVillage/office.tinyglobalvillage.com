"use client";

import { useEffect, useState } from "react";

// ── Modal ref-count ─────────────────────────────────────────────────
// Any modal mounted on the page increments this counter; drawer knobs
// hide whenever the counter is > 0.

let modalCount = 0;
const MODAL_EVENT = "tgv-modal-count";

export function pushModal() {
  modalCount++;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: modalCount }));
  }
}

export function popModal() {
  modalCount = Math.max(0, modalCount - 1);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MODAL_EVENT, { detail: modalCount }));
  }
}

// Call this once at the top of any modal component.
export function useModalLifecycle() {
  useEffect(() => {
    pushModal();
    return () => popModal();
  }, []);
}

// ── Auto-hide preference (Interface Controls) ───────────────────────

const AUTOHIDE_KEY = "tgv-drawer-knobs-autohide";
const AUTOHIDE_EVENT = "tgv-drawer-autohide-changed";

export function getAutoHide(): boolean {
  if (typeof window === "undefined") return false;
  try { return localStorage.getItem(AUTOHIDE_KEY) === "1"; } catch { return false; }
}

export function setAutoHide(v: boolean) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(AUTOHIDE_KEY, v ? "1" : "0"); } catch {}
  window.dispatchEvent(new CustomEvent(AUTOHIDE_EVENT, { detail: v }));
}

// ── Composite hook: drawers call this ───────────────────────────────

export function useKnobVisibility() {
  const [modalOpen, setModalOpen] = useState(false);
  useEffect(() => {
    setModalOpen(modalCount > 0);
    const h = (e: Event) => setModalOpen(((e as CustomEvent<number>).detail ?? 0) > 0);
    window.addEventListener(MODAL_EVENT, h);
    return () => window.removeEventListener(MODAL_EVENT, h);
  }, []);

  const [autoHide, setAH] = useState(false);
  useEffect(() => {
    setAH(getAutoHide());
    const h = (e: Event) => setAH(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(AUTOHIDE_EVENT, h);
    return () => window.removeEventListener(AUTOHIDE_EVENT, h);
  }, []);

  const [autoHidden, setAutoHidden] = useState(false);
  useEffect(() => {
    if (!autoHide) { setAutoHidden(false); return; }
    setAutoHidden(true);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const reveal = () => {
      setAutoHidden(false);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setAutoHidden(true), 3000);
    };
    window.addEventListener("mousemove", reveal, { passive: true });
    window.addEventListener("scroll", reveal, { passive: true });
    window.addEventListener("keydown", reveal);
    window.addEventListener("touchstart", reveal, { passive: true });
    return () => {
      window.removeEventListener("mousemove", reveal);
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("keydown", reveal);
      window.removeEventListener("touchstart", reveal);
      if (timer) clearTimeout(timer);
    };
  }, [autoHide]);

  return { modalOpen, autoHidden, hideKnob: modalOpen || autoHidden };
}
