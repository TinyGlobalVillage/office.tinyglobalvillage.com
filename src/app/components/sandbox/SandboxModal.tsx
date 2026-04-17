"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  position: relative;
`;

const FileSidebar = styled(PanelSidebar)<{ $w: number }>`
  width: ${(p) => p.$w}px;
  flex-shrink: 0;
  padding: 0.75rem 0.5rem;
  transition: ${(p) => (p.$w === 0 ? "width 0.2s" : "none")};
  overflow: ${(p) => (p.$w < 80 ? "hidden" : "auto")};
`;

const ResizeHandle = styled.div<{ $dragging?: boolean }>`
  width: 5px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  background: ${(p) => (p.$dragging ? `rgba(${PINK_RGB}, 0.25)` : "transparent")};
  transition: background 0.15s;

  &::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 2px;
    width: 1px;
    background: var(--t-border);
  }

  &:hover {
    background: rgba(${PINK_RGB}, 0.12);
    &::after { background: rgba(${PINK_RGB}, 0.4); }
  }
`;

const DrawerTab = styled.button<{ $side: "left" | "right" }>`
  position: absolute;
  top: 50%;
  ${(p) => p.$side}: 0;
  transform: translateY(-50%);
  z-index: 10;
  width: 20px;
  height: 48px;
  border-radius: ${(p) => (p.$side === "left" ? "0 6px 6px 0" : "6px 0 0 6px")};
  background: rgba(${PINK_RGB}, 0.08);
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  border-${(p) => p.$side}: none;
  color: ${PINK};
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    background: rgba(${PINK_RGB}, 0.18);
  }
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

  [data-theme="light"] & {
    background: #1a1028;
    border-radius: 0.75rem;
    margin: 0.5rem;
  }
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

const CodePane = styled.div<{ $w: number }>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: ${(p) => p.$w}px;
  overflow: hidden;
  transition: ${(p) => (p.$w === 0 ? "width 0.2s" : "none")};
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

const CodeEditorWrap = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

const SearchBar = styled.div`
  position: absolute;
  top: 4px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(8, 10, 16, 0.96);
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
`;

const SearchInput = styled.input`
  width: 180px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(${PINK_RGB}, 0.2);
  color: var(--t-text);
  outline: none;

  &:focus {
    border-color: rgba(${PINK_RGB}, 0.5);
  }

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: var(--t-border);
    &:focus { border-color: rgba(${PINK_RGB}, 0.4); }
  }
`;

const SearchCount = styled.span`
  font-size: 0.5625rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-textMuted);
  white-space: nowrap;
  min-width: 48px;
  text-align: center;
`;

const SearchNavBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  background: rgba(${PINK_RGB}, 0.06);
  color: ${PINK};
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { background: rgba(${PINK_RGB}, 0.14); }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const SearchCloseBtn = styled.button`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: none;
  border: none;
  color: var(--t-textMuted);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { color: var(--t-text); }
`;

const SearchCaseBtn = styled.button<{ $active?: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.5)` : "rgba(255,255,255,0.1)")};
  background: ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.12)` : "transparent")};
  color: ${(p) => (p.$active ? PINK : "var(--t-textMuted)")};
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CodeTabBar = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--t-border);
`;

const CodeTabBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 0.375rem 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: ${(p) => (p.$active ? "var(--t-inputBg)" : "transparent")};
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? PINK : "transparent")};
  color: ${(p) => (p.$active ? PINK : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: ${PINK};
  }
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

const DraftSbdmWrap = styled.div`
  position: relative;
`;

const DraftArrow = styled.span`
  font-size: 8px;
`;

const DraftNumber = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${GOLD};
`;

const DraftDate = styled.span`
  margin-left: 0.5rem;
  font-size: 0.625rem;
  color: var(--t-textGhost);
`;

const FileItemsWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const FileItemRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
`;

const StyleFooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
`;

const AutoSavedFlash = styled.span<{ $visible: boolean }>`
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.7);
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity ${(p) => (p.$visible ? "0.15s" : "1.5s")} ease;
  pointer-events: none;
  white-space: nowrap;
`;

// ── Component ────────────────────────────────────────────────────

const SNAP_THRESHOLD = 50;
const SIDEBAR_DEFAULT = 240;
const CODE_DEFAULT = 420;
const SIDEBAR_MIN = 140;
const CODE_MIN = 200;

function useResizePanel(
  defaultW: number,
  minW: number,
  side: "left" | "right",
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [width, setWidth] = useState(defaultW);
  const [snapped, setSnapped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width || defaultW;
    setDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX.current;
      const raw = side === "left" ? startW.current + dx : startW.current - dx;
      if (raw < SNAP_THRESHOLD) {
        setWidth(0);
        setSnapped(true);
      } else {
        setWidth(Math.max(minW, raw));
        setSnapped(false);
      }
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [width, defaultW, minW, side]);

  const restore = useCallback(() => {
    setWidth(defaultW);
    setSnapped(false);
  }, [defaultW]);

  return { width: snapped ? 0 : width, snapped, dragging, onPointerDown, restore };
}

export default function SandboxModal({ onClose }: { onClose: () => void }) {
  const [activeKey, setActiveKey] = useState<string>(REGISTRY[0]?.key ?? "");
  const [fsOpen, setFsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeTab, setCodeTab] = useState<"component" | "style">("component");
  const [liveStyle, setLiveStyle] = useState<string | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleDirty, setStyleDirty] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string>("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sidebar = useResizePanel(SIDEBAR_DEFAULT, SIDEBAR_MIN, "left", bodyRef);
  const codePanel = useResizePanel(CODE_DEFAULT, CODE_MIN, "right", bodyRef);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCase, setSearchCase] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement | null>(null);

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

  useEffect(() => { setCodeTab("component"); setLiveStyle(null); setStyleDirty(false); }, [activeKey]);

  useEffect(() => {
    if (codeTab !== "style" || !active?.stylePath) return;
    setStyleLoading(true);
    fetch(`/api/sandbox/styles?path=${encodeURIComponent(active.stylePath)}`)
      .then((r) => r.json())
      .then((d: { styles?: string }) => { setLiveStyle(d.styles ?? "// No styled blocks found"); setStyleDirty(false); })
      .catch(() => setLiveStyle("// Failed to load styles"))
      .finally(() => setStyleLoading(false));
  }, [codeTab, active?.stylePath]);

  const [autoSavedFlash, setAutoSavedFlash] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveStyle = useCallback(async () => {
    if (!active?.stylePath || !liveStyle) return;
    const res = await fetch("/api/sandbox/styles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: active.stylePath, styles: liveStyle }),
    });
    const d = await res.json();
    if (d.ok) {
      setStyleDirty(false);
      setAutoSavedFlash(true);
      setTimeout(() => setAutoSavedFlash(false), 1800);
    }
  }, [active?.stylePath, liveStyle]);

  // Debounced auto-save: 1.5s after the user stops typing in the style tab
  useEffect(() => {
    if (codeTab !== "style" || !styleDirty || !liveStyle) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { saveStyle(); }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [liveStyle, styleDirty, codeTab, saveStyle]);

  // Search: find all match positions in the current editor text
  const currentText = codeTab === "style" ? (liveStyle ?? "") : (editMode && drafts.active ? (unsavedCode ?? drafts.active.code) : codeDraft);

  const searchMatches = useMemo(() => {
    if (!searchQuery || !searchOpen) return [];
    const text = searchCase ? currentText : currentText.toLowerCase();
    const q = searchCase ? searchQuery : searchQuery.toLowerCase();
    const positions: number[] = [];
    let pos = 0;
    while ((pos = text.indexOf(q, pos)) !== -1) {
      positions.push(pos);
      pos += 1;
    }
    return positions;
  }, [currentText, searchQuery, searchCase, searchOpen]);

  const safeSearchIdx = searchMatches.length > 0 ? searchIdx % searchMatches.length : 0;

  const jumpToMatch = useCallback((idx: number) => {
    const ta = codeEditorRef.current;
    if (!ta || searchMatches.length === 0) return;
    const pos = searchMatches[idx % searchMatches.length];
    ta.focus();
    ta.setSelectionRange(pos, pos + searchQuery.length);
    // Scroll to match: estimate line position
    const textBefore = currentText.slice(0, pos);
    const lineNum = textBefore.split("\n").length - 1;
    const lineH = 15.4; // ~0.6875rem * 1.55 line-height ≈ 15.4px
    ta.scrollTop = Math.max(0, lineNum * lineH - ta.clientHeight / 3);
  }, [searchMatches, searchQuery, currentText]);

  // Cmd+F / Ctrl+F to open search, Escape to close, Enter to navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!codeOpen || codePanel.snapped) return;
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+F: open search
      if (mod && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
        setSearchIdx(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      // Cmd+/ or Cmd+\: toggle comment on current line
      if (mod && (e.key === "/" || e.key === "\\")) {
        e.preventDefault();
        e.stopPropagation();
        const ta = codeEditorRef.current;
        if (!ta) return;
        const val = ta.value;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        // Find line boundaries
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end);
        const actualEnd = lineEnd === -1 ? val.length : lineEnd;
        // Get all lines in selection
        const block = val.slice(lineStart, actualEnd);
        const lines = block.split("\n");
        const allCommented = lines.every((l) => l.trimStart().startsWith("// ") || l.trimStart().startsWith("//") && l.trim() === "//");
        const toggled = lines
          .map((l) => {
            if (allCommented) {
              const idx = l.indexOf("// ");
              if (idx !== -1) return l.slice(0, idx) + l.slice(idx + 3);
              const idx2 = l.indexOf("//");
              if (idx2 !== -1) return l.slice(0, idx2) + l.slice(idx2 + 2);
              return l;
            }
            return "// " + l;
          })
          .join("\n");
        const newVal = val.slice(0, lineStart) + toggled + val.slice(actualEnd);
        // Update via the appropriate handler
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        nativeInputValueSetter?.call(ta, newVal);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        // Restore selection
        const diff = toggled.length - block.length;
        ta.setSelectionRange(start + (allCommented ? -3 : 3), end + diff);
        return;
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [codeOpen, codePanel.snapped]);

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
            <DraftSbdmWrap ref={draftSbdmRef}>
              <DraftTrigger onClick={() => setDraftPickerOpen((v) => !v)} title="Pick a draft or live">
                {drafts.active ? `Draft #${drafts.active.number}` : "Live"}
                <DraftArrow>▾</DraftArrow>
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
                          <DraftNumber>Draft #{d.number}</DraftNumber>
                          <DraftDate>{new Date(d.updatedAt).toLocaleString()}</DraftDate>
                        </DraftItemBtn>
                        <DraftItemDel onClick={() => drafts.deleteDraft(d.id)} title="Delete draft">✕</DraftItemDel>
                      </DraftItem>
                    ))}
                  </DraftList>
                </DraftPanel>
              )}
            </DraftSbdmWrap>
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

          <ToggleBtn $active={fsOpen && !sidebar.snapped} onClick={() => { if (sidebar.snapped) { sidebar.restore(); } else { setFsOpen((p) => !p); } }}>📁 Files</ToggleBtn>
          <ToggleBtn $active={codeOpen && !codePanel.snapped} onClick={() => { if (codePanel.snapped) { codePanel.restore(); } else { setCodeOpen((p) => !p); } }}>{"</>"} Code</ToggleBtn>
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

        <Body ref={bodyRef}>
          {fsOpen && !sidebar.snapped && (
            <FileSidebar $w={sidebar.width}>
              {CATEGORIES.map((cat) => (
                <FileGroup key={cat}>
                  <PanelSidebarLabel>{cat}</PanelSidebarLabel>
                  <FileItemsWrap>
                    {grouped[cat].map((e) => (
                      <FileItem
                        key={e.key}
                        $active={activeKey === e.key}
                        onClick={() => setActiveKey(e.key)}
                      >
                        <FileItemRow>
                          <FileItemLabel>{e.key}</FileItemLabel>
                          <FileItemSub $active={activeKey === e.key}>
                            {e.name.replace(`${e.key} — `, "").replace(e.key, "").trim() || e.name}
                          </FileItemSub>
                        </FileItemRow>
                      </FileItem>
                    ))}
                  </FileItemsWrap>
                </FileGroup>
              ))}
            </FileSidebar>
          )}
          {fsOpen && !sidebar.snapped && (
            <ResizeHandle $dragging={sidebar.dragging} onPointerDown={sidebar.onPointerDown} />
          )}
          {fsOpen && sidebar.snapped && (
            <DrawerTab $side="left" onClick={sidebar.restore} title="Restore file panel">
              📁
            </DrawerTab>
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

          {codeOpen && active && !codePanel.snapped && (
            <ResizeHandle $dragging={codePanel.dragging} onPointerDown={codePanel.onPointerDown} />
          )}
          {codeOpen && codePanel.snapped && (
            <DrawerTab $side="right" onClick={codePanel.restore} title="Restore code panel">
              {"</>"}
            </DrawerTab>
          )}
          {codeOpen && active && !codePanel.snapped && (
            <CodePane $w={codePanel.width}>
              <CodeHeader>
                <CodeLabel $edit={editMode}>Code</CodeLabel>
                <CodeTag>{active.key}{codeTab === "style" ? ".styled.ts" : ".tsx"}</CodeTag>
                <Spacer />
                {codeTab === "style" && <AutoSavedFlash $visible={autoSavedFlash}>auto-saved</AutoSavedFlash>}
                <PanelActionBtn
                  $variant="ghost"
                  onClick={() => { if (codeTab === "style") { setLiveStyle(null); setStyleLoading(true); fetch(`/api/sandbox/styles?path=${encodeURIComponent(active.stylePath ?? "")}`).then(r => r.json()).then(d => { setLiveStyle(d.styles ?? ""); setStyleDirty(false); }).finally(() => setStyleLoading(false)); } else if (editMode) { drafts.resetToDeployed(); } else { setCodeDraft(active.code); } }}
                  title="Restore canonical / deployed code"
                >
                  Reset
                </PanelActionBtn>
              </CodeHeader>
              {active.stylePath && (
                <CodeTabBar>
                  <CodeTabBtn $active={codeTab === "component"} onClick={() => setCodeTab("component")}>
                    Component
                  </CodeTabBtn>
                  <CodeTabBtn $active={codeTab === "style"} onClick={() => setCodeTab("style")}>
                    Styles
                  </CodeTabBtn>
                </CodeTabBar>
              )}
              <CodeEditorWrap>
                {searchOpen && (
                  <SearchBar>
                    <SearchInput
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { e.stopPropagation(); setSearchOpen(false); setSearchQuery(""); codeEditorRef.current?.focus(); }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchMatches.length === 0) return;
                          const next = e.shiftKey
                            ? (safeSearchIdx - 1 + searchMatches.length) % searchMatches.length
                            : (safeSearchIdx + 1) % searchMatches.length;
                          setSearchIdx(next);
                          jumpToMatch(next);
                        }
                      }}
                      placeholder="Find…"
                      spellCheck={false}
                    />
                    <SearchCaseBtn
                      $active={searchCase}
                      onClick={() => setSearchCase((v) => !v)}
                      title="Match case"
                    >Aa</SearchCaseBtn>
                    <SearchCount>
                      {searchMatches.length > 0 ? `${safeSearchIdx + 1}/${searchMatches.length}` : searchQuery ? "0" : ""}
                    </SearchCount>
                    <SearchNavBtn
                      disabled={searchMatches.length === 0}
                      onClick={() => { const p = (safeSearchIdx - 1 + searchMatches.length) % searchMatches.length; setSearchIdx(p); jumpToMatch(p); }}
                      title="Previous (Shift+Enter)"
                    >▲</SearchNavBtn>
                    <SearchNavBtn
                      disabled={searchMatches.length === 0}
                      onClick={() => { const n = (safeSearchIdx + 1) % searchMatches.length; setSearchIdx(n); jumpToMatch(n); }}
                      title="Next (Enter)"
                    >▼</SearchNavBtn>
                    <SearchCloseBtn onClick={() => { setSearchOpen(false); setSearchQuery(""); codeEditorRef.current?.focus(); }} title="Close (Esc)">✕</SearchCloseBtn>
                  </SearchBar>
                )}
                <CodeEditor
                  ref={codeEditorRef}
                  value={codeTab === "style" ? (liveStyle ?? "// Loading...") : editorCode}
                  onChange={(e) => { if (codeTab === "style") { setLiveStyle(e.target.value); setStyleDirty(true); } else { handleCodeChange(e.target.value); } }}
                  spellCheck={false}
                />
              </CodeEditorWrap>
              <CodeFooter>
                {codeTab === "style" ? (
                  <StyleFooterRow>
                    <span>{active.stylePath}</span>
                    <Spacer />
                    <span>{styleLoading ? "loading…" : "synced"}</span>
                  </StyleFooterRow>
                ) : editMode && drafts.active
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
