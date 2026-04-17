"use client";

import { useState, useRef, useEffect } from "react";

const ORANGE = "#d97757";
const ORANGE_RGB = "217,119,87";
const CYAN = "#00bfff";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  componentKey: string;
  currentCode: string;
  onCodeUpdate: (code: string) => void;
  onDeploy: (targets: string[]) => void;
};

export default function SandboxClaudeDrawer({ componentKey, currentCode, onCodeUpdate, onDeploy }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && !loading) inputRef.current?.focus();
  }, [open, loading]);

  useEffect(() => {
    setMessages([]);
    setError("");
  }, [componentKey]);

  function parseActions(text: string) {
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) return;
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action === "updateCode" && parsed.code) {
        onCodeUpdate(parsed.code);
      } else if (parsed.action === "deploy") {
        onDeploy(parsed.targets || ["all"]);
      }
    } catch { /* not valid JSON, ignore */ }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setError("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/sandbox/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentKey,
          currentCode,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const reply: Message = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, reply]);
      parseActions(data.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-t-xl transition-all"
        style={{
          background: `rgba(${ORANGE_RGB},0.08)`,
          border: `1px solid rgba(${ORANGE_RGB},0.25)`,
          borderBottom: "none",
          color: ORANGE,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ fontSize: 14 }}>🤖</span> Claude
      </button>
    );
  }

  return (
    <div
      className="flex flex-col rounded-t-xl overflow-hidden"
      style={{
        height: 320,
        background: "rgba(6,8,12,0.98)",
        border: `1px solid rgba(${ORANGE_RGB},0.3)`,
        borderBottom: "none",
        boxShadow: `0 -8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(${ORANGE_RGB},0.08)`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-2 shrink-0"
        style={{ borderBottom: `1px solid rgba(${ORANGE_RGB},0.2)` }}
      >
        <span style={{ fontSize: 14 }}>🤖</span>
        <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: ORANGE }}>
          Sandbox Claude
        </span>
        <span className="text-[10px] text-white/30 font-mono">{componentKey}</span>
        <div className="flex-1" />
        <button
          onClick={() => { setMessages([]); setError(""); }}
          className="text-[10px] text-white/40 hover:text-white/70 px-2 py-1 rounded"
          title="Clear chat"
        >
          Clear
        </button>
        <button
          onClick={() => setOpen(false)}
          className="w-6 h-6 rounded flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5"
          title="Minimize"
        >
          ▾
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollbarWidth: "thin" }}>
        {messages.length === 0 && !loading && (
          <div className="text-xs text-white/25 text-center py-4">
            Ask me to change colors, adjust spacing, add features, or deploy this component.
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className="mb-3">
              <div
                className="text-[9px] font-bold uppercase tracking-widest mb-1"
                style={{ color: isUser ? "#ff4ecb" : ORANGE }}
              >
                {isUser ? "You" : "Claude"}
              </div>
              <div
                className="text-xs leading-relaxed rounded-lg px-3 py-2"
                style={{
                  background: isUser ? "rgba(255,78,203,0.04)" : `rgba(${ORANGE_RGB},0.04)`,
                  borderLeft: `2px solid ${isUser ? "rgba(255,78,203,0.3)" : `rgba(${ORANGE_RGB},0.3)`}`,
                  color: "rgba(255,255,255,0.75)",
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex items-center gap-2 text-xs" style={{ color: ORANGE }}>
            <span className="animate-pulse">●</span> Thinking…
          </div>
        )}
        {error && (
          <div className="text-xs text-red-400 mt-2">{error}</div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-3 py-2 flex gap-2 items-end" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              handleSend();
            }
          }}
          placeholder="Change the border to cyan, make the text bigger…"
          rows={1}
          className="flex-1 rounded-lg px-3 py-2 text-xs text-white outline-none resize-none placeholder:text-white/25"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid rgba(${ORANGE_RGB},0.2)`,
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="px-3 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-30"
          style={{
            background: `rgba(${ORANGE_RGB},0.15)`,
            border: `1px solid rgba(${ORANGE_RGB},0.3)`,
            color: ORANGE,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
