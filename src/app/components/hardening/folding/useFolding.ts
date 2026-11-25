"use client";
// Shared loader for the Folding@home tile quick-bar and its control modal.
import { useCallback, useEffect, useState } from "react";
import type { FoldingAction, FoldingSnapshot } from "@/lib/folding/types";

export function useFolding(pollMs = 30000) {
  const [snap, setSnap] = useState<FoldingSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/folding", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || r.statusText);
      setSnap(j);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  const act = useCallback(async (host: string, action: FoldingAction, team?: number) => {
    setBusy(`${host}:${action}`);
    try {
      const r = await fetch("/api/admin/folding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ host, action, team }),
      });
      const j = await r.json();
      if (j.hosts) setSnap(j);
      if (!r.ok) throw new Error(j.error || r.statusText);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  return { snap, error, busy, load, act };
}

export const fmtPpd = (n?: number | null) =>
  typeof n !== "number" ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n);
