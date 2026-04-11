"use client";

import { useEffect, useRef, useState } from "react";
import { useTerminal } from "./TerminalProvider";

const LINE_COLOR: Record<string, string> = {
  out: "#d4d4d4",
  err: "#ff6b6b",
  info: "#00bfff",
  exit: "#4ade80",
};

export default function CliTerminal() {
  const {
    lines,
    isOpen,
    isRunning,
    currentScript,
    toggleTerminal,
    clearTerminal,
    killCommand,
  } = useTerminal();

  const bottomRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(320);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [lines, isOpen]);

  // Drag-to-resize handle
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startH: height };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY;
      setHeight(Math.max(160, Math.min(window.innerHeight * 0.8, dragRef.current.startH + delta)));
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const copyToClipboard = () => {
    const text = lines.map((l) => l.text).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      {/* ── Floating toggle button ─────────────────────────────── */}
      <button
        onClick={toggleTerminal}
        title="Toggle Terminal"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-200 hover:scale-105"
        style={{
          background: isRunning
            ? "linear-gradient(135deg, #f7b700, #ff9900)"
            : "linear-gradient(135deg, #ff4ecb, #7b2ff7)",
          boxShadow: isRunning
            ? "0 0 16px rgba(247,183,0,0.6)"
            : "0 0 16px rgba(255,78,203,0.5)",
          color: "#fff",
        }}
      >
        <span
          className="font-mono text-sm"
          style={{ animation: isRunning ? "pulse-green 1s infinite" : "none" }}
        >
          {isRunning ? "●" : ">_"}
        </span>
        {isRunning ? `${currentScript ?? "running"}…` : isOpen ? "Hide Terminal" : "Terminal"}
        {lines.length > 0 && !isRunning && (
          <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">
            {lines.length}
          </span>
        )}
      </button>

      {/* ── Terminal panel ─────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 flex flex-col"
        style={{
          height: `${height}px`,
          transform: isOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(5, 5, 8, 0.97)",
          borderTop: "1px solid rgba(255,78,203,0.25)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Drag handle */}
        <div
          className="flex-shrink-0 h-1.5 w-full cursor-row-resize flex items-center justify-center group"
          onMouseDown={onDragStart}
        >
          <div className="w-12 h-0.5 rounded-full bg-white/20 group-hover:bg-pink-500/60 transition-colors" />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono" style={{ color: "#ff4ecb" }}>
              ▸ TGV Terminal
            </span>
            {isRunning && (
              <span
                className="text-xs font-mono flex items-center gap-1"
                style={{ color: "#f7b700" }}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400" />
                {currentScript}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isRunning && (
              <button
                onClick={killCommand}
                className="text-xs font-mono text-red-400 hover:text-red-300 transition-colors"
              >
                ⊘ Kill
              </button>
            )}
            <button
              onClick={copyToClipboard}
              className="text-xs text-white/30 hover:text-white/70 transition-colors"
            >
              Copy
            </button>
            <button
              onClick={clearTerminal}
              className="text-xs text-white/30 hover:text-white/70 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={toggleTerminal}
              className="text-xs text-white/30 hover:text-white/70 transition-colors"
            >
              ╌ Minimize
            </button>
          </div>
        </div>

        {/* Output */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-[1.6]"
          style={{ scrollbarWidth: "thin" }}
        >
          {lines.length === 0 ? (
            <span className="text-white/20">
              No output yet. Run a command from the Utils panel.
            </span>
          ) : (
            lines.map((line, i) => (
              <div
                key={i}
                style={{
                  color: LINE_COLOR[line.type] ?? "#d4d4d4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {line.text}
              </div>
            ))
          )}
          {isRunning && (
            <span
              className="inline-block mt-1"
              style={{ color: "#f7b700", animation: "pulse-green 1s infinite" }}
            >
              ▌
            </span>
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
  );
}
