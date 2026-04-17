"use client";

import { useState, useEffect, useRef } from "react";

const ACCENT = "#ff4ecb";
const ACCENT_RGB = "255,78,203";
const CYAN = "#00bfff";

type Message = { role: "user" | "assistant"; content: string };

type Phase = "form" | "chat" | "sent";

export default function SuggestionBoxModal({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("form");
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const PAGE_SIZE = 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (phase === "chat" && !loading) inputRef.current?.focus();
  }, [phase, loading]);

  async function handleSubmitForm() {
    if (!featureName.trim() || !description.trim()) return;
    setLoading(true);
    setError("");
    setPhase("chat");
    const userMsg: Message = { role: "user", content: description };
    setMessages([userMsg]);

    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          featureName,
          messages: [userMsg],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setError("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          featureName,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendToAdmin() {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          featureName,
          description,
          conversation: messages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setPhase("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const totalPages = assistantMessages.length;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleAssistant = totalPages > 0 ? assistantMessages[totalPages - 1 - safePage] : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98))",
          border: `1px solid rgba(${ACCENT_RGB},0.25)`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(${ACCENT_RGB},0.15)`,
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h2
                className="text-xl font-bold"
                style={{ color: ACCENT, textShadow: `0 0 12px rgba(${ACCENT_RGB},0.5)` }}
              >
                SuggestionBox
              </h2>
              <p className="text-xs text-white/40">
                {phase === "form" && "Describe your feature idea"}
                {phase === "chat" && "Refine your idea with Claude"}
                {phase === "sent" && "Suggestion sent!"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Phase: Form */}
          {phase === "form" && (
            <div className="flex flex-col gap-4">
              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: ACCENT }}
                >
                  Proposed name of feature
                </label>
                <input
                  value={featureName}
                  onChange={(e) => setFeatureName(e.target.value)}
                  placeholder="e.g. Client Dashboard Analytics"
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT_RGB},0.5)`)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT_RGB},0.2)`)}
                />
              </div>
              <div>
                <label
                  className="block text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: ACCENT }}
                >
                  Describe your feature
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What should this feature do? Who is it for? What problem does it solve?"
                  rows={5}
                  className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 resize-none transition-colors"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT_RGB},0.5)`)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = `rgba(${ACCENT_RGB},0.2)`)}
                />
              </div>
              <button
                onClick={handleSubmitForm}
                disabled={!featureName.trim() || !description.trim()}
                className="self-end px-6 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                  color: "#fff",
                  boxShadow: `0 4px 20px rgba(${ACCENT_RGB},0.3)`,
                }}
              >
                Generate Plan with Claude
              </button>
            </div>
          )}

          {/* Phase: Chat */}
          {phase === "chat" && (
            <div className="flex flex-col gap-4">
              {/* Feature name badge */}
              <div
                className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: `rgba(${ACCENT_RGB},0.08)`,
                  border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                  color: ACCENT,
                }}
              >
                💡 {featureName}
              </div>

              {/* Claude response area — GPG (most recent first) */}
              {visibleAssistant && (
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: "rgba(0,191,255,0.04)",
                    border: `1px solid rgba(0,191,255,0.15)`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: CYAN }}
                    >
                      Claude AI
                    </span>
                    {totalPages > 1 && (
                      <span className="text-[10px] text-white/30 ml-auto">
                        Response {totalPages - safePage} of {totalPages}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-sm text-white/80 leading-relaxed prose prose-invert prose-sm max-w-none"
                    style={{ whiteSpace: "pre-wrap" }}
                  >
                    {visibleAssistant.content}
                  </div>
                </div>
              )}

              {/* GPG paginator for assistant messages */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    ‹
                  </button>
                  <span className="text-xs font-mono text-white/60 tabular-nums">
                    {safePage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage === totalPages - 1}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all disabled:opacity-30"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    ›
                  </button>
                </div>
              )}

              {/* Loading indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-xs" style={{ color: CYAN }}>
                  <span className="animate-pulse">●</span> Claude is thinking…
                </div>
              )}

              {/* User messages history (collapsed) */}
              {messages.filter((m) => m.role === "user").length > 1 && (
                <details className="text-xs text-white/30">
                  <summary className="cursor-pointer hover:text-white/50 transition-colors">
                    Your messages ({messages.filter((m) => m.role === "user").length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-2">
                    {messages
                      .filter((m) => m.role === "user")
                      .reverse()
                      .map((m, i) => (
                        <div
                          key={i}
                          className="rounded-lg p-3"
                          style={{
                            background: "rgba(255,78,203,0.04)",
                            borderLeft: `2px solid rgba(${ACCENT_RGB},0.3)`,
                          }}
                        >
                          <p className="text-white/50 text-xs">{m.content}</p>
                        </div>
                      ))}
                  </div>
                </details>
              )}

              {/* Follow-up input */}
              {!loading && (
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask a follow-up or refine the plan…"
                    rows={2}
                    className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 resize-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid rgba(${ACCENT_RGB},0.2)`,
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!input.trim()}
                    className="px-4 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
                    style={{
                      background: `rgba(${ACCENT_RGB},0.15)`,
                      border: `1px solid rgba(${ACCENT_RGB},0.3)`,
                      color: ACCENT,
                    }}
                  >
                    ↑
                  </button>
                </div>
              )}

              {/* Send to admin button */}
              {assistantMessages.length > 0 && !loading && (
                <button
                  onClick={handleSendToAdmin}
                  disabled={sending}
                  className="self-center px-6 py-2.5 rounded-xl text-sm font-bold transition-all mt-2"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
                    color: "#fff",
                    boxShadow: `0 4px 20px rgba(${ACCENT_RGB},0.3)`,
                    opacity: sending ? 0.5 : 1,
                  }}
                >
                  {sending ? "Sending…" : "Send to admin team"}
                </button>
              )}
            </div>
          )}

          {/* Phase: Sent */}
          {phase === "sent" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <span className="text-5xl">✅</span>
              <h3 className="text-lg font-bold" style={{ color: ACCENT }}>
                Suggestion sent!
              </h3>
              <p className="text-sm text-white/50 text-center max-w-sm">
                Your feature suggestion for <strong style={{ color: ACCENT }}>{featureName}</strong> has
                been emailed to the admin team with the full conversation and implementation plan.
              </p>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl text-sm font-bold mt-4 transition-colors"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                Close
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="mt-3 rounded-lg px-4 py-2 text-xs"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                color: "#ef4444",
              }}
            >
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>
    </div>
  );
}
