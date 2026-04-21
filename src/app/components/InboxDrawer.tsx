"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
import { rgb } from "../theme";
import {
  DrawerBackdrop,
  DrawerPanel,
  DrawerHeader,
  DrawerTab,
  DrawerTabLabel,
  DrawerResizeHandle,
  DrawerTitle,
  PanelIconBtn,
} from "../styled";
import { DrawerInboxIcon } from "./icons";
import NeonX from "./NeonX";
import { useKnobVisibility } from "../lib/drawerKnobs";

const EmailErrorBoundary = dynamic(
  () => import("@tgv/module-inbox/components/EmailErrorBoundary"),
  { ssr: false }
);
const EmailClient = dynamic(
  () => import("@tgv/module-inbox/components/EmailClient"),
  { ssr: false }
);

const MIN_W = 420;
const MAX_W = 1400;
const DEFAULT_W = 720;
const TAB_STORAGE_KEY = "tgv-drawer-tab-inbox-y";
const DRAWER_EVENT = "tgv-right-drawer";
const DRAWER_ID = "inbox";

// Alphabetical stack: Alerts=20%, Chats=40%, Inbox=60%, Sessions=80%
function getDefaultTabY() {
  if (typeof window === "undefined") return 540;
  return Math.round(window.innerHeight * 0.6);
}

// ── Styled ───────────────────────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "cyan" })<{ $openLeft: string; $open: boolean }>`
  left: ${(p) => p.$openLeft};
  z-index: 62;
  border-left: none;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
  backdrop-filter: ${(p) => (p.$open ? "none" : "blur(8px)")};

  @media (max-width: 768px) {
    left: ${(p) => (p.$openLeft === "0" ? "0" : "calc(100vw - 28px)")};
    ${(p) => (p.$open ? "display: none;" : "")}
  }
`;

const Backdrop = styled(DrawerBackdrop)`
  z-index: 55;
  backdrop-filter: blur(1px);
`;

const Panel = styled(DrawerPanel)<{ $fs?: boolean }>`
  left: 0;
  z-index: 60;
  max-width: ${(p) => (p.$fs ? "100vw" : "85vw")};
  border-right: ${(p) => (p.$fs ? "none" : `1px solid rgba(${rgb.cyan}, 0.18)`)};

  [data-theme="light"] & {
    border-right-color: rgba(${rgb.cyan}, 0.1);
  }
`;

const Header = styled(DrawerHeader)`
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(${rgb.cyan}, 0.15);
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
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.45);
  color: #00bfff;
  text-shadow: 0 0 6px rgba(${rgb.cyan}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.cyan}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.cyan}, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.1875rem;
    border-radius: 0.625rem;
  }
`;

const ZoomLabel = styled.button`
  font-size: 0.6875rem;
  font-weight: 800;
  font-family: var(--font-geist-mono), monospace;
  padding: 0 0.5rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.cyan}, 0.14);
  border: 1px solid rgba(${rgb.cyan}, 0.45);
  color: #00bfff;
  text-shadow: 0 0 6px rgba(${rgb.cyan}, 0.7);
  cursor: pointer;
  min-width: 44px;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${rgb.cyan}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.cyan}, 0.5);
  }

  [data-theme="light"] & { text-shadow: none; }
`;

const Separator = styled.div`
  width: 1px;
  height: 1.25rem;
  margin: 0 0.375rem;
  background: rgba(${rgb.cyan}, 0.3);
`;

const ContentWrap = styled.div`
  flex: 1;
  overflow: hidden;
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "cyan" })``;

// ── Component ────────────────────────────────────────────────────

export default function InboxDrawer() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [tabY, setTabY] = useState<number>(540);
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    setTabY(getDefaultTabY());
    const savedZ = sessionStorage.getItem("inbox-drawer-zoom");
    if (savedZ) setZoom(parseFloat(savedZ));
    const savedW = sessionStorage.getItem("inbox-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
  }, []);

  const [otherDrawerOpen, setOtherDrawerOpen] = useState(false);
  const { hideKnob } = useKnobVisibility();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === DRAWER_ID) {
        setOtherDrawerOpen(false);
      } else if (detail === "close") {
        setOtherDrawerOpen(false);
      } else {
        if (open) setOpen(false);
        setOtherDrawerOpen(true);
      }
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === DRAWER_ID) {
        setOpen(true);
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
      }
    };
    window.addEventListener("tgv-drawer-open", handler);
    return () => window.removeEventListener("tgv-drawer-open", handler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && fullscreen) { setFullscreen(false); return; }
      if (e.key === "Escape" && open) {
        setOpen(false);
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" }));
      }
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
      }
    };
    const onUp = () => {
      if (!didDrag.current) {
        setOpen((p) => {
          const next = !p;
          window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: next ? DRAWER_ID : "close" }));
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
      sessionStorage.setItem("inbox-drawer-width", String(newW));
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
  const zoomIn  = () => { const n = ZOOM_STEPS.find((z) => z > zoom) ?? zoom; setZoom(n); sessionStorage.setItem("inbox-drawer-zoom", String(n)); };
  const zoomOut = () => { const n = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom; setZoom(n); sessionStorage.setItem("inbox-drawer-zoom", String(n)); };
  const zoomReset = () => { setZoom(1); sessionStorage.setItem("inbox-drawer-zoom", "1"); };

  // Popout
  const popout = () => {
    const w = window.screen.width * 0.8;
    const h = window.screen.height * 0.85;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;
    window.open("/dashboard/email?popout=1", "tgv-inbox-drawer", `width=${w},height=${h},left=${left},top=${top}`);
  };

  return (
    <>
      {!otherDrawerOpen && !hideKnob && (
        <SideTab
          onMouseDown={onTabMouseDown}
          title={open ? "Close inbox" : "Open inbox"}
          $open={open && !fullscreen}
          $openLeft={open && !fullscreen ? `min(${width}px, 85vw)` : "0"}
          style={{
            top: tabY,
            backgroundColor: open
              ? `rgba(${rgb.cyan}, 0.25)`
              : `rgba(${rgb.cyan}, 0.12)`,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DrawerInboxIcon size={16} />
          </span>
          <DrawerTabLabel>Inbox</DrawerTabLabel>
        </SideTab>
      )}

      {open && !fullscreen && (
        <Backdrop onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" })); }} />
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
          <DrawerTitle $accent="cyan">
            <svg width="14" height="12" viewBox="0 0 13 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="0.65" y="0.65" width="11.7" height="9.7" rx="1.4"/>
              <path d="M0.65 2.8L6.5 6.2l5.85-3.4"/>
            </svg>
            Inbox
          </DrawerTitle>

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
            <NeonX accent="cyan" onClick={() => { setOpen(false); setFullscreen(false); window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" })); }} title="Close (Esc)" />
          </ControlRow>
        </Header>

        <ContentWrap style={{ fontSize: `${zoom}rem` }}>
          <EmailErrorBoundary>
            <EmailClient zoom={zoom} />
          </EmailErrorBoundary>
        </ContentWrap>

        {!fullscreen && <Resize onMouseDown={onResizeStart} title="Drag to resize" />}
      </Panel>
    </>
  );
}
