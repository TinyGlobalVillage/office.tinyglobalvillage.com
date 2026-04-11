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
  type: "out" | "err" | "info" | "exit";
  text: string;
  ts: number;
};

type TerminalCtx = {
  lines: TerminalLine[];
  isOpen: boolean;
  isRunning: boolean;
  currentScript: string | null;
  openTerminal: () => void;
  closeTerminal: () => void;
  toggleTerminal: () => void;
  clearTerminal: () => void;
  runCommand: (script: string, args?: string[]) => Promise<void>;
  killCommand: () => void;
};

const Ctx = createContext<TerminalCtx | null>(null);

export function useTerminal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTerminal must be used inside TerminalProvider");
  return ctx;
}

export function TerminalProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScript, setCurrentScript] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addLine = useCallback(
    (type: TerminalLine["type"], text: string) => {
      const trimmed = text.replace(/\r/g, "").trimEnd();
      if (!trimmed) return;
      setLines((prev) => [...prev, { type, text: trimmed, ts: Date.now() }]);
    },
    []
  );

  const killCommand = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setCurrentScript(null);
  }, []);

  const runCommand = useCallback(
    async (script: string, args: string[] = []) => {
      if (isRunning) return;

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setIsRunning(true);
      setCurrentScript(script);
      setIsOpen(true);

      setLines((prev) => [
        ...prev,
        { type: "info", text: `─────── ${script} ${args.join(" ")} ───────`, ts: Date.now() },
      ]);

      try {
        const res = await fetch("/api/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script, args }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          addLine("err", `Error: ${await res.text()}`);
          return;
        }

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const raw = chunk.replace(/^data: /, "").trim();
            if (!raw) continue;
            try {
              const { type, data } = JSON.parse(raw) as {
                type: string;
                data: string;
              };
              if (type === "exit") {
                const code = parseInt(data, 10);
                addLine(
                  code === 0 ? "exit" : "err",
                  code === 0
                    ? `✓ Done (exit 0)`
                    : `✗ Exited with code ${code}`
                );
              } else {
                const t = type as TerminalLine["type"];
                data
                  .split("\n")
                  .filter((l) => l.trim())
                  .forEach((l) => addLine(t, l));
              }
            } catch {
              /* malformed chunk */
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          addLine("err", `Connection error: ${err.message}`);
        } else if (err instanceof Error && err.name === "AbortError") {
          addLine("info", "⊘ Command killed");
        }
      } finally {
        setIsRunning(false);
        setCurrentScript(null);
      }
    },
    [isRunning, addLine]
  );

  return (
    <Ctx.Provider
      value={{
        lines,
        isOpen,
        isRunning,
        currentScript,
        openTerminal: () => setIsOpen(true),
        closeTerminal: () => setIsOpen(false),
        toggleTerminal: () => setIsOpen((p) => !p),
        clearTerminal: () => setLines([]),
        runCommand,
        killCommand,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
