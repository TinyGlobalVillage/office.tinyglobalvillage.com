"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelSidebar,
  PanelSidebarLabel,
  PanelSidebarItem,
  Spacer,
} from "../../styled";
import SandboxIcon from "./SandboxIcon";
import { REGISTRY, CATEGORIES, type SandboxEntry } from "./registry";
import { useDraftStore } from "./useDraftStore";
import SandboxEditToolbar from "./SandboxEditToolbar";
import SandboxClaudeDrawer from "./SandboxClaudeDrawer";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;
const GOLD = colors.gold;
const GOLD_RGB = rgb.gold;

// ── Styled ───────────────────────────────────────────────────────

const Backdrop = styled(PanelBackdrop)``;

const Modal = styled(Panel)<{ $edit?: boolean }>`
  border-color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.32);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85),
    0 0 32px rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.12);
`;

const Header = styled(PanelHeader)<{ $edit?: boolean }>`
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom-color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.18);
`;

const Title = styled.h2<{ $edit?: boolean }>`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: ${(p) => (p.$edit ? GOLD : PINK)};
`;

const Tag = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
`;

const ToggleBtn = styled.button<{ $active?: boolean; $color?: string }>`
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  background: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.14)` : "rgba(255,255,255,0.04)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.45)` : "rgba(255,255,255,0.15)")};
  color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "rgba(255,255,255,0.55)")};

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.1)` : "var(--t-inputBg)")};
    border-color: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.35)` : "var(--t-border)")};
    color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "var(--t-textMuted)")};
  }
`;

const DraftTrigger = styled.button`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(${GOLD_RGB}, 0.08);
  border: 1px solid rgba(${GOLD_RGB}, 0.3);
  color: ${GOLD};
  cursor: pointer;

  [data-theme="light"] & {
    background: rgba(${GOLD_RGB}, 0.05);
    border-color: rgba(${GOLD_RGB}, 0.2);
  }
`;

const DraftPanel = styled.div`
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 80;
  min-width: 240px;
  background: rgba(8, 10, 16, 0.98);
  border: 1px solid rgba(${GOLD_RGB}, 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
`;

const DraftSearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--t-border);
`;

const DraftSearchInput = styled.input`
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

const DraftSortBtn = styled.button`
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: rgba(${rgb.cyan}, 0.08);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  cursor: pointer;
`;

const DraftList = styled.div`
  max-height: 256px;
  overflow-y: auto;
`;

const DraftItem = styled.div`
  display: flex;
  align-items: center;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const DraftItemBtn = styled.button`
  flex: 1;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  background: none;
  border: none;
  cursor: pointer;
`;

const DraftItemDel = styled.button`
  padding: 0.5rem;
  font-size: 0.75rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;

  &:hover { color: #f87171; }
`;

const LiveBtn = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { background: var(--t-inputBg); }
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
`;

const FileSidebar = styled(PanelSidebar)`
  width: 240px;
  flex-shrink: 0;
  padding: 0.75rem 0.5rem;
`;

const FileGroup = styled.div`
  margin-bottom: 0.75rem;
`;

const FileItem = styled(PanelSidebarItem).attrs({ $accent: "pink" })`
  font-family: var(--font-geist-mono), monospace;
`;

const FileItemLabel = styled.span`
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  font-weight: 700;
`;

const FileItemSub = styled.span<{ $active?: boolean }>`
  font-size: 0.625rem;
  color: ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.7)` : "var(--t-textGhost)")};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CenterPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SummaryBar = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
  background: rgba(${PINK_RGB}, 0.03);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.02);
  }
`;

const SummaryToggle = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 1.25rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
`;

const SummaryArrow = styled.span`
  color: ${PINK};
  font-size: 0.6875rem;
  font-weight: 700;
`;

const SummaryLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${PINK};
`;

const SummaryKey = styled.span`
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-text);
  opacity: 0.85;
`;

const SummaryCat = styled.span`
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--t-textGhost);
`;

const SummaryBody = styled.div`
  padding: 0 1.25rem 1rem;
  max-width: 56rem;
`;

const SummaryText = styled.p`
  font-size: 0.75rem;
  color: var(--t-text);
  opacity: 0.75;
  line-height: 1.6;
  margin: 0 0 0.5rem;
`;

const UsageLabel = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${PINK};
  margin-right: 0.5rem;
`;

const UsageText = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  line-height: 1.6;
`;

const Viewport = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const DemoArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: center;
`;

const DemoWrap = styled.div`
  width: 100%;
  max-width: 42rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
`;

const ClaudeWrap = styled.div`
  flex-shrink: 0;
`;

const EmptyCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--t-textGhost);
  font-size: 0.875rem;
`;

const CodePane = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: 420px;
  overflow: hidden;
  border-left: 1px solid var(--t-border);
  background: rgba(4, 6, 10, 0.7);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const CodeLabel = styled.span<{ $edit?: boolean }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => (p.$edit ? GOLD : PINK)};
`;

const CodeTag = styled.span`
  font-size: 0.5625rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textGhost);
`;

const CodeEditor = styled.textarea`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  padding: 0.75rem;
  resize: none;
  color: var(--t-text);
  opacity: 0.85;
  line-height: 1.55;
  scrollbar-width: thin;
  border: none;
`;

const CodeFooter = styled.div`
  padding: 0.5rem 1rem;
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  flex-shrink: 0;
  border-top: 1px solid var(--t-border);
  color: var(--t-textFaint);
`;

// ── Component ────────────────────────────────────────────────────

export default function SandboxModal({ onClose }: { onClose: () => void }) {
  const [activeKey, setActiveKey] = useState<string>(REGISTRY[0]?.key ?? "");
  const [fsOpen, setFsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string>("");

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

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (!editMode) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d.map((p: { name: string }) => ({ name: p.name })) : []))
      .catch(() => setProjects([]));
  }, [editMode]);

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

  const grouped = useMemo(() => {
    const m: Record<string, SandboxEntry[]> = {};
    for (const c of CATEGORIES) m[c] = [];
    for (const e of REGISTRY) m[e.category].push(e);
    return m;
  }, []);

  const Demo = active?.Demo;

  const editorCode = editMode && drafts.active
    ? (unsavedCode ?? drafts.active.code)
    : codeDraft;

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
      <Backdrop onClick={onClose} />

      <Modal
        $edit={editMode}
        $accent={editMode ? "gold" : "pink"}
        $fs={fullscreen}
      >
        <Header $edit={editMode}>
          <SandboxIcon size={22} color={editMode ? GOLD : PINK} />
          <Title $edit={editMode}>Sandbox{editMode ? " · Editing" : ""}</Title>
          <Tag>Component Reference · {REGISTRY.length} entries</Tag>

          {isAdmin && drafts.drafts.length > 0 && (
            <div ref={draftSbdmRef} style={{ position: "relative" }}>
              <DraftTrigger onClick={() => setDraftPickerOpen((v) => !v)} title="Pick a draft or live">
                {drafts.active ? `Draft #${drafts.active.number}` : "Live"}
                <span style={{ fontSize: 8 }}>▾</span>
              </DraftTrigger>
              {draftPickerOpen && (
                <DraftPanel>
                  <DraftSearchBar>
                    <DraftSearchInput
                      autoFocus
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      placeholder="Search drafts…"
                    />
                    <DraftSortBtn onClick={() => setDraftAsc((v) => !v)}>
                      {draftAsc ? "Z-A" : "A-Z"}
                    </DraftSortBtn>
                  </DraftSearchBar>
                  <DraftList>
                    <LiveBtn onClick={() => { drafts.closeDraft(); setEditMode(false); setDraftPickerOpen(false); }}>
                      <LiveDot />
                      <span>Live (deployed)</span>
                    </LiveBtn>
                    {filteredDrafts.map((d) => (
                      <DraftItem key={d.id}>
                        <DraftItemBtn onClick={() => { drafts.openDraft(d.id); setEditMode(true); setDraftPickerOpen(false); }}>
                          <span style={{ fontFamily: "var(--font-geist-mono), monospace", color: GOLD }}>Draft #{d.number}</span>
                          <span style={{ marginLeft: "0.5rem", fontSize: "0.625rem", color: "var(--t-textGhost)" }}>{new Date(d.updatedAt).toLocaleString()}</span>
                        </DraftItemBtn>
                        <DraftItemDel onClick={() => drafts.deleteDraft(d.id)} title="Delete draft">✕</DraftItemDel>
                      </DraftItem>
                    ))}
                  </DraftList>
                </DraftPanel>
              )}
            </div>
          )}

          <Spacer />

          {isAdmin && (
            <ToggleBtn
              $active={editMode}
              $color={GOLD_RGB}
              onClick={() => editMode ? (setEditMode(false), drafts.closeDraft()) : handleEnterEditMode()}
            >
              ✎ {editMode ? "Exit Edit" : "Edit Mode"}
            </ToggleBtn>
          )}

          <ToggleBtn $active={fsOpen} onClick={() => setFsOpen((p) => !p)}>📁 Files</ToggleBtn>
          <ToggleBtn $active={codeOpen} onClick={() => setCodeOpen((p) => !p)}>{"</>"} Code</ToggleBtn>
          <PanelIconBtn onClick={() => setFullscreen((p) => !p)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            {fullscreen ? "⊡" : "⊞"}
          </PanelIconBtn>
          <PanelIconBtn onClick={onClose} title="Close (Esc)">✕</PanelIconBtn>
        </Header>

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

        <Body>
          {fsOpen && (
            <FileSidebar>
              {CATEGORIES.map((cat) => (
                <FileGroup key={cat}>
                  <PanelSidebarLabel>{cat}</PanelSidebarLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                    {grouped[cat].map((e) => (
                      <FileItem
                        key={e.key}
                        $active={activeKey === e.key}
                        onClick={() => setActiveKey(e.key)}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", gap: "0.375rem" }}>
                          <FileItemLabel>{e.key}</FileItemLabel>
                          <FileItemSub $active={activeKey === e.key}>
                            {e.name.replace(`${e.key} — `, "").replace(e.key, "").trim() || e.name}
                          </FileItemSub>
                        </div>
                      </FileItem>
                    ))}
                  </div>
                </FileGroup>
              ))}
            </FileSidebar>
          )}

          <CenterPane>
            {active ? (
              <>
                <SummaryBar>
                  <SummaryToggle onClick={() => setSummaryOpen((p) => !p)}>
                    <SummaryArrow>{summaryOpen ? "▾" : "▸"}</SummaryArrow>
                    <SummaryLabel>Summary</SummaryLabel>
                    <SummaryKey>· {active.key} — {active.name}</SummaryKey>
                    <Spacer />
                    <SummaryCat>{active.category}</SummaryCat>
                  </SummaryToggle>
                  {summaryOpen && (
                    <SummaryBody>
                      <SummaryText>{active.summary}</SummaryText>
                      <div>
                        <UsageLabel>Usage</UsageLabel>
                        <UsageText>{active.usage}</UsageText>
                      </div>
                    </SummaryBody>
                  )}
                </SummaryBar>

                <Viewport>
                  <DemoArea>
                    <DemoWrap>
                      {Demo && <Demo />}
                    </DemoWrap>
                  </DemoArea>
                  {isAdmin && editMode && active && (
                    <ClaudeWrap>
                      <SandboxClaudeDrawer
                        componentKey={activeKey}
                        currentCode={editorCode}
                        onCodeUpdate={(code) => handleCodeChange(code)}
                        onDeploy={(targets) => handleDeploy({ targets: targets[0] === "all" ? undefined : targets })}
                      />
                    </ClaudeWrap>
                  )}
                </Viewport>
              </>
            ) : (
              <EmptyCenter>Select a component.</EmptyCenter>
            )}
          </CenterPane>

          {codeOpen && active && (
            <CodePane>
              <CodeHeader>
                <CodeLabel $edit={editMode}>Code</CodeLabel>
                <CodeTag>{active.key}.tsx</CodeTag>
                <Spacer />
                <PanelActionBtn
                  $variant="ghost"
                  onClick={() => editMode ? drafts.resetToDeployed() : setCodeDraft(active.code)}
                  title="Restore canonical / deployed code"
                >
                  Reset
                </PanelActionBtn>
              </CodeHeader>
              <CodeEditor
                value={editorCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                spellCheck={false}
              />
              <CodeFooter>
                {editMode && drafts.active
                  ? `Draft #${drafts.active.number} · ${isSaved ? "saved" : "unsaved"} · auto-save ${autoSave ? "on" : "off"}`
                  : "Edits reset on file switch · not saved"}
              </CodeFooter>
            </CodePane>
          )}
        </Body>
      </Modal>
    </>
  );
}
