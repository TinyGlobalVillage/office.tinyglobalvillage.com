"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import styled from "styled-components";
import { colors, rgb, glowRgba } from "../theme";
import { DrawerPanel, DrawerHeader, DrawerTab, DrawerTabLabel, DrawerTitle, DrawerFooter } from "../styled";
import { DTogExpandIcon } from "./icons";
import NeonX from "./NeonX";
import { useKnobVisibility } from "../lib/drawerKnobs";
import { useDrawerLifecycle, DRAWER_DATA_ATTR } from "../lib/drawerStack";
import { useDrawerPersistedState } from "../lib/drawerPersist";

type LegendItem = { glyph: string; label: string; desc: string };
type PageLegend = { title: string; items: LegendItem[] };

const LEGENDS: Record<string, PageLegend> = {
  "/dashboard": {
    title: "Dashboard",
    items: [
      { glyph: "●", label: "Online",    desc: "Service is running normally" },
      { glyph: "○", label: "Offline",   desc: "User is not currently active" },
      { glyph: "↺", label: "Restarts",  desc: "Number of times the process has restarted" },
      { glyph: "▲", label: "Deploy",    desc: "Trigger a deployment or build" },
      { glyph: "MB", label: "Memory",   desc: "RAM consumed by the process in megabytes" },
      { glyph: "%",  label: "CPU",      desc: "CPU usage percentage at last sample" },
    ],
  },
  "/dashboard/processes": {
    title: "Processes",
    items: [
      { glyph: "●",    label: "Green dot",     desc: "Process is online and running" },
      { glyph: "●",    label: "Gray dot",      desc: "Process is stopped" },
      { glyph: "●",    label: "Red dot",       desc: "Process has errored or crashed" },
      { glyph: "#N",   label: "PM2 ID",        desc: "Unique PM2 process identifier" },
      { glyph: ":PORT", label: "Port",         desc: "Network port this service listens on" },
      { glyph: "↺ N",  label: "Restart count", desc: "How many times PM2 has restarted this process" },
      { glyph: "MB",   label: "Memory",        desc: "RAM used by this process" },
      { glyph: "% CPU", label: "CPU",          desc: "CPU usage at last 1s sample" },
      { glyph: "up Xh", label: "Uptime",       desc: "How long since the process last started" },
    ],
  },
  "/dashboard/deploy": {
    title: "Deploy",
    items: [
      { glyph: "▲", label: "Deploy",  desc: "Run build & restart the selected project" },
      { glyph: "↺", label: "Rebuild", desc: "Force a clean rebuild from source" },
      { glyph: "⬡", label: "Project", desc: "A Next.js client project managed by PM2" },
      { glyph: "●", label: "Online",  desc: "Project is live and serving traffic" },
      { glyph: "○", label: "Stopped", desc: "Project is not serving traffic" },
    ],
  },
  "/dashboard/database": {
    title: "Database",
    items: [
      { glyph: "⊞",    label: "Table",       desc: "A PostgreSQL database table" },
      { glyph: "→",    label: "Foreign key", desc: "A relation to another table" },
      { glyph: "PK",   label: "Primary key", desc: "Unique row identifier" },
      { glyph: "NULL", label: "Nullable",    desc: "Column allows null values" },
      { glyph: "▶",    label: "Run query",   desc: "Execute the SQL in the editor" },
      { glyph: "#",    label: "Row count",   desc: "Number of rows returned or in table" },
    ],
  },
  "/dashboard/utils": {
    title: "Utils",
    items: [
      { glyph: "▶",  label: "Run",      desc: "Execute this utility script" },
      { glyph: ">_", label: "Terminal", desc: "Open the live terminal drawer" },
      { glyph: "⊘",  label: "Kill",     desc: "Abort the currently running command" },
      { glyph: "●",  label: "Running",  desc: "A command is actively executing" },
      { glyph: "✓",  label: "Exit 0",   desc: "Command completed successfully" },
      { glyph: "✗",  label: "Exit N",   desc: "Command failed with non-zero exit code" },
    ],
  },
  "/dashboard/editor": {
    title: "Editor",
    items: [
      { glyph: "▸", label: "Folder",   desc: "Click to expand / collapse directory" },
      { glyph: "·", label: "File",     desc: "Click to open file in editor" },
      { glyph: "●", label: "Unsaved",  desc: "Yellow dot on tab = unsaved changes" },
      { glyph: "✓", label: "Saved",    desc: "Auto-save fires 1.2s after last keystroke" },
      { glyph: "▶", label: "Deploy",   desc: "Rebuild & restart this project via PM2" },
      { glyph: "×", label: "Close tab", desc: "Close the editor tab (file stays on disk)" },
    ],
  },
  "/dashboard/storage": {
    title: "Storage",
    items: [
      { glyph: "📁",    label: "Bucket",    desc: "A project-scoped folder in the CDN" },
      { glyph: "⬆",    label: "Upload",    desc: "Drag-drop or click to upload files" },
      { glyph: "🔗",   label: "Copy URL",  desc: "Copies the permanent public CDN link" },
      { glyph: "⧉",    label: "Open",      desc: "Open the file in a new browser tab" },
      { glyph: "✕",    label: "Delete",    desc: "Permanently remove the file from CDN" },
      { glyph: "/media/", label: "Path prefix", desc: "All CDN files are served under /media/" },
    ],
  },
};

function getLegend(pathname: string): PageLegend | null {
  if (LEGENDS[pathname]) return LEGENDS[pathname];
  const match = Object.keys(LEGENDS)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? LEGENDS[match] : null;
}

// ── Styled ───────────────────────────────────────────────────────

const PANEL_WIDTH = 300;

const Tab = styled(DrawerTab).attrs<{ $anchor: "left" | "right" }>((p) => ({
  $side: p.$anchor,
  $accent: "cyan",
}))<{ $open: boolean; $anchor: "left" | "right" }>`
  ${(p) => p.$anchor === "right"
    ? `right: ${p.$open ? `${PANEL_WIDTH}px` : "0"};`
    : `left: ${p.$open ? `${PANEL_WIDTH}px` : "0"};`}
  ${(p) => (p.$anchor === "right" ? "border-right: none;" : "border-left: none;")}
  padding-top: 14px;
  padding-bottom: 14px;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), right 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
  background: ${(p) => (p.$open ? `rgba(${rgb.cyan}, 0.22)` : `rgba(${rgb.cyan}, 0.08)`)};
  box-shadow: ${(p) => (p.$open
    ? (p.$anchor === "right" ? `-4px 0 16px rgba(${rgb.cyan}, 0.25)` : `4px 0 16px rgba(${rgb.cyan}, 0.25)`)
    : "none")};
`;

const Panel = styled(DrawerPanel)<{ $anchor: "left" | "right" }>`
  ${(p) => (p.$anchor === "right" ? "right: 0;" : "left: 0;")}
  width: ${PANEL_WIDTH}px;
  background: #07090d;
  ${(p) => (p.$anchor === "right"
    ? `border-left: 1px solid rgba(${rgb.cyan}, 0.25);`
    : `border-right: 1px solid rgba(${rgb.cyan}, 0.25);`)}
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  [data-theme="light"] & {
    background: var(--t-surface);
    ${(p) => (p.$anchor === "right" ? "border-left-color" : "border-right-color")}: rgba(${rgb.cyan}, 0.2);
  }
`;

const Header = styled(DrawerHeader)`
  justify-content: space-between;
  padding: 1rem 1.25rem;
`;

const HeaderLabel = styled.p`
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  color: var(--t-textGhost);
  margin: 0 0 0.125rem;
`;

const HeaderTitle = styled(DrawerTitle).attrs({ $accent: "cyan" })``;

const ItemList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Item = styled.div`
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
`;

const ItemGlyph = styled.span`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  font-weight: 700;
  flex-shrink: 0;
  width: 2.5rem;
  text-align: right;
  color: ${colors.cyan};
  line-height: 1.4;
`;

const ItemLabel = styled.p`
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--t-textMuted);
  margin: 0;
  line-height: 1.3;
`;

const ItemDesc = styled.p`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  margin: 0.125rem 0 0;
  line-height: 1.4;
`;

const Footer = styled(DrawerFooter)``;

const ActionBtn = styled.button`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid ${glowRgba("cyan", 0.45)};
  color: ${colors.cyan};
  text-shadow: 0 0 6px rgba(${rgb.cyan}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.cyan}, 0.5);
  }

  &:active {
    transform: translateY(1px);
  }

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

// ── Constants ────────────────────────────────────────────────────

const TAB_STORAGE_KEY = "tgv-drawer-tab-legend-y";
const DRAWER_ID = "legend";

function getDefaultTabY() {
  if (typeof window === "undefined") return 400;
  return Math.round(window.innerHeight * 0.5);
}

// ── Component ────────────────────────────────────────────────────

export default function LegendDrawer() {
  const [open, setOpen] = useState(false);
  const [tabY, setTabY] = useState<number>(400);
  const [anchor, setAnchor] = useDrawerPersistedState<"left" | "right">(DRAWER_ID, "anchor", "right");
  const pathname = usePathname();
  const legend = getLegend(pathname ?? "");
  const { hideKnob } = useKnobVisibility();

  const startTabY = useRef(0);
  const startTabPos = useRef(0);
  const didDrag = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());
  }, []);

  const { position: stackPosition } = useDrawerLifecycle({
    id: DRAWER_ID,
    open,
    setOpen,
  });

  const onTabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startTabY.current = e.clientY;
    startTabPos.current = tabY;
    didDrag.current = false;

    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startTabY.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      if (didDrag.current) {
        const next = Math.max(40, Math.min(window.innerHeight - 100, startTabPos.current + delta));
        setTabY(next);
        localStorage.setItem(TAB_STORAGE_KEY, String(next));
      }
    };
    const onUp = () => {
      if (!didDrag.current) setOpen((p) => !p);
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tabY]);

  if (!legend) return null;

  const flipAnchor = () => setAnchor((p) => (p === "left" ? "right" : "left"));
  const stackZ = 60 + Math.max(0, stackPosition) * 2;
  const closedTransform = anchor === "right" ? "translateX(100%)" : "translateX(-100%)";
  const flipTitle = anchor === "right" ? "Mirror to left edge" : "Mirror to right edge";
  const arrowSide: "left" | "right" = anchor === "right"
    ? (open ? "left" : "right")
    : (open ? "right" : "left");

  return (
    <>
      {!hideKnob && (
        <Tab
          {...{ [DRAWER_DATA_ATTR]: DRAWER_ID }}
          $open={open}
          $anchor={anchor}
          onMouseDown={onTabMouseDown}
          title="Page legend"
          style={{ top: tabY, zIndex: open ? stackZ + 1 : 100 }}
        >
          <DTogExpandIcon side={arrowSide} size={14} />
          <DrawerTabLabel>Legend</DrawerTabLabel>
        </Tab>
      )}

      <Panel
        {...{ [DRAWER_DATA_ATTR]: DRAWER_ID }}
        $anchor={anchor}
        style={{
          transform: open ? "translateX(0)" : closedTransform,
          boxShadow: open
            ? (anchor === "right" ? "-8px 0 40px rgba(0,0,0,0.6)" : "8px 0 40px rgba(0,0,0,0.6)")
            : "none",
          zIndex: stackZ,
        }}
      >
        <Header>
          <div>
            <HeaderLabel>Page Legend</HeaderLabel>
            <HeaderTitle>{legend.title}</HeaderTitle>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <ActionBtn onClick={flipAnchor} title={flipTitle} aria-label={flipTitle}>⇄</ActionBtn>
            <NeonX accent="gold" onClick={() => setOpen(false)} title="Close legend" />
          </div>
        </Header>

        <ItemList>
          {legend.items.map((item) => (
            <Item key={item.glyph + item.label}>
              <ItemGlyph>{item.glyph}</ItemGlyph>
              <div>
                <ItemLabel>{item.label}</ItemLabel>
                <ItemDesc>{item.desc}</ItemDesc>
              </div>
            </Item>
          ))}
        </ItemList>

        <Footer>Legend updates per page</Footer>
      </Panel>
    </>
  );
}
