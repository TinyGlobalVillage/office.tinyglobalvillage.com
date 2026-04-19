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


/* ── Panel primitives (fullscreen-capable modals) ─────────────── */

export const PanelBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 65;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(4px);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.35);
  }
`;

export const Panel = styled.div<{ $fs?: boolean; $accent?: GlowColor }>`
  position: fixed;
  z-index: 66;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--t-surface);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "orange"]}, 0.32);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85),
    0 0 32px rgba(${(p) => rgb[p.$accent || "orange"]}, 0.12);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  top: ${(p) => (p.$fs ? "0" : "60px")};
  left: ${(p) => (p.$fs ? "0" : "4%")};
  right: ${(p) => (p.$fs ? "0" : "4%")};
  bottom: ${(p) => (p.$fs ? "0" : "4%")};
  border-radius: ${(p) => (p.$fs ? "0" : "20px")};

  [data-theme="light"] & {
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.12),
      0 0 32px rgba(${(p) => rgb[p.$accent || "orange"]}, 0.06);
  }
`;

export const PanelHeader = styled.div<{ $accent?: GlowColor }>`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(${(p) => rgb[p.$accent || "orange"]}, 0.18);

  [data-theme="light"] & {
    border-bottom-color: rgba(${(p) => rgb[p.$accent || "orange"]}, 0.12);
  }
`;

export const PanelIconBtn = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 0.375rem;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--t-textFaint);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: var(--t-inputBg);
    color: var(--t-textMuted);
  }
`;

export const PanelActionBtn = styled.button<{ $color?: GlowColor; $variant?: "filled" | "ghost" }>`
  padding: 0.25rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  color: ${(p) =>
    p.$variant === "ghost" ? "var(--t-textMuted)" : colors[p.$color || "orange"]};
  background: ${(p) =>
    p.$variant === "ghost"
      ? "var(--t-inputBg)"
      : `rgba(${rgb[p.$color || "orange"]}, 0.14)`};
  border: 1px solid
    ${(p) =>
      p.$variant === "ghost"
        ? "var(--t-borderStrong)"
        : `rgba(${rgb[p.$color || "orange"]}, 0.4)`};

  &:hover {
    background: ${(p) =>
      p.$variant === "ghost"
        ? "var(--t-border)"
        : `rgba(${rgb[p.$color || "orange"]}, 0.22)`};
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
`;

export const PanelError = styled.div`
  font-size: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.red}, 0.1);
  border: 1px solid rgba(${rgb.red}, 0.3);
  color: #fca5a5;

  [data-theme="light"] & {
    color: ${colors.red};
    background: rgba(${rgb.red}, 0.06);
  }
`;

export const PanelEmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: var(--t-textFaint);
  font-size: 0.875rem;
  padding-top: 3rem;
`;

export const PanelEditor = styled.textarea`
  width: 100%;
  background: transparent;
  outline: none;
  font-size: 0.75rem;
  color: var(--t-text);
  font-family: var(--font-geist-mono), monospace;
  resize: none;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--t-borderStrong);
  min-height: 400px;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

export const PanelMarkdown = styled.div`
  font-size: 0.875rem;
  color: var(--t-text);
  opacity: 0.85;
  line-height: 1.625;
  max-width: 48rem;
`;

export const PanelSidebar = styled.div`
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border-right: 1px solid var(--t-border);
  scrollbar-width: thin;
`;

export const PanelSidebarLabel = styled.div`
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--t-textFaint);
  padding: 0.25rem 0.5rem;
`;

export const PanelSidebarItem = styled.button<{ $active?: boolean; $accent?: GlowColor }>`
  text-align: left;
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  cursor: pointer;
  border: 1px solid
    ${(p) =>
      p.$active ? `rgba(${rgb[p.$accent || "orange"]}, 0.3)` : "transparent"};
  background: ${(p) =>
    p.$active ? `rgba(${rgb[p.$accent || "orange"]}, 0.14)` : "transparent"};
  color: ${(p) =>
    p.$active ? colors[p.$accent || "orange"] : "var(--t-textMuted)"};

  &:hover {
    background: ${(p) =>
      p.$active
        ? `rgba(${rgb[p.$accent || "orange"]}, 0.14)`
        : "var(--t-inputBg)"};
  }
`;

export const PanelTitle = styled.h2<{ $color?: string }>`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: ${(p) => p.$color || colors.orange};
`;

export const PanelTag = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
`;

export const PanelToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

export const Spacer = styled.div`
  flex: 1;
`;


/* ── Drawer primitives ──────────────────────────────────────────── */

export const DrawerBackdrop = styled.div<{ $z?: number }>`
  position: fixed;
  inset: 0;
  z-index: ${(p) => p.$z ?? 30};

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.06);
  }
`;

export const DrawerPanel = styled.div`
  position: fixed;
  top: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(7, 9, 13, 0.99);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 0 40px rgba(0, 0, 0, 0.08);
  }
`;

export const DrawerHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  flex-shrink: 0;
  min-height: 44px;
  border-bottom: 1px solid var(--t-border);
`;

export const DrawerTab = styled.button<{ $side?: "left" | "right"; $accent?: GlowColor }>`
  position: fixed;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  user-select: none;
  width: 28px;
  padding: 12px 0;
  transform: translateY(-50%);
  border: 1px solid rgba(${(p) => rgb[p.$accent || "pink"]}, 0.45);
  border-radius: ${(p) => (p.$side === "right" ? "10px 0 0 10px" : "0 10px 10px 0")};
  color: ${(p) => colors[p.$accent || "pink"]};
  backdrop-filter: blur(8px);
  transition: background 0.2s;
  cursor: grab;

  [data-theme="light"] & {
    border-color: rgba(${(p) => rgb[p.$accent || "pink"]}, 0.3);
  }

  body[data-dashboard-modal="open"][data-dashboard-sidebar="hidden"] & {
    display: none;
  }
`;

export const DrawerTabLabel = styled.span`
  writing-mode: vertical-rl;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
`;

export const DrawerResizeHandle = styled.div<{ $accent?: GlowColor }>`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 6px;
  cursor: ew-resize;
  z-index: 10;
  background: transparent;

  &::after {
    content: "";
    position: absolute;
    inset-block: 0;
    right: 0;
    width: 1px;
    background: rgba(${(p) => rgb[p.$accent || "cyan"]}, 0.15);
    transition: width 0.15s;
  }

  &:hover::after {
    width: 4px;
  }
`;

export const DrawerFooter = styled.div`
  flex-shrink: 0;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--t-border);
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--t-textGhost);
`;
