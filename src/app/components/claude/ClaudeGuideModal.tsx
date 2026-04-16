"use client";

import { useState, useEffect } from "react";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";

const ORANGE = "#d97757";
const ORANGE_RGB = "217,119,87";

export default function ClaudeGuideModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    fetch("/api/claude/guide")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error ?? `HTTP ${r.status}`);
        setContent(d.content);
        setDraft(d.content);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Load failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        if (editing) { setEditing(false); setDraft(content); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, editing, content]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/guide", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(draft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
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
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid rgba(${ORANGE_RGB},0.18)` }}>
          <ClaudeIcon size={20} color={ORANGE} />
          <h2 className="text-sm font-bold" style={{ color: ORANGE }}>Learn Claude Guide</h2>
          <span className="text-[10px] text-white/30 font-mono">CLAUDE-GUIDE.md</span>
          <div className="flex-1" />
          {editing ? (
            <>
              <button
                onClick={() => { setEditing(false); setDraft(content); }}
                disabled={saving}
                className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
              >Cancel</button>
              <button
                onClick={save}
                disabled={saving || draft === content}
                className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                style={{ background: `rgba(${ORANGE_RGB},0.2)`, border: `1px solid rgba(${ORANGE_RGB},0.5)`, color: ORANGE }}
              >{saving ? "Saving…" : "Save"}</button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              disabled={loading}
              className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{ background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.3)`, color: ORANGE }}
            >Edit</button>
          )}
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

        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "thin" }}>
          {loading ? (
            <div className="text-center text-white/30 text-sm pt-12">Loading guide…</div>
          ) : error ? (
            <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
              {error}
            </div>
          ) : editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="w-full h-full bg-transparent outline-none text-xs text-white/85 font-mono resize-none rounded-lg px-3 py-2"
              style={{ border: "1px solid rgba(255,255,255,0.12)", minHeight: 400 }}
            />
          ) : (
            <div
              className="md-content text-sm text-white/85 leading-relaxed max-w-3xl"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>
      </div>
    </>
  );
}
