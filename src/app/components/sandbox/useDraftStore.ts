"use client";

import { useCallback, useEffect, useState } from "react";

export type Draft = {
  id: string;
  componentKey: string;
  number: number;          // auto-incremented, displayed as "Draft #N"
  code: string;            // current code (head of history)
  history: string[];       // full history for undo/redo
  historyIdx: number;      // pointer into history (0 = oldest)
  createdAt: number;
  updatedAt: number;
  baseCode: string;        // "last deployed" snapshot — Reset returns here
};

const KEY_PREFIX = "tgv_sandbox_drafts:";  // keyed per componentKey

function storageKey(componentKey: string) {
  return KEY_PREFIX + componentKey;
}

function loadAll(componentKey: string): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(componentKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveAll(componentKey: string, drafts: Draft[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(storageKey(componentKey), JSON.stringify(drafts)); } catch { /* quota etc */ }
}

function nextNumber(drafts: Draft[]): number {
  return drafts.reduce((m, d) => Math.max(m, d.number), 0) + 1;
}

/**
 * Manages drafts + history for a single component in the Sandbox edit mode.
 * Persists to localStorage. Backend swap-in is a one-line replacement of
 * loadAll/saveAll with API calls.
 */
export function useDraftStore(componentKey: string, deployedCode: string) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  useEffect(() => {
    const list = loadAll(componentKey);
    setDrafts(list);
    setActiveDraftId(null);
  }, [componentKey]);

  const persist = useCallback((next: Draft[]) => {
    saveAll(componentKey, next);
    setDrafts(next);
  }, [componentKey]);

  const startNewDraft = useCallback(() => {
    const number = nextNumber(drafts);
    const draft: Draft = {
      id: `${componentKey}-${Date.now()}`,
      componentKey,
      number,
      code: deployedCode,
      history: [deployedCode],
      historyIdx: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      baseCode: deployedCode,
    };
    const next = [...drafts, draft];
    persist(next);
    setActiveDraftId(draft.id);
    return draft;
  }, [drafts, deployedCode, componentKey, persist]);

  const openDraft = useCallback((id: string) => setActiveDraftId(id), []);
  const closeDraft = useCallback(() => setActiveDraftId(null), []);

  const deleteDraft = useCallback((id: string) => {
    persist(drafts.filter((d) => d.id !== id));
    if (activeDraftId === id) setActiveDraftId(null);
  }, [drafts, activeDraftId, persist]);

  const updateActive = useCallback((mut: (d: Draft) => Draft) => {
    if (!activeDraftId) return;
    persist(drafts.map((d) => d.id === activeDraftId ? mut(d) : d));
  }, [drafts, activeDraftId, persist]);

  // ── editing operations ──────────────────────────────────────────
  const writeCode = useCallback((code: string) => {
    updateActive((d) => {
      // Truncate any forward history on a new edit (standard undo semantics)
      const trimmed = d.history.slice(0, d.historyIdx + 1);
      const newHistory = [...trimmed, code];
      return { ...d, code, history: newHistory, historyIdx: newHistory.length - 1, updatedAt: Date.now() };
    });
  }, [updateActive]);

  const undo = useCallback(() => {
    updateActive((d) => {
      if (d.historyIdx <= 0) return d;
      const idx = d.historyIdx - 1;
      return { ...d, code: d.history[idx], historyIdx: idx, updatedAt: Date.now() };
    });
  }, [updateActive]);

  const redo = useCallback(() => {
    updateActive((d) => {
      if (d.historyIdx >= d.history.length - 1) return d;
      const idx = d.historyIdx + 1;
      return { ...d, code: d.history[idx], historyIdx: idx, updatedAt: Date.now() };
    });
  }, [updateActive]);

  const resetToDeployed = useCallback(() => {
    updateActive((d) => ({
      ...d,
      code: d.baseCode,
      history: [...d.history, d.baseCode],
      historyIdx: d.history.length,
      updatedAt: Date.now(),
    }));
  }, [updateActive]);

  const active = drafts.find((d) => d.id === activeDraftId) ?? null;

  return {
    drafts,
    active,
    activeDraftId,
    startNewDraft,
    openDraft,
    closeDraft,
    deleteDraft,
    writeCode,
    undo,
    redo,
    resetToDeployed,
    canUndo: active ? active.historyIdx > 0 : false,
    canRedo: active ? active.historyIdx < active.history.length - 1 : false,
  };
}
