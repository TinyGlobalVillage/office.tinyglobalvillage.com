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

export default function ClaudeFilesModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [view, setView] = useState<"rendered" | "raw">("rendered");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch("/api/claude/files");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadFile = useCallback(async (name: string) => {
    setActive(name);
    setLoadingFile(true);
    setEditing(false);
    setError(null);
    try {
      const res = await fetch(`/api/claude/files?file=${encodeURIComponent(name)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      setContent(data.content);
      setDraft(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
      setContent("");
      setDraft("");
    } finally {
      setLoadingFile(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

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

  async function del() {
    if (!active) return;
    if (!confirm(`Delete ${active}? This cannot be undone.`)) return;
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

  const activeItem = items.find((i) => i.name === active);

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
          <h2 className="text-sm font-bold" style={{ color: ORANGE }}>Global Claude Files</h2>
          <span className="text-[10px] text-white/30 font-mono">~/.claude/</span>
          <div className="flex-1" />
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

        <div className="flex-1 grid grid-cols-[260px_1fr] overflow-hidden">
          {/* Sidebar */}
          <div
            className="overflow-y-auto p-3 flex flex-col gap-1"
            style={{ borderRight: "1px solid rgba(255,255,255,0.07)", scrollbarWidth: "thin" }}
          >
            {loadingList ? (
              <div className="text-white/30 text-xs px-3 py-2">Loading…</div>
            ) : items.length === 0 ? (
              <div className="text-white/30 text-xs px-3 py-2">No files</div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-widest text-white/30 px-2 pt-1 pb-1">Indices</div>
                {items.filter((i) => i.kind === "root").map((it) => (
                  <FileRow key={it.name} item={it} active={active === it.name} onClick={() => loadFile(it.name)} />
                ))}
                <div className="text-[10px] uppercase tracking-widest text-white/30 px-2 pt-3 pb-1">Vocabulary</div>
                {items.filter((i) => i.kind === "vocab").map((it) => (
                  <FileRow key={it.name} item={it} active={active === it.name} onClick={() => loadFile(it.name)} />
                ))}
              </>
            )}
          </div>

          {/* Main pane */}
          <div className="flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
                Select a file to view or edit.
              </div>
            ) : loadingFile ? (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Loading…</div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="text-xs text-white/70 font-mono truncate flex-1">{active}</span>
                  {activeItem && (
                    <span className="text-[10px] text-white/30">{(activeItem.bytes / 1024).toFixed(1)} KB</span>
                  )}
                  <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                    {(["rendered", "raw"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        disabled={editing}
                        className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                        style={{
                          background: view === v ? `rgba(${ORANGE_RGB},0.2)` : "transparent",
                          color: view === v ? ORANGE : "rgba(255,255,255,0.55)",
                        }}
                      >{v}</button>
                    ))}
                  </div>
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
                      {activeItem?.deletable && (
                        <button
                          onClick={del}
                          disabled={saving}
                          className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}
                        >Delete</button>
                      )}
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
                  ) : view === "rendered" ? (
                    <div
                      className="md-content text-sm text-white/85 leading-relaxed max-w-3xl"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
                    />
                  ) : (
                    <pre className="text-xs text-white/75 font-mono whitespace-pre-wrap break-words">{content}</pre>
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

function FileRow({ item, active, onClick }: { item: FileItem; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left px-3 py-1.5 rounded-md transition-all flex items-center gap-2"
      style={{
        background: active ? `rgba(${ORANGE_RGB},0.14)` : "transparent",
        border: active ? `1px solid rgba(${ORANGE_RGB},0.3)` : "1px solid transparent",
        color: active ? ORANGE : "rgba(255,255,255,0.7)",
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span className="text-xs font-mono truncate flex-1">{item.name.replace(/^vocabulary\//, "")}</span>
      {!item.exists && <span className="text-[9px] text-white/30">missing</span>}
    </button>
  );
}
