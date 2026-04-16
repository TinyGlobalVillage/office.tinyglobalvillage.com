"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";

export type TerminalLine = {
  type: "out" | "err" | "info" | "exit" | "log";
  text: string;
  ts: number;
};

export type ShellTab = {
  id: string;
  label: string;
  lines: TerminalLine[];
  history: string[];
};

type TerminalCtx = {
  // shell tabs
  tabs: ShellTab[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  addTab: () => void;
  closeTab: (id: string) => void;
  renameTab: (id: string, label: string) => void;

  // active tab convenience
  lines: TerminalLine[];
  clearTerminal: () => void;

  isOpen: boolean;
  isRunning: boolean;
  currentScript: string | null;

  openTerminal: () => void;
  closeTerminal: () => void;
  toggleTerminal: () => void;

  // legacy whitelisted script runner
  runCommand: (script: string, args?: string[]) => Promise<void>;

  // arbitrary shell command
  runShell: (cmd: string) => Promise<void>;

  killCommand: () => void;
};

const Ctx = createContext<TerminalCtx | null>(null);

export function useTerminal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTerminal must be used inside TerminalProvider");
  return ctx;
}

let tabCounter = 1;
function makeTab(label?: string): ShellTab {
  return {
    id: `tab-${Date.now()}-${tabCounter++}`,
    label: label ?? `Shell ${tabCounter - 1}`,
    lines: [],
    history: [],
  };
}

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<ShellTab[]>(() => [makeTab("Shell 1")]);
  const [activeTabId, setActiveTabId] = useState<string>(() => "");
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Resolve active tab id (bootstrap: first tab)
  const resolvedActiveId = activeTabId || tabs[0]?.id || "";

  const activeTab = tabs.find((t) => t.id === resolvedActiveId) ?? tabs[0];
  const lines = activeTab?.lines ?? [];

  // ── Tab management ────────────────────────────────────────────
  const addTab = useCallback(() => {
    const t = makeTab(`Shell ${tabCounter}`);
    setTabs((prev) => [...prev, t]);
    setActiveTabId(t.id);
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = makeTab("Shell 1");
          setActiveTabId(fresh.id);
          return [fresh];
        }
        if (id === resolvedActiveId) {
          setActiveTabId(next[next.length - 1].id);
        }
        return next;
      });
    },
    [resolvedActiveId]
  );

  const renameTab = useCallback((id: string, label: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, label } : t))
    );
  }, []);

  // ── Line appender ─────────────────────────────────────────────
  const addLine = useCallback(
    (type: TerminalLine["type"], text: string, tabId?: string) => {
      const target = tabId ?? resolvedActiveId;
      const trimmed = text.replace(/\r/g, "").trimEnd();
      if (!trimmed) return;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === target
            ? { ...t, lines: [...t.lines, { type, text: trimmed, ts: Date.now() }] }
            : t
        )
      );
    },
    [resolvedActiveId]
  );

  const addHistory = useCallback(
    (cmd: string, tabId?: string) => {
      const target = tabId ?? resolvedActiveId;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === target
            ? { ...t, history: [cmd, ...t.history.slice(0, 49)] }
            : t
        )
      );
    },
    [resolvedActiveId]
  );

  // ── SSE stream reader ─────────────────────────────────────────
  const streamReader = useCallback(
    async (res: Response, tabId: string, signal: AbortSignal) => {
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const raw = chunk.replace(/^data: /, "").trim();
          if (!raw) continue;
          try {
            const { type, data } = JSON.parse(raw) as { type: string; data: string };
            if (type === "exit") {
              const code = parseInt(data, 10);
              addLine(
                code === 0 ? "exit" : "err",
                code === 0 ? "✓ Done (exit 0)" : `✗ Exited with code ${code}`,
                tabId
              );
            } else {
              const t = type as TerminalLine["type"];
              data.split("\n").filter((l) => l.trim()).forEach((l) => addLine(t, l, tabId));
            }
          } catch { /* malformed chunk */ }
        }
      }
    },
    [addLine]
  );

  // ── Kill ──────────────────────────────────────────────────────
  const killCommand = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setCurrentScript(null);
  }, []);

  // ── Run shell command ─────────────────────────────────────────
  const runShell = useCallback(
    async (cmd: string) => {
      if (isRunning) return;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const tabId = resolvedActiveId;

      setIsRunning(true);
      setCurrentScript(cmd.slice(0, 30));
      setIsOpen(true);
      addHistory(cmd, tabId);
      addLine("info", `$ ${cmd}`, tabId);

      try {
        const res = await fetch("/api/terminal/shell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cmd }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          addLine("err", `Error: ${await res.text()}`, tabId);
          return;
        }

        await streamReader(res, tabId, abortRef.current.signal);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          addLine("info", "⊘ Killed", tabId);
        } else if (err instanceof Error) {
          addLine("err", `Connection error: ${err.message}`, tabId);
        }
      } finally {
        setIsRunning(false);
        setCurrentScript(null);
      }
    },
    [isRunning, resolvedActiveId, addLine, addHistory, streamReader]
  );

  // ── Run whitelisted script ────────────────────────────────────
  const runCommand = useCallback(
    async (script: string, args: string[] = []) => {
      if (isRunning) return;
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const tabId = resolvedActiveId;

      setIsRunning(true);
      setCurrentScript(script);
      setIsOpen(true);
      addLine("info", `─── ${script} ${args.join(" ")} ───`, tabId);

      try {
        const res = await fetch("/api/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script, args }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          addLine("err", `Error: ${await res.text()}`, tabId);
          return;
        }

        await streamReader(res, tabId, abortRef.current.signal);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          addLine("info", "⊘ Command killed", tabId);
        } else if (err instanceof Error) {
          addLine("err", `Connection error: ${err.message}`, tabId);
        }
      } finally {
        setIsRunning(false);
        setCurrentScript(null);
      }
    },
    [isRunning, resolvedActiveId, addLine, streamReader]
  );

  return (
    <Ctx.Provider
      value={{
        tabs,
        activeTabId: resolvedActiveId,
        setActiveTabId,
        addTab,
        closeTab,
        renameTab,
        lines,
        clearTerminal: () =>
          setTabs((prev) =>
            prev.map((t) => (t.id === resolvedActiveId ? { ...t, lines: [] } : t))
          ),
        isOpen,
        isRunning,
        currentScript,
        openTerminal: () => setIsOpen(true),
        closeTerminal: () => setIsOpen(false),
        toggleTerminal: () => setIsOpen((p) => !p),
        runCommand,
        runShell,
        killCommand,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
