"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { PanelIconBtn, PanelActionBtn, Spacer } from "../../styled";
import type { Draft } from "./useDraftStore";
import ComponentVersionsSyncButton from "./ComponentVersionsSyncButton";
import ComponentPicker from "./ComponentPicker";
import Tooltip from "../ui/Tooltip";
import { SaveIcon, EyeIcon, GlobeIcon, TargetIcon, DeployIcon } from "../icons";

// Inline-flex row so an SVG icon + its (collapsible) text label align inside a button.
const IconRow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  line-height: 0;
`;

// Toolbar button label — collapses to its leading icon when the center column is tight
// (the SVG icon stays; the styled Tooltip explains it on hover).
const TLabel = styled.span`
  line-height: 1;
  @container sandboxcenter (max-width: 620px) {
    display: none;
  }
`;

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
  /** Select another component to edit (same as clicking a sidebar row) — feeds the ComponentPicker. */
  onSelectKey: (key: string) => void;
  projects: { name: string }[];
  onDeploy: (opts: { targets?: string[]; preview?: boolean }) => Promise<void>;
};

// ── Styled ───────────────────────────────────────────────────────

const Bar = styled.div`
  /* On narrow, the edit toolbar sits at the top of the stacked column (above Summary). */
  @container sandboxbody (max-width: 1100px) {
    order: 1;
    width: 100%;
  }
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

const DDMItemPrimary = styled(DDMItem)`
  color: ${GOLD};
  border-bottom: 1px solid var(--t-border);
`;

const DDMItemSecondary = styled(DDMItem)`
  color: var(--t-textMuted);
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

const DeployBtn = styled(PanelActionBtn)`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const DropdownArrow = styled.span`
  font-size: 8px;
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
      <ModeLabel><TLabel>Edit Mode</TLabel></ModeLabel>
      <ComponentPicker activeKey={p.componentKey} onSelect={p.onSelectKey} />
      {p.active && (
        <InfoTag><TLabel>· Draft #{p.active.number} · {p.isSaved ? "saved" : "unsaved"}</TLabel></InfoTag>
      )}

      <Spacer />

      <Tooltip label="Auto-save drafts" accent={PINK}>
        <AutoSaveLabel>
          <input type="checkbox" checked={p.autoSave} onChange={(e) => p.setAutoSave(e.target.checked)} />
          <TLabel>Auto-save</TLabel>
        </AutoSaveLabel>
      </Tooltip>

      <Tooltip label={p.autoSave ? "Auto-save is on" : p.isSaved ? "Already saved" : "Save draft"} accent={PINK}>
        <PanelActionBtn $color="pink" onClick={p.onSave} disabled={p.autoSave || p.isSaved}>
          <IconRow><SaveIcon size={13} /><TLabel>Save</TLabel></IconRow>
        </PanelActionBtn>
      </Tooltip>

      <Tooltip label="Undo" accent={GOLD}>
        <UndoBtn onClick={p.onUndo} disabled={!p.canUndo}>↶</UndoBtn>
      </Tooltip>
      <Tooltip label="Redo" accent={GOLD}>
        <UndoBtn onClick={p.onRedo} disabled={!p.canRedo}>↷</UndoBtn>
      </Tooltip>

      <Tooltip label="Reset draft to last-deployed code" accent={GOLD}>
        <PanelActionBtn $variant="ghost" onClick={p.onResetToDeployed} disabled={!p.active}>
          ↺ <TLabel>Reset</TLabel>
        </PanelActionBtn>
      </Tooltip>

      <ComponentVersionsSyncButton />

      <Tooltip label={canDeploy ? "Preview deploy" : "Save first"} accent={CYAN}>
        <PanelActionBtn $color="cyan" onClick={() => runDeploy({ preview: true })} disabled={!canDeploy || deploying !== "none"}>
          <IconRow><EyeIcon size={13} /><TLabel>Preview</TLabel></IconRow>
        </PanelActionBtn>
      </Tooltip>

      <DDMWrap ref={ddmRef}>
        <Tooltip label={canDeploy ? "Deploy" : "Save first"} accent={GOLD}>
          <DeployBtn
            $color="gold"
            onClick={() => setDeployOpen((v) => !v)}
            disabled={!canDeploy || deploying !== "none"}
          >
            <IconRow><DeployIcon size={13} /><TLabel>{deploying === "deploy" ? "Deploying…" : "Deploy"}</TLabel></IconRow>
            <DropdownArrow>▾</DropdownArrow>
          </DeployBtn>
        </Tooltip>

        {deployOpen && (
          <DDMMenu>
            <DDMItemPrimary onClick={() => runDeploy({})}>
              <IconRow><GlobeIcon size={13} />Deploy for All</IconRow>
            </DDMItemPrimary>
            <DDMItemSecondary onClick={() => { setPickerOpen(true); setDeployOpen(false); }}>
              <IconRow><TargetIcon size={13} />Deploy to…</IconRow>
            </DDMItemSecondary>
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
