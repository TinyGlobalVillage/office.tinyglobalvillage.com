"use client";

import { useEffect, useRef, useState } from "react";
import type { Draft } from "./useDraftStore";

const PINK = "#ff4ecb";
const PINK_RGB = "255,78,203";
const GOLD = "#f7b700";
const GOLD_RGB = "247,183,0";
const CYAN = "#00bfff";
const CYAN_RGB = "0,191,255";

type Props = {
  active: Draft | null;
  autoSave: boolean;
  setAutoSave: (v: boolean) => void;
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onResetToDeployed: () => void;
  isSaved: boolean;
  componentKey: string;
  projects: { name: string }[];
  onDeploy: (opts: { targets?: string[]; preview?: boolean }) => Promise<void>;
};

export default function SandboxEditToolbar(p: Props) {
  const [deployOpen, setDeployOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerAsc, setPickerAsc] = useState(true);
  const [deploying, setDeploying] = useState<"none" | "deploy" | "preview">("none");
  const [statusMsg, setStatusMsg] = useState("");
  const ddmRef = useRef<HTMLDivElement>(null);
  const sbdmRef = useRef<HTMLDivElement>(null);

  // Close DDM/SBDM on outside click + Esc
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ddmRef.current && !ddmRef.current.contains(e.target as Node)) setDeployOpen(false);
      if (sbdmRef.current && !sbdmRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDeployOpen(false); setPickerOpen(false); }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const canDeploy = p.isSaved && !!p.active;

  const runDeploy = async (opts: { targets?: string[]; preview?: boolean }) => {
    setDeploying(opts.preview ? "preview" : "deploy");
    setStatusMsg("");
    try {
      await p.onDeploy(opts);
      setStatusMsg(opts.preview ? "Preview triggered" : `Deploy triggered${opts.targets ? ` → ${opts.targets.join(", ")}` : " → all"}`);
    } catch (e: unknown) {
      setStatusMsg(`Failed: ${(e as Error).message}`);
    } finally {
      setDeploying("none");
      setTimeout(() => setStatusMsg(""), 4000);
      setDeployOpen(false);
      setPickerOpen(false);
    }
  };

  const filteredProjects = p.projects
    .filter((pr) => pr.name.toLowerCase().includes(pickerSearch.toLowerCase()))
    .slice()
    .sort((a, b) => pickerAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

  return (
    <div
      className="flex items-center gap-2 flex-wrap px-4 py-2"
      style={{ borderBottom: `1px solid rgba(${GOLD_RGB},0.22)`, background: `rgba(${GOLD_RGB},0.04)` }}
    >
      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>
        Edit Mode
      </span>
      {p.active && (
        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
          · Draft #{p.active.number} · {p.componentKey} · {p.isSaved ? "saved" : "unsaved"}
        </span>
      )}

      <div className="flex-1" />

      {/* Auto-save toggle */}
      <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider cursor-pointer" style={{ color: "rgba(255,255,255,0.6)" }}>
        <input type="checkbox" checked={p.autoSave} onChange={(e) => p.setAutoSave(e.target.checked)} className="accent-pink-500" />
        Auto-save
      </label>

      {/* Save */}
      <button
        onClick={p.onSave}
        disabled={p.autoSave || p.isSaved}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider disabled:opacity-30"
        style={{ background: `rgba(${PINK_RGB},0.12)`, border: `1px solid rgba(${PINK_RGB},0.45)`, color: PINK }}
        title={p.autoSave ? "Auto-save is on" : p.isSaved ? "Already saved" : "Save"}
      >
        💾 Save
      </button>

      {/* Undo / Redo */}
      <button
        onClick={p.onUndo}
        disabled={!p.canUndo}
        className="w-7 h-7 rounded-md text-sm disabled:opacity-25"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
        title="Undo"
      >↶</button>
      <button
        onClick={p.onRedo}
        disabled={!p.canRedo}
        className="w-7 h-7 rounded-md text-sm disabled:opacity-25"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}
        title="Redo"
      >↷</button>

      {/* Reset to last deployment */}
      <button
        onClick={p.onResetToDeployed}
        disabled={!p.active}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider disabled:opacity-25"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}
        title="Reset draft to last-deployed code"
      >↺ Reset</button>

      {/* Preview */}
      <button
        onClick={() => runDeploy({ preview: true })}
        disabled={!canDeploy || deploying !== "none"}
        className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider disabled:opacity-25"
        style={{ background: `rgba(${CYAN_RGB},0.12)`, border: `1px solid rgba(${CYAN_RGB},0.45)`, color: CYAN }}
        title={canDeploy ? "Preview deploy" : "Save first"}
      >👁 Preview</button>

      {/* Deploy DDM */}
      <div ref={ddmRef} className="relative">
        <button
          onClick={() => setDeployOpen((v) => !v)}
          disabled={!canDeploy || deploying !== "none"}
          className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider disabled:opacity-25 flex items-center gap-1"
          style={{ background: `rgba(${GOLD_RGB},0.14)`, border: `1px solid rgba(${GOLD_RGB},0.5)`, color: GOLD }}
          title={canDeploy ? "Deploy" : "Save first"}
        >
          🚀 {deploying === "deploy" ? "Deploying…" : "Deploy"}
          <span style={{ fontSize: 8 }}>▾</span>
        </button>

        {deployOpen && (
          <div
            className="absolute right-0 top-full mt-2 rounded-xl overflow-hidden z-[80]"
            style={{
              minWidth: 200,
              background: "rgba(8,10,16,0.98)",
              border: `1px solid rgba(${GOLD_RGB},0.35)`,
              boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(${GOLD_RGB},0.15)`,
            }}
          >
            <button
              onClick={() => runDeploy({})}
              className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-white/5"
              style={{ color: GOLD, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >🌍 Deploy for All</button>
            <button
              onClick={() => { setPickerOpen(true); setDeployOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >🎯 Deploy to…</button>
          </div>
        )}
      </div>

      {/* Project picker SBDM */}
      {pickerOpen && (
        <div
          ref={sbdmRef}
          className="absolute right-4 top-full mt-2 rounded-xl overflow-hidden z-[81]"
          style={{
            minWidth: 280,
            background: "rgba(8,10,16,0.98)",
            border: `1px solid rgba(${GOLD_RGB},0.35)`,
            boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 24px rgba(${GOLD_RGB},0.15)`,
          }}
        >
          <div className="flex items-center gap-2 p-2 border-b border-white/5">
            <input
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search projects…"
              className="flex-1 bg-white/5 rounded-md px-2 py-1.5 text-xs text-white outline-none placeholder:text-white/30"
            />
            <button
              onClick={() => setPickerAsc((v) => !v)}
              className="px-2 py-1.5 rounded-md text-[10px] font-bold tracking-wider"
              style={{ background: `rgba(${CYAN_RGB},0.08)`, border: `1px solid rgba(${CYAN_RGB},0.3)`, color: CYAN }}
            >{pickerAsc ? "Z-A" : "A-Z"}</button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filteredProjects.length === 0 ? (
              <div className="px-3 py-4 text-xs text-white/30 text-center">No matches</div>
            ) : filteredProjects.map((pr) => (
              <button
                key={pr.name}
                onClick={() => runDeploy({ targets: [pr.name] })}
                className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-white/5"
              >
                {pr.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {statusMsg && (
        <span className="text-[10px] font-mono ml-2" style={{ color: "rgba(255,255,255,0.6)" }}>
          {statusMsg}
        </span>
      )}
    </div>
  );
}
