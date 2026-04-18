"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styled from "styled-components";
import { rgb } from "../theme";
import {
  DrawerBackdrop,
  DrawerPanel,
  DrawerHeader,
  DrawerTab,
  DrawerTabLabel,
  DrawerResizeHandle,
  PanelIconBtn,
} from "../styled";
import AnnouncementsPanel from "./AnnouncementsPanel";

const MIN_W = 420;
const MAX_W = 1400;
const DEFAULT_W = 640;
const TAB_STORAGE_KEY = "tgv-drawer-tab-alerts-y";
const DRAWER_EVENT = "tgv-right-drawer";
const DRAWER_ID = "alerts";

// Alphabetical stack: Alerts=20%, Chats=40%, Inbox=60%, Sessions=80%
function getDefaultTabY() {
  if (typeof window === "undefined") return 180;
  return Math.round(window.innerHeight * 0.2);
}

// ── Styled ───────────────────────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "gold" })`
  left: 0;
  z-index: 61;
  border-left: none;
`;

const Backdrop = styled(DrawerBackdrop)`
  z-index: 55;
  backdrop-filter: blur(1px);
`;

const Panel = styled(DrawerPanel)<{ $fs?: boolean }>`
  left: 0;
  z-index: 60;
  max-width: ${(p) => (p.$fs ? "100vw" : "85vw")};
  border-right: ${(p) => (p.$fs ? "none" : `1px solid rgba(${rgb.gold}, 0.18)`)};

  [data-theme="light"] & {
    border-right-color: rgba(${rgb.gold}, 0.1);
  }
`;

const Header = styled(DrawerHeader)`
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.15);
`;

const Title = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #f7b700;
  text-shadow: 0 0 8px rgba(${rgb.gold}, 0.6);
  display: flex;
  align-items: center;
  gap: 0.5rem;

  [data-theme="light"] & { text-shadow: none; }
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
`;

const ControlBtn = styled(PanelIconBtn)`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  background: rgba(${rgb.gold}, 0.14);
  border: 1px solid rgba(${rgb.gold}, 0.45);
  color: #f7b700;
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & { text-shadow: none; }
`;

const ZoomLabel = styled.button`
  font-size: 0.6875rem;
  font-weight: 800;
  font-family: var(--font-geist-mono), monospace;
  padding: 0 0.5rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.14);
  border: 1px solid rgba(${rgb.gold}, 0.45);
  color: #f7b700;
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.7);
  cursor: pointer;
  min-width: 44px;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${rgb.gold}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.5);
  }

  [data-theme="light"] & { text-shadow: none; }
`;

const Separator = styled.div`
  width: 1px;
  height: 1.25rem;
  margin: 0 0.375rem;
  background: rgba(${rgb.gold}, 0.3);
`;

const ContentWrap = styled.div`
  flex: 1;
  overflow: hidden;
`;

const AnnounceWrap = styled.div`
  height: 100%;
  overflow-y: auto;
  padding: 1rem;
`;

const EmptyNote = styled.div`
  text-align: center;
  padding: 4rem 0;
  color: var(--t-textGhost);
  font-size: 0.875rem;
  user-select: none;
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "gold" })``;

// ── Component ────────────────────────────────────────────────────

export default function AlertsDrawer() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [tabY, setTabY] = useState<number>(180);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());
    const savedZ = sessionStorage.getItem("alerts-drawer-zoom");
    if (savedZ) setZoom(parseFloat(savedZ));
    const savedW = sessionStorage.getItem("alerts-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== DRAWER_ID) setOpen(false);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) { setFullscreen(false); return; }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullscreen]);

  // Draggable tab pill
  const startTabY = useRef(0);
  const startTabPos = useRef(0);
  const didDrag = useRef(false);

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
      if (!didDrag.current) {
        setOpen((p) => {
          const next = !p;
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
          return next;
        });
      }
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "ns-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [tabY]);

  // Resize width
  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = ev.clientX - startX.current;
      const newW = Math.min(MAX_W, Math.max(MIN_W, startW.current + delta));
      setWidth(newW);
      sessionStorage.setItem("alerts-drawer-width", String(newW));
    };
    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // Zoom
  const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25];
  const zoomIn  = () => { const n = ZOOM_STEPS.find((z) => z > zoom) ?? zoom; setZoom(n); sessionStorage.setItem("alerts-drawer-zoom", String(n)); };
  const zoomOut = () => { const n = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom; setZoom(n); sessionStorage.setItem("alerts-drawer-zoom", String(n)); };
  const zoomReset = () => { setZoom(1); sessionStorage.setItem("alerts-drawer-zoom", "1"); };

  // Popout
  const popout = () => {
    const w = window.screen.width * 0.8;
    const h = window.screen.height * 0.85;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;
    window.open("/dashboard/announcements?popout=1", "tgv-alerts-drawer", `width=${w},height=${h},left=${left},top=${top}`);
  };

  return (
    <>
      <SideTab
        onMouseDown={onTabMouseDown}
        title={open ? "Close alerts" : "Open alerts"}
        style={{
          top: tabY,
          background: open
            ? `rgba(${rgb.gold}, 0.25)`
            : `rgba(${rgb.gold}, 0.12)`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {open ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          )}
        </span>
        <DrawerTabLabel>Alerts</DrawerTabLabel>
      </SideTab>

      {open && !fullscreen && (
        <Backdrop onClick={() => setOpen(false)} />
      )}

      <Panel
        ref={drawerRef}
        $fs={fullscreen}
        style={{
          width: fullscreen ? "100vw" : width,
          transform: open ? "translateX(0)" : "translateX(-100%)",
          transition: resizing.current ? "none" : "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: open && !fullscreen ? "12px 0 60px rgba(0,0,0,0.7)" : "none",
        }}
      >
        <Header>
          <Title>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Alerts
          </Title>

          <ControlRow>
            <ControlBtn onClick={zoomOut} title="Zoom out" disabled={zoom <= ZOOM_STEPS[0]}>−</ControlBtn>
            <ZoomLabel onClick={zoomReset} title={`Zoom: ${Math.round(zoom * 100)}% (click to reset)`}>
              {Math.round(zoom * 100)}%
            </ZoomLabel>
            <ControlBtn onClick={zoomIn} title="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</ControlBtn>

            <Separator />

            <ControlBtn onClick={popout} title="Open in new window">⧉</ControlBtn>
            <ControlBtn onClick={() => setFullscreen((p) => !p)} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}>
              {fullscreen ? "⊡" : "⊞"}
            </ControlBtn>
            <ControlBtn onClick={() => { setOpen(false); setFullscreen(false); }} title="Close (Esc)">✕</ControlBtn>
          </ControlRow>
        </Header>

        <ContentWrap style={{ fontSize: `${zoom}rem` }}>
          <AnnounceWrap>
            <AnnouncementsPanel />
            <EmptyNote>All caught up — no pending announcements.</EmptyNote>
          </AnnounceWrap>
        </ContentWrap>

        {!fullscreen && <Resize onMouseDown={onResizeStart} title="Drag to resize" />}
      </Panel>
    </>
  );
}
