"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

let stack: string[] = [];
let pointer = -1;
let suppressNextRecord = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

function recordPath(path: string) {
  if (suppressNextRecord) {
    suppressNextRecord = false;
    return;
  }
  if (stack[pointer] === path) return;
  stack = stack.slice(0, pointer + 1);
  stack.push(path);
  pointer = stack.length - 1;
  notify();
}

export function useNavHistory() {
  const pathname = usePathname();
  const router = useRouter();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (pathname) recordPath(pathname);
  }, [pathname]);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  const canBack = pointer > 0;
  const canForward = pointer < stack.length - 1;

  const back = () => {
    if (!canBack) return;
    suppressNextRecord = true;
    pointer -= 1;
    router.push(stack[pointer]);
    notify();
  };

  const forward = () => {
    if (!canForward) return;
    suppressNextRecord = true;
    pointer += 1;
    router.push(stack[pointer]);
    notify();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key === "[") { e.preventDefault(); back(); return; }
      if (meta && e.key === "]") { e.preventDefault(); forward(); return; }
      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); back(); return; }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); forward(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBack, canForward]);

  return { canBack, canForward, back, forward };
}
