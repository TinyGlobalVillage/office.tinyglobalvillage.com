"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import SandboxIcon from "./SandboxIcon";
import { REGISTRY, CATEGORIES, type SandboxEntry } from "./registry";
import { useDraftStore } from "./useDraftStore";
import SandboxEditToolbar from "./SandboxEditToolbar";

const PINK = "#ff4ecb";
const PINK_RGB = "255,78,203";
const GOLD = "#f7b700";
const GOLD_RGB = "247,183,0";

export default function SandboxModal({ onClose }: { onClose: () => void }) {
  const [activeKey, setActiveKey] = useState<string>(REGISTRY[0]?.key ?? "");
  const [fsOpen, setFsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string>("");

  // ── Edit mode state ────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [unsavedCode, setUnsavedCode] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftAsc, setDraftAsc] = useState(true);
  const draftSbdmRef = useRef<HTMLDivElement | null>(null);

  const active: SandboxEntry | undefined = useMemo(
    () => REGISTRY.find((e) => e.key === activeKey),
    [activeKey]
  );

  const drafts = useDraftStore(activeKey, active?.code ?? "");

  // Detect admin
  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  // Load project list (used by deploy SBDM)
  useEffect(() => {
    if (!editMode) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d.map((p: { name: string }) => ({ name: p.name })) : []))
      .catch(() => setProjects([]));
  }, [editMode]);

  // Reset code draft on file switch (read-only mode preserves original behavior)
  useEffect(() => {
    setCodeDraft(active?.code ?? "");
    setUnsavedCode(null);
  }, [active]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (draftPickerOpen) { setDraftPickerOpen(false); return; }
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, draftPickerOpen]);

  useEffect(() => {
    if (!draftPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (draftSbdmRef.current && !draftSbdmRef.current.contains(e.target as Node)) setDraftPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [draftPickerOpen]);

  const modalStyle: React.CSSProperties = fullscreen
    ? { top: 0, left: 0, right: 0, bottom: 0, borderRadius: 0 }
    : { top: 60, left: "4%", right: "4%", bottom: "4%", borderRadius: 20 };

  const grouped = useMemo(() => {
    const m: Record<string, SandboxEntry[]> = {};
    for (const c of CATEGORIES) m[c] = [];
    for (const e of REGISTRY) m[e.category].push(e);
    return m;
  }, []);

  const Demo = active?.Demo;

  // Editing — what code is currently displayed in the editor?
  const editorCode = editMode && drafts.active
    ? (unsavedCode ?? drafts.active.code)
    : codeDraft;

  // Auto-save: when autoSave on, push edits straight into draft history
  const handleCodeChange = (next: string) => {
    if (editMode && drafts.active) {
      if (autoSave) {
        drafts.writeCode(next);
        setUnsavedCode(null);
      } else {
        setUnsavedCode(next);
      }
    } else {
      setCodeDraft(next);
    }
  };

  const handleManualSave = () => {
    if (!editMode || !drafts.active || unsavedCode == null) return;
    drafts.writeCode(unsavedCode);
    setUnsavedCode(null);
  };

  const isSaved = editMode && drafts.active ? unsavedCode == null : true;

  const handleEnterEditMode = () => {
    setEditMode(true);
    if (!drafts.active) drafts.startNewDraft();
    setCodeOpen(true);
  };

  const handleDeploy = async ({ targets, preview }: { targets?: string[]; preview?: boolean }) => {
    const res = await fetch("/api/sandbox/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components: ["@tgv/ui"], targets, preview }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
  };

  const filteredDrafts = drafts.drafts
    .filter((d) => `Draft #${d.number}`.toLowerCase().includes(draftSearch.toLowerCase()))
    .slice()
    .sort((a, b) => draftAsc ? a.number - b.number : b.number - a.number);

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
          border: `1px solid rgba(${editMode ? GOLD_RGB : PINK_RGB},0.32)`,
          boxShadow: `0 24px 80px rgba(0,0,0,0.85), 0 0 32px rgba(${editMode ? GOLD_RGB : PINK_RGB},0.12)`,
          transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: `1px solid rgba(${editMode ? GOLD_RGB : PINK_RGB},0.18)` }}>
          <SandboxIcon size={22} color={editMode ? GOLD : PINK} />
          <h2 className="text-sm font-bold" style={{ color: editMode ? GOLD : PINK }}>
            Sandbox{editMode ? " · Editing" : ""}
          </h2>
          <span className="text-[10px] text-white/30 font-mono">Component Reference · {REGISTRY.length} entries</span>

          {/* Drafts SBDM (admin + drafts exist) */}
          {isAdmin && drafts.drafts.length > 0 && (
            <div ref={draftSbdmRef} className="relative">
              <button
                onClick={() => setDraftPickerOpen((v) => !v)}
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1"
                style={{ background: `rgba(${GOLD_RGB},0.08)`, border: `1px solid rgba(${GOLD_RGB},0.3)`, color: GOLD }}
                title="Pick a draft or live"
              >
                {drafts.active ? `Draft #${drafts.active.number}` : "Live"}
                <span style={{ fontSize: 8 }}>▾</span>
              </button>
              {draftPickerOpen && (
                <div
                  className="absolute left-0 top-full mt-2 rounded-xl overflow-hidden z-[80]"
                  style={{
                    minWidth: 240,
                    background: "rgba(8,10,16,0.98)",
                    border: `1px solid rgba(${GOLD_RGB},0.3)`,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
                  }}
                >
                  <div className="flex items-center gap-2 p-2 border-b border-white/5">
                    <input
                      autoFocus
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      placeholder="Search drafts…"
                      className="flex-1 bg-white/5 rounded-md px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
                    />
                    <button
                      onClick={() => setDraftAsc((v) => !v)}
                      className="px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wider"
                      style={{ background: "rgba(0,191,255,0.08)", border: "1px solid rgba(0,191,255,0.3)", color: "#00bfff" }}
                    >{draftAsc ? "Z-A" : "A-Z"}</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => { drafts.closeDraft(); setEditMode(false); setDraftPickerOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5 flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#4ade80" }} />
                      <span>Live (deployed)</span>
                    </button>
                    {filteredDrafts.map((d) => (
                      <div key={d.id} className="flex items-center hover:bg-white/5">
                        <button
                          onClick={() => { drafts.openDraft(d.id); setEditMode(true); setDraftPickerOpen(false); }}
                          className="flex-1 text-left px-3 py-2 text-xs text-white/70"
                        >
                          <span className="font-mono" style={{ color: GOLD }}>Draft #{d.number}</span>
                          <span className="ml-2 text-[10px] text-white/35">{new Date(d.updatedAt).toLocaleString()}</span>
                        </button>
                        <button
                          onClick={() => drafts.deleteDraft(d.id)}
                          title="Delete draft"
                          className="px-2 py-2 text-white/30 hover:text-red-400 text-xs"
                        >✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Edit Mode toggle (admin only) */}
          {isAdmin && (
            <button
              onClick={() => editMode ? (setEditMode(false), drafts.closeDraft()) : handleEnterEditMode()}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: editMode ? `rgba(${GOLD_RGB},0.18)` : "rgba(255,255,255,0.04)",
                border: `1px solid ${editMode ? `rgba(${GOLD_RGB},0.5)` : "rgba(255,255,255,0.15)"}`,
                color: editMode ? GOLD : "rgba(255,255,255,0.55)",
              }}
            >✎ {editMode ? "Exit Edit" : "Edit Mode"}</button>
          )}

          <button
            onClick={() => setFsOpen((p) => !p)}
            title={fsOpen ? "Hide files" : "Show files"}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            style={{ background: fsOpen ? `rgba(${PINK_RGB},0.14)` : "rgba(255,255,255,0.04)", border: `1px solid ${fsOpen ? `rgba(${PINK_RGB},0.45)` : "rgba(255,255,255,0.15)"}`, color: fsOpen ? PINK : "rgba(255,255,255,0.55)" }}
          >📁 Files</button>
          <button
            onClick={() => setCodeOpen((p) => !p)}
            title={codeOpen ? "Hide code" : "Show code"}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider"
            style={{ background: codeOpen ? `rgba(${PINK_RGB},0.14)` : "rgba(255,255,255,0.04)", border: `1px solid ${codeOpen ? `rgba(${PINK_RGB},0.45)` : "rgba(255,255,255,0.15)"}`, color: codeOpen ? PINK : "rgba(255,255,255,0.55)" }}
          >{"</>"} Code</button>
          <button
            onClick={() => setFullscreen((p) => !p)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >{fullscreen ? "⊡" : "⊞"}</button>
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="w-7 h-7 rounded-md flex items-center justify-center text-xs hover:bg-white/10"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >✕</button>
        </div>

        {/* Edit toolbar (admin + edit mode) */}
        {isAdmin && editMode && (
          <SandboxEditToolbar
            active={drafts.active}
            autoSave={autoSave}
            setAutoSave={setAutoSave}
            onSave={handleManualSave}
            onUndo={drafts.undo}
            onRedo={drafts.redo}
            canUndo={drafts.canUndo}
            canRedo={drafts.canRedo}
            onResetToDeployed={drafts.resetToDeployed}
            isSaved={isSaved}
            componentKey={activeKey}
            projects={projects}
            onDeploy={handleDeploy}
          />
        )}

        {/* Body: FS | (Summary + Viewport) | Code */}
        <div className="flex-1 flex overflow-hidden">
          {/* ── FS drawer ───────────────────────────────── */}
          {fsOpen && (
            <div
              className="flex flex-col flex-shrink-0 overflow-y-auto py-3 px-2"
              style={{ width: 240, borderRight: "1px solid rgba(255,255,255,0.07)", scrollbarWidth: "thin" }}
            >
              {CATEGORIES.map((cat) => (
                <div key={cat} className="mb-3">
                  <div className="text-[9px] uppercase tracking-[0.18em] text-white/30 font-bold px-2 mb-1">{cat}</div>
                  <div className="flex flex-col gap-0.5">
                    {grouped[cat].map((e) => (
                      <button
                        key={e.key}
                        onClick={() => setActiveKey(e.key)}
                        className="text-left px-2.5 py-1.5 rounded-md transition-all"
                        style={{
                          background: activeKey === e.key ? `rgba(${PINK_RGB},0.14)` : "transparent",
                          border: activeKey === e.key ? `1px solid rgba(${PINK_RGB},0.35)` : "1px solid transparent",
                          color: activeKey === e.key ? PINK : "rgba(255,255,255,0.7)",
                        }}
                        onMouseEnter={(ev) => { if (activeKey !== e.key) (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={(ev) => { if (activeKey !== e.key) (ev.currentTarget as HTMLElement).style.background = "transparent"; }}
                      >
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[11px] font-mono font-bold">{e.key}</span>
                          <span className="text-[10px] truncate" style={{ color: activeKey === e.key ? `rgba(${PINK_RGB},0.7)` : "rgba(255,255,255,0.35)" }}>{e.name.replace(`${e.key} — `, "").replace(e.key, "").trim() || e.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Center: summary + viewport ───────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {active ? (
              <>
                {/* Summary drawer */}
                <div
                  className="flex-shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: `rgba(${PINK_RGB},0.03)` }}
                >
                  <button
                    onClick={() => setSummaryOpen((p) => !p)}
                    className="w-full flex items-center gap-3 px-5 py-2 text-left"
                  >
                    <span style={{ color: PINK, fontSize: 11, fontWeight: 700 }}>{summaryOpen ? "▾" : "▸"}</span>
                    <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: PINK }}>Summary</span>
                    <span className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>· {active.key} — {active.name}</span>
                    <span className="flex-1" />
                    <span className="text-[9px] uppercase tracking-wider text-white/30">{active.category}</span>
                  </button>
                  {summaryOpen && (
                    <div className="px-5 pb-4 max-w-4xl">
                      <p className="text-[12px] text-white/75 leading-relaxed mb-2">{active.summary}</p>
                      <div className="text-[11px] text-white/55 leading-relaxed">
                        <span className="font-bold uppercase tracking-wider text-[9px] mr-2" style={{ color: PINK }}>Usage</span>
                        {active.usage}
                      </div>
                    </div>
                  )}
                </div>

                {/* Viewport */}
                <div
                  className="flex-1 overflow-auto p-8 flex items-start justify-center"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                >
                  <div className="w-full max-w-2xl flex flex-col items-center justify-center" style={{ minHeight: "100%" }}>
                    {Demo && <Demo />}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-white/30 text-sm">Select a component.</div>
            )}
          </div>

          {/* ── Code drawer ─────────────────────────────── */}
          {codeOpen && active && (
            <div
              className="flex flex-col flex-shrink-0 overflow-hidden"
              style={{ width: 420, borderLeft: "1px solid rgba(255,255,255,0.07)", background: "rgba(4,6,10,0.7)" }}
            >
              <div className="flex items-center gap-2 px-4 py-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: editMode ? GOLD : PINK }}>Code</span>
                <span className="text-[9px] font-mono text-white/35">{active.key}.tsx</span>
                <span className="flex-1" />
                <button
                  onClick={() => editMode ? drafts.resetToDeployed() : setCodeDraft(active.code)}
                  className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.55)" }}
                  title="Restore canonical / deployed code"
                >Reset</button>
              </div>
              <textarea
                value={editorCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                spellCheck={false}
                className="flex-1 bg-transparent outline-none text-[11px] font-mono p-3 resize-none"
                style={{ color: "rgba(255,255,255,0.85)", scrollbarWidth: "thin", lineHeight: 1.55 }}
              />
              <div className="px-4 py-2 text-[9px] uppercase tracking-wider flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>
                {editMode && drafts.active
                  ? `Draft #${drafts.active.number} · ${isSaved ? "saved" : "unsaved"} · auto-save ${autoSave ? "on" : "off"}`
                  : "Edits reset on file switch · not saved"}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
