"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb, glowRgba, type GlowColor } from "../theme";
import { CloseBtn } from "../styled";

type Props = {
  pageKey: string;
  title: string;
  glow: GlowColor;
  onClose: () => void;
};

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 80;
  background: var(--t-overlay);
  backdrop-filter: blur(4px);
`;

const Panel = styled.div<{ $glow: GlowColor }>`
  position: fixed;
  inset: 0;
  z-index: 81;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--t-surface);
  border-top: 1px solid ${(p) => glowRgba(p.$glow, 0.25)};
  box-shadow: 0 0 40px ${(p) => glowRgba(p.$glow, 0.12)} inset;
`;

const Header = styled.div<{ $glow: GlowColor }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid ${(p) => glowRgba(p.$glow, 0.2)};
  flex-shrink: 0;
  background: ${(p) => glowRgba(p.$glow, 0.06)};
`;

const Title = styled.h2<{ $glow: GlowColor }>`
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin: 0 0.25rem;
  color: ${(p) => colors[p.$glow]};
`;

const Spacer = styled.div`flex: 1;`;

const IconBtn = styled.button<{ $glow: GlowColor; $active?: boolean }>`
  width: 1.875rem;
  height: 1.875rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb[p.$glow]}, 0.22)` : `rgba(${rgb[p.$glow]}, 0.08)`)};
  border: 1px solid ${(p) => glowRgba(p.$glow, p.$active ? 0.55 : 0.3)};
  color: ${(p) => colors[p.$glow]};
  transition: all 0.15s;

  &:hover {
    background: rgba(${(p) => rgb[p.$glow]}, 0.18);
    box-shadow: 0 0 10px ${(p) => glowRgba(p.$glow, 0.35)};
  }
`;

const Frame = styled.iframe`
  flex: 1;
  width: 100%;
  border: none;
  background: var(--t-bg);
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
  const iframeSrc = useRef(`/dashboard/${pageKey}?embedded=1`).current;

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

  return (
    <>
      <Backdrop onClick={onClose} />
      <Panel $glow={glow} role="dialog" aria-modal="true" aria-label={title}>
        <Header $glow={glow}>
          <Title $glow={glow}>{title}</Title>
          <Spacer />
          <IconBtn
            $glow={glow}
            $active={sidebarShown}
            onClick={() => setSidebarShown((v) => !v)}
            aria-label={sidebarShown ? "Hide side drawers" : "Show side drawers"}
            title={sidebarShown ? "Hide side drawers" : "Show side drawers"}
          >
            <SidebarSvg open={sidebarShown} />
          </IconBtn>
          <CloseBtn onClick={onClose} aria-label="Close">×</CloseBtn>
        </Header>
        <Frame src={iframeSrc} title={title} />
      </Panel>
    </>
  );
}
