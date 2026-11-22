"use client";
/**
 * A dashboard page's own pane in the URL (Gio 2026-11-22: every surface shareable by link).
 *
 * Standalone (/dashboard/database?view=…) the page's own ?view= is the link. Embedded in the
 * dashboard's page-modal (DashboardPageModal → iframe) the page also tells the parent with a
 * `tgv-view-change` message, so the address bar the operator actually sees (?tile=<page>&view=…)
 * follows along — the same contract ModulesClient already uses.
 */
import { useCallback } from "react";

/** The ?view= the page was opened with (arrival), or null. */
export function initialPageView(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("view");
}

/** Publish the page's current pane: replaceState the own URL + tell an embedding dashboard. */
export function usePublishPageView(): (view: string | null) => void {
  return useCallback((view: string | null) => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (view) url.searchParams.set("view", view);
      else url.searchParams.delete("view");
      window.history.replaceState({}, "", url);
    } catch {
      /* best-effort */
    }
    if (window.parent !== window) {
      window.parent.postMessage({ type: "tgv-view-change", view }, window.location.origin);
    }
  }, []);
}
