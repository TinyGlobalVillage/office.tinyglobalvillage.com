"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 99999;
  display: grid;
  place-items: center;
  padding: 4vh 4vw;
`;

const Frame = styled.div`
  position: relative;
  width: min(92vw, 1100px);
  height: min(88vh, 800px);
  background: rgba(6, 8, 12, 1);
  border: 1px solid rgba(255, 78, 203, 0.32);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.9), 0 0 32px rgba(255, 78, 203, 0.12);
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(0, 0, 0, 0.4);
  flex: 0 0 auto;
`;

const HeaderTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.85);
`;

const BackBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.85);
  padding: 4px 10px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  &:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.35);
  }
`;

const Stage = styled.div`
  flex: 1 1 auto;
  position: relative;
  overflow: hidden;
  /* Container query lets r3f children using cqi units (e.g. PortalShell) size against the modal viewport, not the page. */
  container-type: inline-size;
`;

export type R3FPreviewModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export default function R3FPreviewModal({ title, onClose, children }: R3FPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // SandboxModal listens on document with capture and was registered
        // first, so it would win a same-target race. Capture on window fires
        // BEFORE any document-level capture handler (window → document in
        // the capture chain), so we intercept here and stop the event from
        // ever reaching the sandbox.
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);

  if (!mounted) return null;

  const node = (
    <Backdrop onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Frame>
        <Header>
          <HeaderTitle>{title}</HeaderTitle>
          <BackBtn onClick={onClose} aria-label="Back to Sandbox">← Back to Sandbox</BackBtn>
        </Header>
        <Stage>{children}</Stage>
      </Frame>
    </Backdrop>
  );

  return createPortal(node, document.body);
}
