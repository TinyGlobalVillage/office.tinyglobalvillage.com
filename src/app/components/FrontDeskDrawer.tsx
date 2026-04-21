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
  DrawerTitle,
  PanelIconBtn,
} from "../styled";
import PhoneTab from "./frontdesk/PhoneTab";
import SmsTab from "./frontdesk/SmsTab";
import ContactsTab from "./frontdesk/ContactsTab";
import AlertsTab from "./frontdesk/AlertsTab";
import {
  DrawerFrontDeskIcon,
  PhoneIcon,
  ChatIcon,
  ContactIcon,
  DrawerAlertsIcon,
} from "./icons";
import NeonX from "./NeonX";
import { useKnobVisibility } from "../lib/drawerKnobs";

const MIN_W = 420;
const MAX_W = 1400;
const DEFAULT_W = 640;
const DRAWER_EVENT = "tgv-right-drawer";
const DRAWER_ID = "frontdesk";

type FrontDeskTab = "phone" | "sms" | "contacts" | "alerts";
const TAB_ORDER: FrontDeskTab[] = ["phone", "sms", "contacts", "alerts"];
const TAB_STORAGE_KEY = "frontdesk-drawer-tab";

// Alphabetical stack with Alerts slot (gold, ~20% from top).
function getDefaultTabY() {
  if (typeof window === "undefined") return 180;
  return Math.round(window.innerHeight * 0.2);
}

// ── Styled ───────────────────────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "gold" })<{ $openOffset?: number; $open?: boolean }>`
  left: ${(p) => p.$openOffset ?? 0}px;
  z-index: 61;
  border-left: none;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;

  @media (max-width: 768px) {
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

// Desktop-only inline zoom trio — hidden on mobile; replaced by ZoomDDM below.
const ZoomTrio = styled.div`
  display: contents;

  @media (max-width: 768px) {
    display: none;
  }
`;

const ZoomDDMWrap = styled.div`
  position: relative;
  display: none;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: block;
  }
`;

const ZoomDDMTrigger = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  width: 3.25rem;
  height: 2.75rem;
  border-radius: 0.625rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  font-weight: 800;
  cursor: pointer;
  background: ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.28)` : `rgba(${rgb.gold}, 0.14)`)};
  border: 1px solid rgba(${rgb.gold}, ${(p) => (p.$open ? 0.6 : 0.45)});
  color: #f7b700;
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.7);

  [data-theme="light"] & { text-shadow: none; }
`;

const ZoomDDMArrow = styled.span<{ $open: boolean }>`
  font-size: 9px;
  transition: transform 0.2s;
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
  opacity: 0.8;
`;

const ZoomDDMPanel = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 90;
  display: flex;
  flex-direction: column;
  min-width: 160px;
  border-radius: 12px;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(${rgb.gold}, 0.25);
`;

const ZoomDDMItem = styled.button<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  font-size: 0.8125rem;
  font-weight: 700;
  font-family: var(--font-geist-mono), monospace;
  text-align: left;
  cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.35 : 1)};
  background: transparent;
  border: none;
  color: #f7b700;

  & + & {
    border-top: 1px solid rgba(${rgb.gold}, 0.18);
  }

  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.12);
  }
`;

const ZoomDDMGlyph = styled.span`
  font-size: 1rem;
  font-weight: 900;
  min-width: 1rem;
  text-align: center;
`;

const TabBar = styled.div`
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0 0.5rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.035);
`;

const TabBtn = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.85rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${(p) => (p.$active ? "#f7b700" : "var(--t-textGhost)")};
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.14)` : "transparent")};
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? "#f7b700" : "transparent")};
  text-shadow: ${(p) => (p.$active ? `0 0 6px rgba(${rgb.gold}, 0.55)` : "none")};
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;

  &:hover {
    color: #f7b700;
    background: rgba(${rgb.gold}, 0.08);
  }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }
`;

const ContentWrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "gold" })``;

// ── Tab metadata ─────────────────────────────────────────────────

const TAB_META: Record<FrontDeskTab, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  phone:    { label: "Phone",    Icon: PhoneIcon },
  sms:      { label: "SMS",      Icon: ChatIcon },
  contacts: { label: "Contacts", Icon: ContactIcon },
  alerts:   { label: "Alerts",   Icon: DrawerAlertsIcon },
};

// ── Component ────────────────────────────────────────────────────

export default function FrontDeskDrawer() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [zoomDDMOpen, setZoomDDMOpen] = useState(false);
  const [tabY, setTabY] = useState<number>(180);
  const [activeTab, setActiveTab] = useState<FrontDeskTab>("phone");
  const drawerRef = useRef<HTMLDivElement>(null);
  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  useEffect(() => {
    setTabY(getDefaultTabY());
    const savedZ = sessionStorage.getItem("frontdesk-drawer-zoom");
    if (savedZ) setZoom(parseFloat(savedZ));
    const savedW = sessionStorage.getItem("frontdesk-drawer-width");
    if (savedW) setWidth(parseInt(savedW, 10));
    const savedT = sessionStorage.getItem(TAB_STORAGE_KEY);
    if (savedT && (TAB_ORDER as string[]).includes(savedT)) {
      setActiveTab(savedT as FrontDeskTab);
    }
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
      const detail = (e as CustomEvent).detail;
      // Accept both the new "frontdesk" id and the legacy "alerts" id so older
      // dispatchers (tile buttons, deep links) keep working until migrated.
      if (detail === DRAWER_ID || detail === "alerts") {
        setOpen(true);
        if (detail === "alerts") setActiveTab("alerts");
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
      }
    };
    window.addEventListener("tgv-drawer-open", handler);
    return () => window.removeEventListener("tgv-drawer-open", handler);
  }, []);

  useEffect(() => {
    const openToPhone = () => {
      setOpen(true);
      window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
      setActiveTab("phone");
      sessionStorage.setItem(TAB_STORAGE_KEY, "phone");
    };
    const openToSms = () => {
      setOpen(true);
      window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
      setActiveTab("sms");
      sessionStorage.setItem(TAB_STORAGE_KEY, "sms");
    };
    window.addEventListener("frontdesk-dial-prefill", openToPhone);
    window.addEventListener("frontdesk-sms-open", openToSms);
    return () => {
      window.removeEventListener("frontdesk-dial-prefill", openToPhone);
      window.removeEventListener("frontdesk-sms-open", openToSms);
    };
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
      sessionStorage.setItem("frontdesk-drawer-width", String(newW));
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
  const zoomIn  = () => { const n = ZOOM_STEPS.find((z) => z > zoom) ?? zoom; setZoom(n); sessionStorage.setItem("frontdesk-drawer-zoom", String(n)); };
  const zoomOut = () => { const n = [...ZOOM_STEPS].reverse().find((z) => z < zoom) ?? zoom; setZoom(n); sessionStorage.setItem("frontdesk-drawer-zoom", String(n)); };
  const zoomReset = () => { setZoom(1); sessionStorage.setItem("frontdesk-drawer-zoom", "1"); };

  // Popout
  const popout = () => {
    const w = window.screen.width * 0.8;
    const h = window.screen.height * 0.85;
    const left = (window.screen.width - w) / 2;
    const top  = (window.screen.height - h) / 2;
    window.open(`/dashboard/frontdesk?popout=1&tab=${activeTab}`, "tgv-frontdesk-drawer", `width=${w},height=${h},left=${left},top=${top}`);
  };

  const switchTab = (t: FrontDeskTab) => {
    setActiveTab(t);
    sessionStorage.setItem(TAB_STORAGE_KEY, t);
  };

  useEffect(() => {
    if (!zoomDDMOpen) return;
    const close = () => setZoomDDMOpen(false);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomDDMOpen(false); };
    window.addEventListener("click", close);
    window.addEventListener("touchstart", close, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("touchstart", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [zoomDDMOpen]);

  return (
    <>
      {!otherDrawerOpen && !hideKnob && (
        <SideTab
          onMouseDown={onTabMouseDown}
          title={open ? "Close front desk" : "Open front desk"}
          $openOffset={open && !fullscreen ? width : 0}
          $open={open}
          style={{
            top: tabY,
            backgroundColor: open
              ? `rgba(${rgb.gold}, 0.25)`
              : `rgba(${rgb.gold}, 0.12)`,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <DrawerFrontDeskIcon size={16} />
          </span>
          <DrawerTabLabel>Front Desk</DrawerTabLabel>
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
          <DrawerTitle $accent="gold">
            <DrawerFrontDeskIcon size={14} />
            Front Desk
          </DrawerTitle>

          <ControlRow>
            <ZoomTrio>
              <ControlBtn onClick={zoomOut} title="Zoom out" disabled={zoom <= ZOOM_STEPS[0]}>−</ControlBtn>
              <ZoomLabel onClick={zoomReset} title={`Zoom: ${Math.round(zoom * 100)}% (click to reset)`}>
                {Math.round(zoom * 100)}%
              </ZoomLabel>
              <ControlBtn onClick={zoomIn} title="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}>+</ControlBtn>
            </ZoomTrio>

            <ZoomDDMWrap onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
              <ZoomDDMTrigger
                $open={zoomDDMOpen}
                onClick={() => setZoomDDMOpen((v) => !v)}
                title={`Zoom: ${Math.round(zoom * 100)}%`}
                aria-label={`Zoom ${Math.round(zoom * 100)}%`}
              >
                {Math.round(zoom * 100)}%
                <ZoomDDMArrow $open={zoomDDMOpen}>▾</ZoomDDMArrow>
              </ZoomDDMTrigger>
              {zoomDDMOpen && (
                <ZoomDDMPanel>
                  <ZoomDDMItem
                    disabled={zoom <= ZOOM_STEPS[0]}
                    $disabled={zoom <= ZOOM_STEPS[0]}
                    onClick={zoomOut}
                  >
                    <ZoomDDMGlyph>−</ZoomDDMGlyph>
                    <span>Zoom out</span>
                  </ZoomDDMItem>
                  <ZoomDDMItem
                    onClick={() => { zoomReset(); setZoomDDMOpen(false); }}
                  >
                    <ZoomDDMGlyph>⟳</ZoomDDMGlyph>
                    <span>Reset · 100%</span>
                  </ZoomDDMItem>
                  <ZoomDDMItem
                    disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                    $disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
                    onClick={zoomIn}
                  >
                    <ZoomDDMGlyph>+</ZoomDDMGlyph>
                    <span>Zoom in</span>
                  </ZoomDDMItem>
                </ZoomDDMPanel>
              )}
            </ZoomDDMWrap>

            <Separator />

            <ControlBtn onClick={popout} title="Open in new window">⧉</ControlBtn>
            <ControlBtn onClick={() => setFullscreen((p) => !p)} title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}>
              {fullscreen ? "⊡" : "⊞"}
            </ControlBtn>
            <NeonX accent="gold" onClick={() => { setOpen(false); setFullscreen(false); window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" })); }} title="Close (Esc)" />
          </ControlRow>
        </Header>

        <TabBar>
          {TAB_ORDER.map((t) => {
            const { label, Icon } = TAB_META[t];
            return (
              <TabBtn key={t} $active={activeTab === t} onClick={() => switchTab(t)} title={label}>
                <Icon size={14} />
                {label}
              </TabBtn>
            );
          })}
        </TabBar>

        <ContentWrap style={{ fontSize: `${zoom}rem` }}>
          {activeTab === "phone" && <PhoneTab />}
          {activeTab === "sms" && <SmsTab />}
          {activeTab === "contacts" && <ContactsTab />}
          {activeTab === "alerts" && <AlertsTab />}
        </ContentWrap>

        {!fullscreen && <Resize onMouseDown={onResizeStart} title="Drag to resize" />}
      </Panel>
    </>
  );
}

// ── Tab stubs (filled in by later phases) ────────────────────────

