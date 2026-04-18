"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import styled, { css } from "styled-components";
import { colors, rgb } from "../theme";
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
import EmailErrorBoundary from "./email/EmailErrorBoundary";

const EmailClient = dynamic(() => import("./email/EmailClient"), { ssr: false });

type Tab = "announcements" | "email";

const MIN_W = 420;
const MAX_W = 1400;
const DEFAULT_W = 680;
const TAB_STORAGE_KEY = "tgv-drawer-tab-mail-y";
const DRAWER_EVENT = "tgv-right-drawer";

function getDefaultTabY() {
  if (typeof window === "undefined") return 300;
  return Math.round(window.innerHeight * 0.5) - 50;
}

// ── Styled ───────────────────────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "pink" })`
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
  border-right: ${(p) => (p.$fs ? "none" : `1px solid rgba(${rgb.cyan}, 0.18)`)};

  [data-theme="light"] & {
    border-right-color: rgba(${rgb.cyan}, 0.1);
  }
`;

const Header = styled(DrawerHeader)`
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
`;

const TogglePill = styled.div`
  display: flex;
  align-items: center;
  border-radius: 999px;
  padding: 0.125rem;
  flex-shrink: 0;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
`;

const ToggleBtn = styled.button<{ $active?: boolean; $color?: string }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$active ? `${p.$color}66` : "transparent")};
  background: ${(p) => (p.$active ? `${p.$color}33` : "transparent")};
  color: ${(p) => (p.$active ? p.$color : "var(--t-textGhost)")};
  cursor: pointer;
  transition: all 0.15s;
`;

const ControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
`;

const ControlBtn = styled(PanelIconBtn)`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const ZoomLabel = styled.button`
  font-size: 0.5625rem;
  font-family: var(--font-geist-mono), monospace;
  padding: 0 0.375rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  border: none;
  background: var(--t-inputBg);
  color: var(--t-textGhost);
  cursor: pointer;
  min-width: 36px;
  transition: background 0.15s;

  &:hover {
    background: var(--t-border);
  }
`;

const Separator = styled.div`
  width: 1px;
  height: 1rem;
  margin: 0 0.25rem;
  background: var(--t-border);
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

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "cyan" })``;

// ── Component ────────────────────────────────────────────────────

export default function OfficeDrawer() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("announcements");
  const [width, setWidth] = useState(DEFAULT_W);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [tabY, setTabY] = useState<number>(300);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    setTabY(saved ? parseInt(saved, 10) : getDefaultTabY());
    const savedZ = sessionStorage.getItem("office-drawer-zoom");
    if (savedZ) setZoom(parseFloat(savedZ));
    const savedW = sessionStorage.getItem("office-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail !== "mail") setOpen(false);
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

  // ── Draggable tab pill ──────────────────────────────────────────
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
          if (next) window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "mail" }));
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

  // ── Resize drawer width ─────────────────────────────────────────
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
      sessionStorage.setItem("office-drawer-width", String(newW));
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

  // ── Zoom ────────────────────────────────────────────────────────
  const ZOOM_STEPS = [0.8, 0.9, 1.0, 1.1, 1.25];
  const zoomIn  = () => { const n = ZOOM_STEPS.find((z) => z > zoom) ?? zoom; setZoom(n); sessionStorage.setItem("office-drawer-zoom", String(n)); };
  const zoomOut = () => { const n = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom; setZoom(n); sessionStorage.setItem("office-drawer-zoom", String(n)); };
  const zoomReset = () => { setZoom(1); sessionStorage.setItem("office-drawer-zoom", "1"); };

  // ── Popout ──────────────────────────────────────────────────────
  const popout = () => {
    const w = window.screen.width * 0.8;
    const h = window.screen.height * 0.85;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;
    const url  = tab === "email" ? "/dashboard/email?popout=1" : "/dashboard/announcements?popout=1";
    window.open(url, "tgv-office-drawer", `width=${w},height=${h},left=${left},top=${top}`);
  };

  return (
    <>
      <SideTab
        onMouseDown={onTabMouseDown}
        title={open ? "Close drawer" : "Open mail & announcements"}
        style={{
          top: tabY,
          background: open
            ? `rgba(${rgb.pink}, 0.25)`
            : `rgba(${rgb.pink}, 0.12)`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          {open ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="13" height="11" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="0.65" y="0.65" width="11.7" height="9.7" rx="1.4"/>
              <path d="M0.65 2.8L6.5 6.2l5.85-3.4"/>
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
          <TogglePill>
            {(["announcements", "email"] as Tab[]).map((t) => (
              <ToggleBtn
                key={t}
                $active={tab === t}
                $color={t === "email" ? colors.cyan : colors.gold}
                onClick={() => setTab(t)}
              >
                {t === "email" ? "✉ Inbox" : "📢 Alerts"}
              </ToggleBtn>
            ))}
          </TogglePill>

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
          {tab === "announcements" && (
            <AnnounceWrap>
              <AnnouncementsPanel />
              <EmptyNote>
                All caught up — no pending announcements.
              </EmptyNote>
            </AnnounceWrap>
          )}
          {tab === "email" && (
            <EmailErrorBoundary>
              <EmailClient zoom={zoom} />
            </EmailErrorBoundary>
          )}
        </ContentWrap>

        {!fullscreen && <Resize onMouseDown={onResizeStart} title="Drag to resize" />}
      </Panel>
    </>
  );
}
