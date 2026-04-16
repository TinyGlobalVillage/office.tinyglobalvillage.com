"use client";

import {
  useEffect, useRef, useState, KeyboardEvent, FormEvent, useCallback
} from "react";
import { useTerminal, TerminalLine } from "./TerminalProvider";

// ── Colour map ────────────────────────────────────────────────────────────────
const LINE_COLOR: Record<string, string> = {
  out:  "#d4d4d4",
  err:  "#ff6b6b",
  info: "#00bfff",
  exit: "#4ade80",
  log:  "#888",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type PanelPos = "bottom" | "right" | "left" | "float";
type PanelMode = "shell" | "stream" | "logs" | "claude";

type ClaudeMessage = { role: "user" | "assistant"; content: string };
type ClaudeLine    = { role: "user" | "assistant"; text: string; streaming?: boolean };

// ── Minimal markdown renderer for Claude responses ────────────────────────────
function ClaudeMarkdown({ text }: { text: string }) {
  // Split by code blocks first
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const nl = part.indexOf("\n");
          const lang = nl > 3 ? part.slice(3, nl).trim() : "";
          const code = nl > 0 ? part.slice(nl + 1, -3) : part.slice(3, -3);
          return (
            <pre
              key={i}
              className="my-2 px-3 py-2 rounded text-[10px] overflow-x-auto"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)", color: "#d4d4d4" }}
            >
              {lang && <div className="text-[9px] text-white/30 mb-1 font-bold uppercase">{lang}</div>}
              {code}
            </pre>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="px-1 rounded text-[10px]" style={{ background: "rgba(0,0,0,0.35)", color: "#f7b700" }}>
              {part.slice(1, -1)}
            </code>
          );
        }
        // Inline: **bold**, line breaks
        return (
          <span key={i}>
            {part.split("\n").map((line, j, arr) => {
              const bold = line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) =>
                seg.startsWith("**") && seg.endsWith("**")
                  ? <strong key={k} style={{ color: "#fff" }}>{seg.slice(2, -2)}</strong>
                  : seg
              );
              return (
                <span key={j}>
                  {bold}
                  {j < arr.length - 1 && <br />}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

const POS_META: Record<PanelPos, { icon: string; title: string }> = {
  bottom: { icon: "⬇", title: "Dock bottom" },
  right:  { icon: "▶", title: "Dock right"  },
  left:   { icon: "◀", title: "Dock left"   },
  float:  { icon: "⧉", title: "Float"       },
};

// ── Live server-stream hook ───────────────────────────────────────────────────
function useServerStream(active: boolean) {
  const [streamLines, setStreamLines] = useState<TerminalLine[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch("/api/terminal/stream", { signal: ctrl.signal });
        if (!res.ok) return;
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (chunk.startsWith(":")) continue;
            const raw = chunk.replace(/^data: /, "").trim();
            if (!raw) continue;
            try {
              const { text } = JSON.parse(raw) as { ts: number; text: string };
              setStreamLines((p) => {
                const next = [...p, { type: "log" as const, text, ts: Date.now() }];
                return next.length > 2000 ? next.slice(-2000) : next;
              });
            } catch { /* skip */ }
          }
        }
      } catch { /* aborted */ }
    })();

    return () => ctrl.abort();
  }, [active]);

  return streamLines;
}

// ── Log browser hook ──────────────────────────────────────────────────────────
type LogMeta = { date: string; bytes: number };

function useLogBrowser() {
  const [dates, setDates]               = useState<LogMeta[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lines, setLines]               = useState<string[]>([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((d: { dates: LogMeta[] }) => {
        setDates(d.dates ?? []);
        if (d.dates?.length) setSelectedDate(d.dates[0].date);
      })
      .catch(() => {});
  }, []);

  const load = useCallback((date: string, p: number) => {
    setLoading(true);
    fetch(`/api/logs?date=${date}&page=${p}&limit=200`)
      .then((r) => r.json())
      .then((d: { lines: string[]; totalPages: number; total: number; page: number }) => {
        setLines(d.lines ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
        setPage(d.page ?? 1);
      })
      .catch(() => { setLines([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedDate) { setPage(1); load(selectedDate, 1); }
  }, [selectedDate, load]);

  return {
    dates, selectedDate, setSelectedDate,
    lines, page, totalPages, total, loading,
    goPage: (p: number) => { if (selectedDate) load(selectedDate, p); },
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CliTerminal({ standalone = false }: { standalone?: boolean }) {
  const {
    tabs, activeTabId, setActiveTabId, addTab, closeTab,
    lines, isOpen, isRunning, currentScript,
    toggleTerminal, clearTerminal, killCommand, runShell,
  } = useTerminal();

  const [mode,       setMode]       = useState<PanelMode>("shell");
  const [inputValue, setInputValue] = useState("");
  const [histIdx,    setHistIdx]    = useState(-1);
  const [pos,        setPos]        = useState<PanelPos>("bottom");
  const [height,     setHeight]     = useState(380);   // bottom mode height
  const [width,      setWidth]      = useState(520);   // left/right mode width
  const [floatRect,  setFloatRect]  = useState({ x: 80, y: 80, w: 740, h: 500 });

  const [claudeLines,    setClaudeLines]    = useState<ClaudeLine[]>([]);
  const [claudeHistory,  setClaudeHistory]  = useState<ClaudeMessage[]>([]);
  const [claudeStreaming, setClaudeStreaming] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const open = standalone || isOpen;

  const streamLines = useServerStream(open);
  const logBrowser  = useLogBrowser();

  const displayLines = mode === "stream" ? streamLines : lines;

  // Persist position preference
  useEffect(() => {
    const saved = localStorage.getItem("tgv-terminal-pos") as PanelPos | null;
    if (saved && saved in POS_META) setPos(saved);
    const savedFloat = localStorage.getItem("tgv-terminal-float");
    if (savedFloat) { try { setFloatRect(JSON.parse(savedFloat)); } catch { /* ignore */ } }
  }, []);
  useEffect(() => { localStorage.setItem("tgv-terminal-pos", pos); }, [pos]);
  useEffect(() => { localStorage.setItem("tgv-terminal-float", JSON.stringify(floatRect)); }, [floatRect]);

  // Auto-scroll
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [displayLines, open, mode]);

  // Focus input on open
  useEffect(() => {
    if (open && mode === "shell") setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, mode]);

  // ESC to close
  useEffect(() => {
    if (standalone) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) toggleTerminal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, standalone, toggleTerminal]);

  // ── Resize: bottom edge (drag up/down) ───────────────────────────────────
  const onBottomDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const start = { y: e.clientY, h: height };
    const onMove = (ev: MouseEvent) => {
      const delta = start.y - ev.clientY;
      setHeight(Math.max(220, Math.min(window.innerHeight * 0.85, start.h + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Resize: side panels (drag left/right) ────────────────────────────────
  const onSideDrag = (e: React.MouseEvent, edge: "left" | "right") => {
    e.preventDefault();
    const start = { x: e.clientX, w: width };
    const onMove = (ev: MouseEvent) => {
      const delta = edge === "right" ? ev.clientX - start.x : start.x - ev.clientX;
      setWidth(Math.max(300, Math.min(window.innerWidth * 0.75, start.w + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Drag: float window (move) ────────────────────────────────────────────
  const onFloatDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select")) return;
    e.preventDefault();
    const start = { mx: e.clientX, my: e.clientY, fx: floatRect.x, fy: floatRect.y };
    const onMove = (ev: MouseEvent) => {
      setFloatRect((r) => ({
        ...r,
        x: Math.max(0, Math.min(window.innerWidth  - r.w, start.fx + ev.clientX - start.mx)),
        y: Math.max(0, Math.min(window.innerHeight - r.h, start.fy + ev.clientY - start.my)),
      }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Resize: float window (8-direction) ───────────────────────────────────
  type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const onFloatResize = (e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { mx: e.clientX, my: e.clientY, ...floatRect };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx;
      const dy = ev.clientY - start.my;
      setFloatRect(() => {
        let { x, y, w, h } = start;
        if (dir.includes("e")) w = Math.max(400, start.w + dx);
        if (dir.includes("s")) h = Math.max(220, start.h + dy);
        if (dir.includes("w")) { w = Math.max(400, start.w - dx); x = start.x + (start.w - w); }
        if (dir.includes("n")) { h = Math.max(220, start.h - dy); y = start.y + (start.h - h); }
        return { x, y, w, h };
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Pop out ───────────────────────────────────────────────────────────────
  const handlePopout = () => {
    window.open(
      "/terminal-popout",
      "tgv-terminal",
      "width=960,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
    );
  };

  // ── Panel container style ─────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = standalone
    ? { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column" }
    : pos === "bottom"
    ? {
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        height: `${height}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderTop: "1px solid rgba(255,78,203,0.2)",
      }
    : pos === "right"
    ? {
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 40,
        width: `${width}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderLeft: "1px solid rgba(255,78,203,0.2)",
      }
    : pos === "left"
    ? {
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40,
        width: `${width}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderRight: "1px solid rgba(255,78,203,0.2)",
      }
    : /* float */ {
        position: "fixed",
        top:    `${floatRect.y}px`,
        left:   `${floatRect.x}px`,
        width:  `${floatRect.w}px`,
        height: `${floatRect.h}px`,
        zIndex: 40,
        display: open ? "flex" : "none",
        flexDirection: "column",
        borderRadius: 10,
        border: "1px solid rgba(255,78,203,0.3)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.85)",
      };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.trim();
    if (!cmd) return;
    setInputValue("");
    if (mode === "claude") {
      await sendToClaude(cmd);
    } else {
      if (isRunning) return;
      setHistIdx(-1);
      await runShell(cmd);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = activeTab?.history ?? [];
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, hist.length - 1);
      setHistIdx(next);
      setInputValue(hist[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setInputValue(""); }
      else { setHistIdx(next); setInputValue(hist[next] ?? ""); }
    }
  };

  // ── Claude chat ───────────────────────────────────────────────────────────
  const sendToClaude = useCallback(async (userText: string) => {
    if (!userText.trim() || claudeStreaming) return;

    const newHistory: ClaudeMessage[] = [...claudeHistory, { role: "user", content: userText }];
    setClaudeHistory(newHistory);
    setClaudeLines((prev) => [...prev, { role: "user", text: userText }]);
    setClaudeStreaming(true);

    // Placeholder for streaming assistant response
    setClaudeLines((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/terminal/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setClaudeLines((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: err.error ?? "Error", streaming: false };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const raw = chunk.replace(/^data: /, "").trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string };
            if (parsed.error) {
              fullText += `\n[Error: ${parsed.error}]`;
            } else if (parsed.text) {
              fullText += parsed.text;
            }
            setClaudeLines((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", text: fullText, streaming: true };
              return next;
            });
          } catch { /* skip */ }
        }
      }

      setClaudeLines((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: fullText, streaming: false };
        return next;
      });
      setClaudeHistory((prev) => [...prev, { role: "assistant", content: fullText }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setClaudeLines((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: `[Error: ${msg}]`, streaming: false };
        return next;
      });
    } finally {
      setClaudeStreaming(false);
    }
  }, [claudeHistory, claudeStreaming]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Click-outside backdrop */}
      {!standalone && isOpen && (
        <div
          className="fixed inset-0 z-30"
          onClick={toggleTerminal}
          aria-hidden="true"
        />
      )}

      {/* Floating toggle button */}
      {!standalone && (
        <button
          onClick={toggleTerminal}
          title="Toggle Terminal"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg transition-all duration-200 hover:scale-105"
          style={{
            background: isRunning
              ? "linear-gradient(135deg, #f7b700, #ff9900)"
              : "linear-gradient(135deg, #ff4ecb, #7b2ff7)",
            boxShadow: isRunning ? "0 0 16px rgba(247,183,0,0.6)" : "0 0 16px rgba(255,78,203,0.5)",
            color: "#fff",
          }}
        >
          <span className="font-mono text-sm">{isRunning ? "●" : ">_"}</span>
          {isRunning ? `${currentScript?.slice(0, 18) ?? "running"}…` : isOpen ? "Hide" : "Terminal"}
          {!isOpen && lines.length > 0 && !isRunning && (
            <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">{lines.length}</span>
          )}
        </button>
      )}

      {/* ── Terminal panel ────────────────────────────────────────────────── */}
      <div
        className="relative"
        style={{
          ...panelStyle,
          background: "rgba(4,5,8,0.98)",
          boxShadow: pos !== "float" && !standalone
            ? "0 -8px 40px rgba(0,0,0,0.7)"
            : undefined,
        }}
      >

        {/* ── Resize handles ───────────────────────────────────────────── */}
        {!standalone && pos === "bottom" && (
          <div
            className="flex-shrink-0 h-1.5 w-full cursor-row-resize flex items-center justify-center group"
            onMouseDown={onBottomDrag}
          >
            <div className="w-12 h-0.5 rounded-full bg-white/15 group-hover:bg-pink-500/60 transition-colors" />
          </div>
        )}
        {!standalone && pos === "right" && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 flex items-center justify-center group"
            onMouseDown={(e) => onSideDrag(e, "right")}
          >
            <div className="h-12 w-0.5 rounded-full bg-white/15 group-hover:bg-pink-500/60 transition-colors" />
          </div>
        )}
        {!standalone && pos === "left" && (
          <div
            className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 flex items-center justify-center group"
            onMouseDown={(e) => onSideDrag(e, "left")}
          >
            <div className="h-12 w-0.5 rounded-full bg-white/15 group-hover:bg-pink-500/60 transition-colors" />
          </div>
        )}
        {!standalone && pos === "float" && (
          <>
            {/* edges */}
            <div className="absolute inset-x-2 top-0 h-1.5 cursor-n-resize z-10" onMouseDown={(e) => onFloatResize(e, "n")} />
            <div className="absolute inset-x-2 bottom-0 h-1.5 cursor-s-resize z-10" onMouseDown={(e) => onFloatResize(e, "s")} />
            <div className="absolute inset-y-2 left-0 w-1.5 cursor-w-resize z-10" onMouseDown={(e) => onFloatResize(e, "w")} />
            <div className="absolute inset-y-2 right-0 w-1.5 cursor-e-resize z-10" onMouseDown={(e) => onFloatResize(e, "e")} />
            {/* corners */}
            <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-20" onMouseDown={(e) => onFloatResize(e, "nw")} />
            <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-20" onMouseDown={(e) => onFloatResize(e, "ne")} />
            <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-20" onMouseDown={(e) => onFloatResize(e, "sw")} />
            <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-20" onMouseDown={(e) => onFloatResize(e, "se")} />
          </>
        )}

        {/* ── Float drag-move title bar ────────────────────────────────── */}
        {!standalone && pos === "float" && (
          <div
            className="flex-shrink-0 h-6 flex items-center px-3 gap-2 cursor-move select-none"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            onMouseDown={onFloatDrag}
          >
            <span className="text-[9px] font-mono tracking-widest" style={{ color: "rgba(255,78,203,0.35)" }}>
              ⠿ TGV TERMINAL
            </span>
            <div className="flex-1" />
            <span className="text-[9px] text-white/10">drag to move</span>
          </div>
        )}

        {/* ── Tab / mode bar ───────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 px-3 py-1.5 flex-shrink-0 overflow-x-auto"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[10px] font-mono text-white/30 shrink-0 mr-1">▸</span>

          {/* Shell tabs */}
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className="flex items-center gap-1 shrink-0"
              style={{
                background: tab.id === activeTabId ? "rgba(255,78,203,0.15)" : "transparent",
                border: `1px solid ${tab.id === activeTabId ? "rgba(255,78,203,0.35)" : "rgba(255,255,255,0.07)"}`,
                borderRadius: 6,
                padding: "2px 6px",
              }}
            >
              <button
                onClick={() => { setActiveTabId(tab.id); setMode("shell"); }}
                title={`Switch to ${tab.label}`}
                className="text-[10px] font-bold whitespace-nowrap"
                style={{ color: tab.id === activeTabId ? "#ff4ecb" : "rgba(255,255,255,0.3)" }}
              >
                {tab.label}
                {tab.lines.length > 0 && (
                  <span className="ml-1 opacity-50">{tab.lines.length}</span>
                )}
              </button>
              {tabs.length > 1 && (
                <button
                  onClick={() => closeTab(tab.id)}
                  title="Close tab"
                  className="text-[9px] text-white/20 hover:text-red-400 transition-colors ml-0.5"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          <button
            onClick={addTab}
            title="New terminal tab"
            className="shrink-0 text-[11px] text-white/25 hover:text-cyan-400 transition-colors px-1.5 py-0.5 rounded"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            +
          </button>

          <div className="w-px h-4 bg-white/10 mx-1 shrink-0" />

          {/* Mode buttons */}
          {([
            { id: "shell",  label: ">_ shell",   title: "Interactive shell" },
            { id: "stream", label: "📡 stream",  title: "Live server feed"  },
            { id: "logs",   label: "📋 logs",    title: "Browse saved logs" },
            { id: "claude", label: "✦ claude",   title: "Chat with Claude"  },
          ] as { id: PanelMode; label: string; title: string }[]).map(({ id, label, title }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              title={title}
              className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: mode === id
                  ? id === "claude" ? "rgba(139,92,246,0.2)" : "rgba(0,191,255,0.15)"
                  : "transparent",
                border: `1px solid ${mode === id
                  ? id === "claude" ? "rgba(139,92,246,0.5)" : "rgba(0,191,255,0.3)"
                  : "rgba(255,255,255,0.07)"}`,
                color: mode === id
                  ? id === "claude" ? "#a78bfa" : "#00bfff"
                  : "rgba(255,255,255,0.25)",
              }}
            >
              {label}
            </button>
          ))}

          <div className="flex-1" />

          {/* Running indicator */}
          {isRunning && (
            <button
              onClick={killCommand}
              title="Kill running command"
              className="text-xs font-mono text-red-400 hover:text-red-300 shrink-0 mr-1"
            >
              ⊘ Kill
            </button>
          )}
          <button
            onClick={clearTerminal}
            title="Clear"
            className="text-[10px] text-white/25 hover:text-white/60 transition-colors shrink-0 mr-1"
          >
            Clear
          </button>

          {/* Position picker */}
          {!standalone && (
            <>
              <div className="w-px h-3 bg-white/10 mx-1 shrink-0" />
              {(["bottom", "left", "right", "float"] as PanelPos[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPos(p)}
                  title={POS_META[p].title}
                  className="shrink-0 text-[11px] px-1 py-0.5 rounded transition-all"
                  style={{
                    color:      pos === p ? "#ff4ecb" : "rgba(255,255,255,0.2)",
                    background: pos === p ? "rgba(255,78,203,0.12)" : "transparent",
                  }}
                >
                  {POS_META[p].icon}
                </button>
              ))}
              <button
                onClick={handlePopout}
                title="Pop out as new window"
                className="shrink-0 text-[11px] px-1 py-0.5 rounded transition-colors text-white/20 hover:text-cyan-400 ml-0.5"
              >
                ↗
              </button>
              <div className="w-px h-3 bg-white/10 mx-1 shrink-0" />
              <button
                onClick={toggleTerminal}
                title="Minimize"
                className="text-[10px] text-white/25 hover:text-white/60 transition-colors shrink-0"
              >
                ╌
              </button>
            </>
          )}
        </div>

        {/* ── Log browser controls ─────────────────────────────────────── */}
        {mode === "logs" && (
          <div
            className="flex items-center gap-3 px-4 py-2 flex-shrink-0 flex-wrap"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <span className="text-[10px] text-white/30 uppercase tracking-wider shrink-0">Date (LA)</span>
            <select
              value={logBrowser.selectedDate ?? ""}
              onChange={(e) => logBrowser.setSelectedDate(e.target.value || null)}
              className="text-xs font-mono rounded px-2 py-1 outline-none"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(0,191,255,0.2)",
                color: "#d4d4d4",
              }}
            >
              {logBrowser.dates.length === 0 && <option value="">No logs yet</option>}
              {logBrowser.dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date} ({(d.bytes / 1024).toFixed(0)} KB)
                </option>
              ))}
            </select>
            {logBrowser.selectedDate && (
              <span className="text-[10px] text-white/30">
                {logBrowser.total.toLocaleString()} lines · page {logBrowser.page}/{logBrowser.totalPages}
              </span>
            )}
            {logBrowser.loading && (
              <span className="text-[10px] text-yellow-400/70 animate-pulse">Loading…</span>
            )}
            {logBrowser.totalPages > 1 && (
              <div className="flex items-center gap-1 ml-auto">
                <button
                  disabled={logBrowser.page >= logBrowser.totalPages}
                  onClick={() => logBrowser.goPage(logBrowser.page + 1)}
                  className="text-[10px] px-2 py-0.5 rounded disabled:opacity-30 text-white/40 hover:text-cyan-400"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  ← Older
                </button>
                <button
                  disabled={logBrowser.page <= 1}
                  onClick={() => logBrowser.goPage(logBrowser.page - 1)}
                  className="text-[10px] px-2 py-0.5 rounded disabled:opacity-30 text-white/40 hover:text-cyan-400"
                  style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Newer →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Output area ──────────────────────────────────────────────── */}
        <div
          className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-[1.65]"
          style={{ scrollbarWidth: "thin" }}
          onClick={() => (mode === "shell" || mode === "claude") && inputRef.current?.focus()}
        >
          {mode === "claude" ? (
            claudeLines.length === 0 ? (
              <div className="flex flex-col gap-2 text-white/20">
                <span className="text-base">✦</span>
                <p>Claude is ready. Ask anything about your server, code, or projects.</p>
                <p className="text-[10px]">Context: TGV Office · Next.js · PostgreSQL · PM2 · Ubuntu</p>
              </div>
            ) : (
              <>
                {claudeLines.map((line, i) => (
                  <div key={i} className={`mb-3 ${line.role === "user" ? "flex justify-end" : ""}`}>
                    {line.role === "user" ? (
                      <div
                        className="max-w-[85%] px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.3)", color: "#e2d9f3" }}
                      >
                        {line.text}
                      </div>
                    ) : (
                      <div className="text-[11px] leading-relaxed" style={{ color: "#d4d4d4" }}>
                        <span className="text-[9px] font-bold tracking-wider mr-2" style={{ color: "#a78bfa" }}>✦ CLAUDE</span>
                        <ClaudeMarkdown text={line.text} />
                        {line.streaming && (
                          <span className="inline-block ml-0.5 animate-pulse" style={{ color: "#a78bfa" }}>▌</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {claudeLines.length > 0 && (
                  <button
                    onClick={() => { setClaudeLines([]); setClaudeHistory([]); }}
                    className="text-[9px] text-white/15 hover:text-white/40 transition-colors mt-1"
                  >
                    clear conversation
                  </button>
                )}
              </>
            )
          ) : mode === "logs" ? (
            logBrowser.loading ? (
              <span className="text-white/20">Loading…</span>
            ) : logBrowser.lines.length === 0 ? (
              <span className="text-white/20">
                {logBrowser.dates.length === 0
                  ? "No logs captured yet."
                  : "No lines for this date."}
              </span>
            ) : (
              logBrowser.lines.map((line, i) => (
                <div key={i} className="text-white/50 whitespace-pre-wrap break-all leading-snug">
                  {line}
                </div>
              ))
            )
          ) : (
            <>
              {displayLines.length === 0 && (
                <span className="text-white/20">
                  {mode === "stream" ? "Waiting for server events…" : "Type a command. ↑↓ for history."}
                </span>
              )}
              {displayLines.map((line, i) => (
                <div
                  key={i}
                  style={{ color: LINE_COLOR[line.type] ?? "#d4d4d4", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                >
                  {line.text}
                </div>
              ))}
              {isRunning && mode === "shell" && (
                <span className="inline-block mt-1" style={{ color: "#f7b700" }}>▌</span>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Input bar (shell + claude) ────────────────────────────────── */}
        {(mode === "shell" || mode === "claude") && (
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
            style={{ borderTop: `1px solid ${mode === "claude" ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.06)"}` }}
          >
            {mode === "shell" ? (
              <span className="font-mono text-xs shrink-0" style={{ color: "#4ade80" }}>
                {(activeTab?.label ?? "shell").toLowerCase().replace(/\s+/, "")}@tgv:~$
              </span>
            ) : (
              <span className="font-mono text-xs shrink-0" style={{ color: "#a78bfa" }}>✦</span>
            )}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setHistIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "claude"
                  ? claudeStreaming ? "Claude is thinking…" : "Ask Claude anything…"
                  : isRunning ? "running…" : "type a command…"
              }
              disabled={mode === "shell" ? isRunning : claudeStreaming}
              autoComplete="off"
              spellCheck={false}
              className="flex-1 bg-transparent outline-none font-mono text-xs text-white placeholder-white/20 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={mode === "shell" ? (isRunning || !inputValue.trim()) : (claudeStreaming || !inputValue.trim())}
              title={mode === "claude" ? "Send to Claude (Enter)" : "Run command (Enter)"}
              className="text-[10px] font-bold px-2 py-0.5 rounded transition-all disabled:opacity-20"
              style={{
                background: mode === "claude" ? "rgba(139,92,246,0.15)" : "rgba(74,222,128,0.12)",
                border:     mode === "claude" ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(74,222,128,0.3)",
                color:      mode === "claude" ? "#a78bfa" : "#4ade80",
              }}
            >
              ↵
            </button>
          </form>
        )}
      </div>
    </>
  );
}
