"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styled from "styled-components";
import { colors, rgb, glowRgba, type GlowColor } from "../theme";
import NeonX from "./NeonX";

type Props = {
  pageKey: string;
  title: string;
  glow: GlowColor;
  onClose: () => void;
};

const HEARTBEAT_MS = 1200;
const STALE_MS = 3500;
const ZOOM_STEP = 10;
const ZOOM_MIN = 50;
const ZOOM_MAX = 200;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--t-overlay);
  backdrop-filter: blur(4px);
`;

const Panel = styled.div<{ $glow: GlowColor; $fs: boolean }>`
  position: fixed;
  ${(p) => (p.$fs ? "inset: 0;" : "top: 3%; bottom: 3%; left: 3%; right: 3%;")}
  z-index: 81;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--t-surface);
  border: ${(p) => (p.$fs ? "none" : `1px solid ${glowRgba(p.$glow, 0.3)}`)};
  border-radius: ${(p) => (p.$fs ? "0" : "12px")};
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.75),
    0 0 40px ${(p) => glowRgba(p.$glow, 0.12)};

  @media (max-width: 768px) {
    inset: 0;
    border: none;
    border-radius: 0;
  }
`;

const Header = styled.div<{ $glow: GlowColor }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid ${(p) => glowRgba(p.$glow, 0.2)};
  flex-shrink: 0;
  background: ${(p) => glowRgba(p.$glow, 0.06)};

  @media (max-width: 768px) {
    gap: 0.375rem;
    padding: 0.375rem 0.5rem;
  }
`;

const Title = styled.h2<{ $glow: GlowColor }>`
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin: 0 0.25rem;
  color: ${(p) => colors[p.$glow]};

  @media (max-width: 768px) {
    font-size: 0.5625rem;
    letter-spacing: 0.08em;
    margin: 0;
    max-width: 42vw;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Spacer = styled.div`flex: 1;`;

const CtrlBtn = styled.button<{ $glow: GlowColor; $active?: boolean }>`
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
  flex-shrink: 0;
  background: ${(p) =>
    p.$active ? `rgba(${rgb[p.$glow]}, 0.28)` : `rgba(${rgb[p.$glow]}, 0.14)`};
  border: 1px solid ${(p) => glowRgba(p.$glow, p.$active ? 0.6 : 0.45)};
  color: ${(p) => colors[p.$glow]};
  text-shadow: 0 0 6px rgba(${(p) => rgb[p.$glow]}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${(p) => rgb[p.$glow]}, 0.28);
    box-shadow: 0 0 10px rgba(${(p) => rgb[p.$glow]}, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & {
    text-shadow: none;
  }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.1875rem;
    border-radius: 0.625rem;
  }
`;

const ZoomLabel = styled.button<{ $glow: GlowColor }>`
  min-width: 44px;
  height: 2.125rem;
  border-radius: 0.5rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
  font-weight: 700;
  padding: 0 0.5rem;
  cursor: pointer;
  background: rgba(${(p) => rgb[p.$glow]}, 0.14);
  border: 1px solid ${(p) => glowRgba(p.$glow, 0.45)};
  color: ${(p) => colors[p.$glow]};
  text-shadow: 0 0 6px rgba(${(p) => rgb[p.$glow]}, 0.7);

  &:hover {
    background: rgba(${(p) => rgb[p.$glow]}, 0.22);
  }

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const Separator = styled.div<{ $glow: GlowColor }>`
  width: 1px;
  height: 1.25rem;
  background: ${(p) => glowRgba(p.$glow, 0.3)};
  margin: 0 0.25rem;

  @media (max-width: 768px) {
    display: none;
  }
`;

// Desktop-only trio (zoom-out, label, zoom-in). Hidden on mobile in favour of
// the collapsed ZoomDDM below.
const ZoomTrio = styled.div`
  display: contents;

  @media (max-width: 768px) {
    display: none;
  }
`;

// Mobile-only collapsed zoom control — tap to open a small DDM with −/reset/+.
const ZoomDDMWrap = styled.div`
  position: relative;
  display: none;
  flex-shrink: 0;

  @media (max-width: 768px) {
    display: block;
  }
`;

const ZoomDDMTrigger = styled.button<{ $glow: GlowColor; $open: boolean }>`
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
  background: ${(p) =>
    p.$open ? `rgba(${rgb[p.$glow]}, 0.28)` : `rgba(${rgb[p.$glow]}, 0.14)`};
  border: 1px solid ${(p) => glowRgba(p.$glow, p.$open ? 0.6 : 0.45)};
  color: ${(p) => colors[p.$glow]};
  text-shadow: 0 0 6px rgba(${(p) => rgb[p.$glow]}, 0.7);

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const ZoomDDMArrow = styled.span<{ $open: boolean }>`
  font-size: 9px;
  transition: transform 0.2s;
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
  opacity: 0.8;
`;

const ZoomDDMPanel = styled.div<{ $glow: GlowColor }>`
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
  border: 1px solid ${(p) => glowRgba(p.$glow, 0.4)};
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65),
    0 0 20px ${(p) => glowRgba(p.$glow, 0.25)};
`;

const ZoomDDMItem = styled.button<{ $glow: GlowColor; $disabled?: boolean }>`
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
  color: ${(p) => colors[p.$glow]};

  & + & {
    border-top: 1px solid ${(p) => glowRgba(p.$glow, 0.18)};
  }

  &:hover:not(:disabled) {
    background: ${(p) => glowRgba(p.$glow, 0.12)};
  }
`;

const ZoomDDMGlyph = styled.span`
  font-size: 1rem;
  font-weight: 900;
  min-width: 1rem;
  text-align: center;
`;

const Body = styled.div`
  position: relative;
  flex: 1;
  overflow: hidden;
`;

const FrameShell = styled.div<{ $zoom: number }>`
  width: ${(p) => `${100 / (p.$zoom / 100)}%`};
  height: ${(p) => `${100 / (p.$zoom / 100)}%`};
  transform: ${(p) => `scale(${p.$zoom / 100})`};
  transform-origin: 0 0;
`;

const Frame = styled.iframe`
  width: 100%;
  height: 100%;
  border: none;
  background: var(--t-bg);
  display: block;
`;

const Blackout = styled.div<{ $glow: GlowColor }>`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  background: rgba(0, 0, 0, 0.85);
  text-align: center;

  [data-theme="light"] & {
    background: rgba(20, 20, 25, 0.85);
  }
`;

const BlackoutMsg = styled.p`
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
`;

const BlackoutSub = styled.p`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  max-width: 24rem;
  margin: 0;
`;

const BlackoutBtn = styled.button<{ $glow: GlowColor }>`
  margin-top: 0.5rem;
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(${(p) => rgb[p.$glow]}, 0.18);
  border: 1px solid ${(p) => glowRgba(p.$glow, 0.5)};
  color: ${(p) => colors[p.$glow]};

  &:hover {
    background: rgba(${(p) => rgb[p.$glow]}, 0.28);
    box-shadow: 0 0 12px ${(p) => glowRgba(p.$glow, 0.45)};
  }
`;

const SidebarSvg = ({ open }: { open: boolean }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="9" y1="4" x2="9" y2="20" />
    <line x1="15" y1="4" x2="15" y2="20" />
    {open && <circle cx="6" cy="12" r="0.8" fill="currentColor" />}
  </svg>
);

export default function DashboardPageModal({ pageKey, title, glow, onClose }: Props) {
  const [sidebarShown, setSidebarShown] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [zoomDDMOpen, setZoomDDMOpen] = useState(false);
  const [popoutActive, setPopoutActive] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const channelName = `tgv-dash-${pageKey}-popout`;
  const windowName = `tgv-dash-${pageKey}-popout`;
  const lastBeat = useRef<number>(0);
  const iframeSrc = `/dashboard/${pageKey}?embedded=1`;

  useEffect(() => {
    const prevModal = document.body.dataset.dashboardModal;
    const prevSide = document.body.dataset.dashboardSidebar;
    document.body.dataset.dashboardModal = "open";
    document.body.dataset.dashboardSidebar = sidebarShown ? "shown" : "hidden";
    return () => {
      if (prevModal === undefined) delete document.body.dataset.dashboardModal;
      else document.body.dataset.dashboardModal = prevModal;
      if (prevSide === undefined) delete document.body.dataset.dashboardSidebar;
      else document.body.dataset.dashboardSidebar = prevSide;
    };
  }, [sidebarShown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  // ESC pressed inside the embedded iframe can't bubble up to the parent;
  // the iframe forwards it as a postMessage so the modal still closes.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "tgv-modal-close") onClose();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onClose]);

  // Popout ↔ main coordination via BroadcastChannel heartbeat.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(channelName);

    const check = setInterval(() => {
      if (lastBeat.current && Date.now() - lastBeat.current > STALE_MS) {
        setPopoutActive(false);
        lastBeat.current = 0;
      }
    }, 700);

    bc.onmessage = (e) => {
      const t = e.data?.type;
      if (t === "popout-open") {
        lastBeat.current = Date.now();
        setPopoutActive(true);
      } else if (t === "popout-close") {
        lastBeat.current = 0;
        setPopoutActive(false);
        setIframeKey((k) => k + 1);
      }
    };

    bc.postMessage({ type: "ping" });

    return () => {
      clearInterval(check);
      bc.close();
    };
  }, [channelName]);

  const openPopout = useCallback(() => {
    const w = Math.round(window.screen.width * 0.8);
    const h = Math.round(window.screen.height * 0.85);
    const left = Math.round((window.screen.width - w) / 2);
    const top = Math.round((window.screen.height - h) / 2);
    window.open(
      `/dashboard/${pageKey}?popout=1`,
      windowName,
      `width=${w},height=${h},left=${left},top=${top}`
    );
  }, [pageKey, windowName]);

  const closePopout = useCallback(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(channelName);
    bc.postMessage({ type: "popout-close-request" });
    bc.close();
  }, [channelName]);

  return (
    <>
      <Backdrop onClick={onClose} />
      <Panel $glow={glow} $fs={fullscreen} role="dialog" aria-modal="true" aria-label={title}>
        <Header $glow={glow}>
          <Title $glow={glow}>{title}</Title>
          <Spacer />

          <ZoomTrio>
            <CtrlBtn
              $glow={glow}
              onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Zoom out"
              title="Zoom out"
            >
              −
            </CtrlBtn>
            <ZoomLabel
              $glow={glow}
              onClick={() => setZoom(100)}
              aria-label={`Zoom ${zoom}% (click to reset)`}
              title="Reset zoom"
            >
              {zoom}%
            </ZoomLabel>
            <CtrlBtn
              $glow={glow}
              onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Zoom in"
              title="Zoom in"
            >
              +
            </CtrlBtn>
          </ZoomTrio>

          <ZoomDDMWrap onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <ZoomDDMTrigger
              $glow={glow}
              $open={zoomDDMOpen}
              onClick={() => setZoomDDMOpen((v) => !v)}
              aria-label={`Zoom ${zoom}%`}
              title="Zoom"
            >
              {zoom}%
              <ZoomDDMArrow $open={zoomDDMOpen}>▾</ZoomDDMArrow>
            </ZoomDDMTrigger>
            {zoomDDMOpen && (
              <ZoomDDMPanel $glow={glow}>
                <ZoomDDMItem
                  $glow={glow}
                  disabled={zoom <= ZOOM_MIN}
                  $disabled={zoom <= ZOOM_MIN}
                  onClick={() => {
                    setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP));
                  }}
                >
                  <ZoomDDMGlyph>−</ZoomDDMGlyph>
                  <span>Zoom out</span>
                </ZoomDDMItem>
                <ZoomDDMItem
                  $glow={glow}
                  onClick={() => {
                    setZoom(100);
                    setZoomDDMOpen(false);
                  }}
                >
                  <ZoomDDMGlyph>⟳</ZoomDDMGlyph>
                  <span>Reset · 100%</span>
                </ZoomDDMItem>
                <ZoomDDMItem
                  $glow={glow}
                  disabled={zoom >= ZOOM_MAX}
                  $disabled={zoom >= ZOOM_MAX}
                  onClick={() => {
                    setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP));
                  }}
                >
                  <ZoomDDMGlyph>+</ZoomDDMGlyph>
                  <span>Zoom in</span>
                </ZoomDDMItem>
              </ZoomDDMPanel>
            )}
          </ZoomDDMWrap>

          <Separator $glow={glow} />

          <CtrlBtn
            $glow={glow}
            $active={sidebarShown}
            onClick={() => setSidebarShown((v) => !v)}
            aria-label={sidebarShown ? "Hide side drawers" : "Show side drawers"}
            title={sidebarShown ? "Hide side drawers" : "Show side drawers"}
          >
            <SidebarSvg open={sidebarShown} />
          </CtrlBtn>

          <CtrlBtn
            $glow={glow}
            onClick={openPopout}
            disabled={popoutActive}
            aria-label="Open in new window"
            title={popoutActive ? "Already open in pop-out" : "Open in new window"}
          >
            ⧉
          </CtrlBtn>

          <CtrlBtn
            $glow={glow}
            $active={fullscreen}
            onClick={() => setFullscreen((p) => !p)}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? "⊡" : "⊞"}
          </CtrlBtn>

          <NeonX accent={glow} onClick={onClose} title="Close (Esc)" />
        </Header>

        <Body>
          {popoutActive ? (
            <Blackout $glow={glow}>
              <BlackoutMsg>Currently working in pop-out window</BlackoutMsg>
              <BlackoutSub>
                Your work is live in the other window. Close the pop-out to continue here.
              </BlackoutSub>
              <BlackoutBtn $glow={glow} type="button" onClick={closePopout}>
                Close pop-out
              </BlackoutBtn>
            </Blackout>
          ) : (
            <FrameShell $zoom={zoom}>
              <Frame key={iframeKey} src={iframeSrc} title={title} />
            </FrameShell>
          )}
        </Body>
      </Panel>
    </>
  );
}
