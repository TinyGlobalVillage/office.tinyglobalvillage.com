"use client";

import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";

const PREFIX = "tgv-drawer-state:";

function storageKey(drawerId: string, fieldKey: string) {
  return `${PREFIX}${drawerId}:${fieldKey}`;
}

// localStorage-backed useState for per-drawer state. Persists across tab
// closures; cleared on logout via `clearAllDrawerState`.
export function useDrawerPersistedState<T>(
  drawerId: string,
  fieldKey: string,
  initial: T
): [T, Dispatch<SetStateAction<T>>] {
  const fullKey = storageKey(drawerId, fieldKey);
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = window.localStorage.getItem(fullKey);
      if (raw === null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });
  const firstRun = useRef(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (firstRun.current) { firstRun.current = false; return; }
    try {
      window.localStorage.setItem(fullKey, JSON.stringify(value));
    } catch {
      /* quota or serialization — drop silently */
    }
  }, [fullKey, value]);
  return [value, setValue];
}

export function clearAllDrawerState() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => window.localStorage.removeItem(k));
}
