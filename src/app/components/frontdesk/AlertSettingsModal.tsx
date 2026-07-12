"use client";

/**
 * AlertSettingsModal — Front Desk gold modal wrapping the reusable
 * AlertSettingsPanel. Opened by the gear in the Scheduled-alerts section.
 * (The same panel is also embedded directly in the Profile.)
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { CloseBtn, ModalBackdrop } from "../../styled";
import AlertSettingsPanel from "./AlertSettingsPanel";

const Backdrop = styled(ModalBackdrop)`
  z-index: 12000;
  align-items: flex-start;
  padding-top: 6vh;
  padding-bottom: 6vh;
`;
const Shell = styled.div`
  position: relative;
  width: 100%;
  max-width: 34rem;
  max-height: 86vh;
  display: flex;
  flex-direction: column;
  border-radius: 1rem;
  overflow: hidden;
  background: var(--t-cardGrad);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.7), 0 0 40px rgba(${rgb.gold}, 0.14);
  @media (max-width: 768px) {
    max-width: 100vw; width: 100vw; height: 100vh; max-height: 100vh; border-radius: 0;
  }
`;
const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.18);
  flex-shrink: 0;
`;
const Title = styled.h2`
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  flex: 1;
  color: ${colors.gold};
  text-shadow: 0 0 12px rgba(${rgb.gold}, 0.5);
  [data-theme="light"] & { text-shadow: none; }
`;
const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 1.1rem 1.25rem 1.35rem;
`;

export default function AlertSettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <Backdrop onClick={onClose}>
      <Shell onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>Alert preferences</Title>
          <CloseBtn onClick={onClose} title="Close">✕</CloseBtn>
        </Header>
        <Body>
          <AlertSettingsPanel />
        </Body>
      </Shell>
    </Backdrop>,
    document.body
  );
}
