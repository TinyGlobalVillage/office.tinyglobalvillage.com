"use client";

import { useState, useEffect, useRef } from "react";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";

type Msg = { role: "user" | "assistant"; content: string };

const ORANGE = "#d97757";
const ORANGE_RGB = "217,119,87";

export default function ClaudeChatModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => { taRef.current?.focus(); }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const modalStyle: React.CSSProperties = fullscreen
    ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : { top: 60, left: "4%", right: "4%", bottom: "4%", borderRadius: 20 };

  return (
    <>
      <div
        className="fixed inset-0 z-[65]"
        style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <div
        className="fixed z-[66] flex flex-col overflow-hidden"
        style={{
          ...modalStyle,
          background: "rgba(6,8,12,0.99)",
          border: `1px solid rgba(${ORANGE_RGB},0.32)`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.85), 0 0 32px rgba(${ORANGE_RGB},0.12)`,
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderBottom: `1px solid rgba(${ORANGE_RGB},0.18)` }}
        >
          <ClaudeIcon size={20} color={ORANGE} />
          <h2 className="text-sm font-bold" style={{ color: ORANGE }}>Chat with Claude</h2>
          <span className="text-[10px] text-white/30">claude-opus-4-6</span>
          <div className="flex-1" />
          <button
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-30"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)" }}
          >Clear</button>
          <button
            onClick={() => setFullscreen((p) => !p)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >{fullscreen ? "⊡" : "⊞"}</button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10 transition-all"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >✕</button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: "thin" }}>
          {messages.length === 0 && (
            <div className="text-center text-white/30 text-sm pt-12">
              Start a conversation. Press <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px]">Shift+Enter</kbd> for newline.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: m.role === "user" ? "#00bfff" : ORANGE }}>
                {m.role === "user" ? "You" : "Claude"}
              </span>
              {m.role === "assistant" ? (
                <div
                  className="md-content text-sm text-white/85 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ) : (
                <div className="text-sm text-white/85 leading-relaxed whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: ORANGE }} />
              Claude is thinking…
            </div>
          )}
          {error && (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-5 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask Claude anything…"
              rows={2}
              className="flex-1 bg-transparent outline-none text-sm text-white/90 rounded-lg px-3 py-2 resize-none"
              style={{ border: "1px solid rgba(255,255,255,0.12)" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-30"
              style={{
                background: `rgba(${ORANGE_RGB},0.18)`,
                border: `1px solid rgba(${ORANGE_RGB},0.45)`,
                color: ORANGE,
              }}
            >Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
