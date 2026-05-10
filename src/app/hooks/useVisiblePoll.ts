/**
 * Visibility-aware polling hook.
 *
 * Fires `fn` immediately on mount and then every `ms` milliseconds — but
 * pauses entirely when the tab is hidden (document.visibilityState ===
 * "hidden") and resumes on next visibility flip. Optionally also pauses
 * when the window loses focus.
 *
 * Drop-in replacement for setInterval callsites that were hammering the
 * server even when nobody was looking at the page.
 *
 * Usage:
 *   useVisiblePoll(loadData, 15_000);
 *   useVisiblePoll(ping, 30_000, { pauseOnBlur: true });
 */
"use client";

import { useEffect, useRef } from "react";

type Options = {
  /** Pause when the window loses focus too (default: false — only visibility). */
  pauseOnBlur?: boolean;
  /** Skip the immediate initial call (default: false — fires once on mount). */
  skipInitial?: boolean;
  /** Disable the poll entirely (e.g. when prerequisites aren't met yet). */
  enabled?: boolean;
};

export function useVisiblePoll(
  fn: () => void | Promise<void>,
  ms: number,
  opts: Options = {}
): void {
  const { pauseOnBlur = false, skipInitial = false, enabled = true } = opts;
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    let firstTick = skipInitial;

    const shouldRun = () => {
      if (typeof document === "undefined") return false;
      if (document.visibilityState === "hidden") return false;
      if (pauseOnBlur && !document.hasFocus()) return false;
      return true;
    };

    const tick = () => {
      if (!shouldRun()) return;
      void fnRef.current();
    };

    const start = () => {
      if (timer !== null) return;
      if (!firstTick) tick();
      firstTick = false;
      timer = setInterval(tick, ms);
    };

    const stop = () => {
      if (timer === null) return;
      clearInterval(timer);
      timer = null;
    };

    const onChange = () => {
      if (shouldRun()) start();
      else stop();
    };

    if (shouldRun()) start();

    document.addEventListener("visibilitychange", onChange);
    if (pauseOnBlur) {
      window.addEventListener("focus", onChange);
      window.addEventListener("blur", onChange);
    }

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onChange);
      if (pauseOnBlur) {
        window.removeEventListener("focus", onChange);
        window.removeEventListener("blur", onChange);
      }
    };
  }, [ms, pauseOnBlur, skipInitial, enabled]);
}
