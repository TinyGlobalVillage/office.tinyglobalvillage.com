import styled, { css, keyframes } from "styled-components";
import { colors, rgb, type GlowColor } from "./theme";

/* ── Modal primitives ──────────────────────────────────────────── */

export const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--t-overlay);
  backdrop-filter: blur(6px);
`;

export const ModalContainer = styled.div<{ $accent?: GlowColor; $maxWidth?: string }>`
  position: relative;
  width: 100%;
  max-width: ${(p) => p.$maxWidth || "48rem"};
  max-height: 85vh;
  border-radius: 1rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--t-cardGrad);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "pink"]}, 0.25);
  box-shadow: 0 24px 80px rgba(0,0,0,0.7),
    0 0 40px rgba(${(p) => rgb[p.$accent || "pink"]}, 0.12);
`;

export const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--t-border);
  flex-shrink: 0;
`;

export const ModalHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

export const ModalTitle = styled.h2<{ $color?: string }>`
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
  color: ${(p) => p.$color || colors.pink};
  text-shadow: 0 0 12px ${(p) => (p.$color || colors.pink)}88;

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

export const ModalSubtitle = styled.p`
  font-size: 0.75rem;
  margin: 0;
  color: var(--t-textFaint);
`;

export const ModalBody = styled.div<{ $padding?: string }>`
  flex: 1;
  overflow-y: auto;
  padding: ${(p) => p.$padding || "1.5rem"};
`;

/* ── Close button ──────────────────────────────────────────────── */

export const CloseBtn = styled.button`
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--t-textFaint);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  font-size: 0.875rem;

  &:hover {
    color: var(--t-text);
    background: var(--t-inputBg);
  }
`;

/* ── Section divider ───────────────────────────────────────────── */

export const Divider = styled.div`
  border-bottom: 1px solid var(--t-border);
`;

/* ── Buttons ───────────────────────────────────────────────────── */

export const GlowButton = styled.button<{ $color?: GlowColor }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.5rem;
  border-radius: 0.75rem;
  border: none;
  font-size: 0.875rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
  color: #fff;
  background: linear-gradient(
    135deg,
    ${(p) => colors[p.$color || "pink"]},
    #a855f7
  );
  box-shadow: 0 4px 20px rgba(${(p) => rgb[p.$color || "pink"]}, 0.3);

  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

export const SubtleButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.625rem 1.5rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  color: var(--t-textMuted);
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);

  &:hover { background: var(--t-border); }
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

export const PillButton = styled.button<{ $color?: GlowColor; $active?: boolean }>`
  padding: 0.25rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: background 0.15s;
  color: ${(p) => colors[p.$color || "pink"]};
  background: ${(p) => p.$active
    ? `rgba(${rgb[p.$color || "pink"]}, 0.18)`
    : "var(--t-inputBg)"};
  border: 1px solid ${(p) => p.$active
    ? `rgba(${rgb[p.$color || "pink"]}, 0.45)`
    : "var(--t-borderStrong)"};

  &:hover {
    background: rgba(${(p) => rgb[p.$color || "pink"]}, 0.12);
  }
`;

/* ── Input ─────────────────────────────────────────────────────── */

export const Input = styled.input<{ $accent?: GlowColor }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  outline: none;
  color: var(--t-text);
  background: var(--t-inputBg);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "pink"]}, 0.2);
  transition: border-color 0.15s;

  &::placeholder { color: var(--t-textGhost); }
  &:focus { border-color: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.5); }
`;

export const TextArea = styled.textarea<{ $accent?: GlowColor }>`
  width: 100%;
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  outline: none;
  resize: none;
  color: var(--t-text);
  background: var(--t-inputBg);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "pink"]}, 0.2);
  transition: border-color 0.15s;

  &::placeholder { color: var(--t-textGhost); }
  &:focus { border-color: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.5); }
`;

/* ── Card ──────────────────────────────────────────────────────── */

export const GlassCard = styled.div<{ $accent?: GlowColor }>`
  border-radius: 0.75rem;
  padding: 1rem;
  background: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.04);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "pink"]}, 0.15);
  transition: background 0.15s;

  [data-theme="light"] & {
    background: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.03);
    border-color: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.1);
  }
`;

/* ── Typography ────────────────────────────────────────────────── */

export const Label = styled.span<{ $color?: string }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => p.$color || "var(--t-textFaint)"};
`;

export const AccentLabel = styled(Label)<{ $accent?: GlowColor }>`
  color: ${(p) => colors[p.$accent || "pink"]};
`;

export const Mono = styled.span`
  font-family: var(--font-geist-mono), monospace;
`;

/* ── Status dot ────────────────────────────────────────────────── */

export const StatusDot = styled.span<{ $online?: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${(p) => p.$online ? colors.green : "#374151"};
  box-shadow: ${(p) => p.$online ? `0 0 4px ${colors.green}` : "none"};
`;

/* ── Spinner ───────────────────────────────────────────────────── */

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
`;

export const PulseText = styled.span<{ $color?: string }>`
  font-size: 0.75rem;
  color: ${(p) => p.$color || colors.cyan};
  animation: ${pulse} 1.5s ease-in-out infinite;
`;
