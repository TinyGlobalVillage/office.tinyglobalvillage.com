"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { PanelIconBtn, PanelActionBtn, Spacer } from "../../styled";
import type { Draft } from "./useDraftStore";

const GOLD = colors.gold;
const GOLD_RGB = rgb.gold;
const CYAN = colors.cyan;
const CYAN_RGB = rgb.cyan;
const PINK = colors.pink;
const PINK_RGB = rgb.pink;

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

// ── Styled ───────────────────────────────────────────────────────

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(${GOLD_RGB}, 0.22);
  background: rgba(${GOLD_RGB}, 0.04);

  [data-theme="light"] & {
    background: rgba(${GOLD_RGB}, 0.03);
    border-bottom-color: rgba(${GOLD_RGB}, 0.12);
  }
`;

const ModeLabel = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${GOLD};
`;

const InfoTag = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textMuted);
`;

const AutoSaveLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--t-textMuted);
  cursor: pointer;

  input {
    accent-color: ${PINK};
  }
`;

const UndoBtn = styled(PanelIconBtn)`
  width: 1.75rem;
  height: 1.75rem;
  font-size: 0.875rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);

  &:disabled {
    opacity: 0.25;
    cursor: not-allowed;
  }
`;

const DDMWrap = styled.div`
  position: relative;
`;

const DDMMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 80;
  min-width: 200px;
  background: rgba(8, 10, 16, 0.98);
  border: 1px solid rgba(${GOLD_RGB}, 0.35);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 24px rgba(${GOLD_RGB}, 0.15);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
`;

const DDMItem = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.625rem 1rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
  color: var(--t-text);

  &:hover {
    background: var(--t-inputBg);
  }
`;

const PickerPanel = styled.div`
  position: absolute;
  right: 1rem;
  top: 100%;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 81;
  min-width: 280px;
  background: rgba(8, 10, 16, 0.98);
  border: 1px solid rgba(${GOLD_RGB}, 0.35);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 24px rgba(${GOLD_RGB}, 0.15);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
`;

const PickerSearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--t-border);
`;

const PickerInput = styled.input`
  flex: 1;
  background: var(--t-inputBg);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  border: none;

  &::placeholder { color: var(--t-textGhost); }
`;

const PickerSortBtn = styled.button`
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: rgba(${CYAN_RGB}, 0.08);
  border: 1px solid rgba(${CYAN_RGB}, 0.3);
  color: ${CYAN};
  cursor: pointer;
`;

const PickerList = styled.div`
  max-height: 256px;
  overflow-y: auto;
`;

const PickerItem = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  background: none;
  border: none;
  cursor: pointer;

  &:hover { background: var(--t-inputBg); }
`;

const PickerEmpty = styled.div`
  padding: 1rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textGhost);
  text-align: center;
`;

const StatusMsg = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  margin-left: 0.5rem;
  color: var(--t-textMuted);
`;

// ── Component ────────────────────────────────────────────────────

export default function SandboxEditToolbar(p: Props) {
  const [deployOpen, setDeployOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerAsc, setPickerAsc] = useState(true);
  const [deploying, setDeploying] = useState<"none" | "deploy" | "preview">("none");
  const [statusMsg, setStatusMsg] = useState("");
  const ddmRef = useRef<HTMLDivElement>(null);
  const sbdmRef = useRef<HTMLDivElement>(null);

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
    <Bar>
      <ModeLabel>Edit Mode</ModeLabel>
      {p.active && (
        <InfoTag>· Draft #{p.active.number} · {p.componentKey} · {p.isSaved ? "saved" : "unsaved"}</InfoTag>
      )}

      <Spacer />

      <AutoSaveLabel>
        <input type="checkbox" checked={p.autoSave} onChange={(e) => p.setAutoSave(e.target.checked)} />
        Auto-save
      </AutoSaveLabel>

      <PanelActionBtn
        $color="pink"
        onClick={p.onSave}
        disabled={p.autoSave || p.isSaved}
        title={p.autoSave ? "Auto-save is on" : p.isSaved ? "Already saved" : "Save"}
      >
        💾 Save
      </PanelActionBtn>

      <UndoBtn onClick={p.onUndo} disabled={!p.canUndo} title="Undo">↶</UndoBtn>
      <UndoBtn onClick={p.onRedo} disabled={!p.canRedo} title="Redo">↷</UndoBtn>

      <PanelActionBtn $variant="ghost" onClick={p.onResetToDeployed} disabled={!p.active} title="Reset draft to last-deployed code">
        ↺ Reset
      </PanelActionBtn>

      <PanelActionBtn $color="cyan" onClick={() => runDeploy({ preview: true })} disabled={!canDeploy || deploying !== "none"} title={canDeploy ? "Preview deploy" : "Save first"}>
        👁 Preview
      </PanelActionBtn>

      <DDMWrap ref={ddmRef}>
        <PanelActionBtn
          $color="gold"
          onClick={() => setDeployOpen((v) => !v)}
          disabled={!canDeploy || deploying !== "none"}
          title={canDeploy ? "Deploy" : "Save first"}
          style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
        >
          🚀 {deploying === "deploy" ? "Deploying…" : "Deploy"}
          <span style={{ fontSize: 8 }}>▾</span>
        </PanelActionBtn>

        {deployOpen && (
          <DDMMenu>
            <DDMItem onClick={() => runDeploy({})} style={{ color: GOLD, borderBottom: "1px solid var(--t-border)" }}>
              🌍 Deploy for All
            </DDMItem>
            <DDMItem onClick={() => { setPickerOpen(true); setDeployOpen(false); }} style={{ color: "var(--t-textMuted)" }}>
              🎯 Deploy to…
            </DDMItem>
          </DDMMenu>
        )}
      </DDMWrap>

      {pickerOpen && (
        <PickerPanel ref={sbdmRef}>
          <PickerSearchBar>
            <PickerInput
              autoFocus
              value={pickerSearch}
              onChange={(e) => setPickerSearch(e.target.value)}
              placeholder="Search projects…"
            />
            <PickerSortBtn onClick={() => setPickerAsc((v) => !v)}>
              {pickerAsc ? "Z-A" : "A-Z"}
            </PickerSortBtn>
          </PickerSearchBar>
          <PickerList>
            {filteredProjects.length === 0 ? (
              <PickerEmpty>No matches</PickerEmpty>
            ) : filteredProjects.map((pr) => (
              <PickerItem key={pr.name} onClick={() => runDeploy({ targets: [pr.name] })}>
                {pr.name}
              </PickerItem>
            ))}
          </PickerList>
        </PickerPanel>
      )}

      {statusMsg && <StatusMsg>{statusMsg}</StatusMsg>}
    </Bar>
  );
}
