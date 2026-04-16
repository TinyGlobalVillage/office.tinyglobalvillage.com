"use client";

import { useState, useEffect, useCallback } from "react";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";

const ORANGE = "#d97757";
const ORANGE_RGB = "217,119,87";

type FileItem = {
  kind: "root" | "vocab";
  name: string;
  bytes: number;
  mtime: number;
  exists: boolean;
  deletable: boolean;
};

const NEW_TERM_TEMPLATE = (term: string) => `---
name: ${term}
description: <one-line description used as the index hook — be specific>
---

# ${term}

<Definition: what is it?>

**Key visual / behavioral traits:**
-

**Canonical implementation (refusionist):** \`<path>\`

**Related:**
`;

export default function ClaudeVocabModal({ onClose }: { onClose: () => void }) {
  const [terms, setTerms] = useState<FileItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingTerm, setLoadingTerm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTermName, setNewTermName] = useState("");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setTerms(data.items.filter((i: FileItem) => i.kind === "vocab"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadTerm = useCallback(async (name: string) => {
    setActive(name);
    setLoadingTerm(true);
    setEditing(false);
    setCreating(false);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(data.content);
      setDraft(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingTerm(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        if (creating) { setCreating(false); setNewTermName(""); return; }
        if (editing) { setEditing(false); setDraft(content); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, editing, creating, content]);

  async function save() {
    if (!active) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: active, content: draft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(draft);
      setEditing(false);
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createTerm() {
    const safe = newTermName.trim().replace(/[^A-Za-z0-9_-]/g, "");
    if (!safe) { setError("Name must be alphanumeric (also _ -)"); return; }
    const file = `vocabulary/${safe}.md`;
    if (terms.some((t) => t.name === file)) { setError(`${safe} already exists`); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file, content: NEW_TERM_TEMPLATE(safe) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setCreating(false);
      setNewTermName("");
      await loadList();
      await loadTerm(file);
      setEditing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!active) return;
    if (!confirm(`Delete ${active}? This cannot be undone. Don't forget to also remove its entries from VOCABULARY.md and VOCABULARY-SUMMARIES.md (Files tab).`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(active)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setActive(null);
      setContent("");
      setDraft("");
      loadList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const modalStyle: React.CSSProperties = fullscreen
    ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : { top: 60, left: "4%", right: "4%", bottom: "4%", borderRadius: 20 };

  const activeItem = terms.find((i) => i.name === active);
  const displayName = (n: string) => n.replace(/^vocabulary\//, "").replace(/\.md$/, "");

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
          <h2 className="text-sm font-bold" style={{ color: ORANGE }}>Vocabulary</h2>
          <span className="text-[10px] text-white/30 font-mono">~/.claude/vocabulary/</span>
          <div className="flex-1" />
          <button
            onClick={() => { setCreating(true); setActive(null); setError(null); }}
            className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
            style={{ background: `rgba(${ORANGE_RGB},0.14)`, border: `1px solid rgba(${ORANGE_RGB},0.4)`, color: ORANGE }}
          >+ New term</button>
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

        <div className="flex-1 grid grid-cols-[220px_1fr] overflow-hidden">
          {/* Sidebar */}
          <div
            className="overflow-y-auto p-3 flex flex-col gap-1"
            style={{ borderRight: "1px solid rgba(255,255,255,0.07)", scrollbarWidth: "thin" }}
          >
            {loadingList ? (
              <div className="text-white/30 text-xs px-3 py-2">Loading…</div>
            ) : terms.length === 0 ? (
              <div className="text-white/30 text-xs px-3 py-2">No vocabulary terms yet.</div>
            ) : (
              terms.map((t) => (
                <button
                  key={t.name}
                  onClick={() => loadTerm(t.name)}
                  className="text-left px-3 py-1.5 rounded-md transition-all"
                  style={{
                    background: active === t.name ? `rgba(${ORANGE_RGB},0.14)` : "transparent",
                    border: active === t.name ? `1px solid rgba(${ORANGE_RGB},0.3)` : "1px solid transparent",
                    color: active === t.name ? ORANGE : "rgba(255,255,255,0.7)",
                  }}
                  onMouseEnter={(e) => { if (active !== t.name) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={(e) => { if (active !== t.name) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <span className="text-xs font-mono">{displayName(t.name)}</span>
                </button>
              ))
            )}
          </div>

          {/* Main pane */}
          <div className="flex flex-col overflow-hidden">
            {creating ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                <h3 className="text-sm font-bold" style={{ color: ORANGE }}>Create new vocabulary term</h3>
                <p className="text-xs text-white/45 max-w-md text-center">
                  Term name = filename. Use PascalCase or short codes (Lightswitch, QMBM, ECL). Letters, digits, underscore, hyphen only.
                </p>
                <input
                  type="text"
                  value={newTermName}
                  onChange={(e) => setNewTermName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTerm(); }}
                  placeholder="TermName"
                  autoFocus
                  className="w-64 bg-transparent outline-none text-sm text-white/90 rounded-lg px-3 py-2 text-center"
                  style={{ border: `1px solid rgba(${ORANGE_RGB},0.4)` }}
                />
                {error && (
                  <div className="text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>{error}</div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCreating(false); setNewTermName(""); setError(null); }}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}
                  >Cancel</button>
                  <button
                    onClick={createTerm}
                    disabled={saving || !newTermName.trim()}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider disabled:opacity-40"
                    style={{ background: `rgba(${ORANGE_RGB},0.2)`, border: `1px solid rgba(${ORANGE_RGB},0.5)`, color: ORANGE }}
                  >{saving ? "Creating…" : "Create"}</button>
                </div>
              </div>
            ) : !active ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                Select a term to view, or create a new one.
              </div>
            ) : loadingTerm ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Loading…</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xs text-white/70 font-mono truncate flex-1">{displayName(active)}</span>
                  {activeItem && (
                    <span className="text-[10px] text-white/30">{(activeItem.bytes / 1024).toFixed(1)} KB</span>
                  )}
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
                    <>
                      <button
                        onClick={() => setEditing(true)}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                        style={{ background: `rgba(${ORANGE_RGB},0.1)`, border: `1px solid rgba(${ORANGE_RGB},0.3)`, color: ORANGE }}
                      >Edit</button>
                      <button
                        onClick={del}
                        disabled={saving}
                        className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}
                      >Delete</button>
                    </>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: "thin" }}>
                  {error && (
                    <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                      {error}
                    </div>
                  )}
                  {editing ? (
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      spellCheck={false}
                      className="w-full bg-transparent outline-none text-xs text-white/85 font-mono resize-none rounded-lg px-3 py-2"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", minHeight: 400 }}
                    />
                  ) : (
                    <div
                      className="md-content text-sm text-white/85 leading-relaxed max-w-3xl"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
