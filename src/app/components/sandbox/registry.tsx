"use client";

import { useState, useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;
const MUTED = "rgba(255,255,255,0.18)";
const MUTED_TEXT = "rgba(255,255,255,0.35)";

export type SandboxEntry = {
  key: string;
  name: string;
  category: "Buttons" | "Icons" | "Menus" | "Navigation" | "Toggles";
  summary: string;
  usage: string;
  code: string;
  style?: string;
  stylePath?: string;
  Demo: React.FC;
};

// ── Reusable highlighter ────────────────────────────────────────────────

const HighlightWrap = styled.div`
  position: relative;
  display: inline-flex;
  padding: 8px;
  border-radius: 12px;
  border: 1px dashed rgba(${PINK_RGB}, 0.55);
  box-shadow: 0 0 22px rgba(${PINK_RGB}, 0.28),
    inset 0 0 12px rgba(${PINK_RGB}, 0.08);
  background: rgba(${PINK_RGB}, 0.04);

  [data-theme="light"] & {
    border-color: rgba(${PINK_RGB}, 0.35);
    box-shadow: 0 0 12px rgba(${PINK_RGB}, 0.1);
    background: rgba(${PINK_RGB}, 0.02);
  }
`;

const HighlightLabel = styled.span`
  position: absolute;
  top: -9px;
  left: 10px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  padding: 1px 6px;
  background: rgba(6, 8, 12, 1);
  color: ${PINK};
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  border-radius: 4px;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${PINK_RGB}, 0.3);
  }
`;

function Highlight({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <HighlightWrap>
      {label && <HighlightLabel>{label}</HighlightLabel>}
      {children}
    </HighlightWrap>
  );
}

// ── Demo styled helpers ─────────────────────────────────────────────────

const DemoCol = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
`;

const DemoRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
`;

const MutedRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${MUTED};
`;

const MutedLabel = styled.span`
  font-size: 0.75rem;
  color: ${MUTED_TEXT};
`;

const MutedNote = styled.span`
  font-size: 0.625rem;
  color: ${MUTED_TEXT};
`;

// ── GPG styled ──────────────────────────────────────────────────────────

const GpgGrid = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, minmax(0, 1fr));
  gap: 8px;
  min-width: 240px;
  width: 100%;
`;

const GpgTile = styled.div`
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid ${MUTED};
`;

const GpgTileNum = styled.span`
  font-size: 10px;
  font-family: var(--font-geist-mono), monospace;
  color: ${MUTED_TEXT};
`;

const GpgPagerRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const GpgPagerBtn = styled.button<{ $disabled?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(${PINK_RGB}, 0.12);
  color: ${PINK};
  font-size: 14px;
  font-weight: 700;
  cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.4 : 1)};
`;

const GpgPagerInfo = styled.span`
  color: ${PINK};
  font-size: 12px;
  font-weight: 700;
`;

// ── TPG styled ──────────────────────────────────────────────────────────

const TpgTable = styled.div`
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid ${MUTED};
`;

const TpgTableRow = styled.div<{ $alt?: boolean; $last?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 1rem;
  border-bottom: ${(p) => (p.$last ? "none" : `1px solid ${MUTED}`)};
  background: ${(p) => (p.$alt ? "rgba(255,255,255,0.02)" : "transparent")};
`;

const TpgMono = styled.span`
  font-size: 11px;
  font-family: var(--font-geist-mono), monospace;
  color: ${MUTED_TEXT};
`;

const Spacer = styled.span`
  flex: 1;
`;

const TpgDash = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.2);
`;

const TpgControlRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
`;

const TpgPageInfo = styled.span`
  color: ${PINK};
  font-size: 11px;
  font-weight: 600;
`;

const TpgSmallBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(${PINK_RGB}, 0.12);
  color: ${PINK};
  font-size: 11px;
`;

const TpgSelect = styled.select`
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(6, 8, 12, 0.9);
  color: ${PINK};
  font-size: 11px;
`;

const TpgNavBtn = styled.button<{ $disabled?: boolean }>`
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(${PINK_RGB}, 0.12);
  color: ${PINK};
  font-size: 12px;
  opacity: ${(p) => (p.$disabled ? 0.4 : 1)};
`;

// ── ACR styled ──────────────────────────────────────────────────────────

const AcrViewportLabel = styled.span`
  font-size: 10px;
  font-family: var(--font-geist-mono), monospace;
  color: ${PINK};
`;

const AcrGrid = styled.div<{ $cols: number }>`
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(${(p) => p.$cols}, 1fr);
  width: 320px;
`;

const AcrTile = styled.div`
  aspect-ratio: 1;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid ${MUTED};
`;

// ── Lightswitch styled ──────────────────────────────────────────────────

const LsTrack = styled.button<{ $on: boolean; $highlighted?: boolean }>`
  position: relative;
  width: 44px;
  height: 18px;
  border-radius: 999px;
  border: 1px solid
    ${(p) =>
      p.$on
        ? `rgba(${p.$highlighted ? PINK_RGB : "255,255,255"}, 0.7)`
        : "rgba(255,255,255,0.15)"};
  background: ${(p) =>
    p.$on
      ? `rgba(${p.$highlighted ? PINK_RGB : "255,255,255"}, 0.18)`
      : "rgba(255,255,255,0.04)"};
  box-shadow: ${(p) =>
    p.$on && p.$highlighted
      ? `0 0 12px rgba(${PINK_RGB}, 0.5)`
      : "none"};
  transition: all 0.2s;
`;

const LsThumb = styled.span<{ $on: boolean; $highlighted?: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "26px" : "2px")};
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${(p) =>
    p.$on
      ? p.$highlighted
        ? PINK
        : "rgba(255,255,255,0.4)"
      : "rgba(255,255,255,0.3)"};
  box-shadow: ${(p) =>
    p.$on && p.$highlighted
      ? `0 0 10px rgba(${PINK_RGB}, 0.8), 0 0 2px rgba(${PINK_RGB}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.2s;
`;

const LsWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 448px;
`;

const LsHighlightRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  width: 100%;
  min-width: 280px;
`;

const LsExpandLabel = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
`;

// ── ECL styled ──────────────────────────────────────────────────────────

const EclWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 448px;
`;

const EclRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${MUTED};
`;

const EclSectionLabel = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${MUTED_TEXT};
`;

const EclTrackBar = styled.div`
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
`;

const EclFill = styled.div<{ $pct: string }>`
  height: 100%;
  border-radius: 999px;
  width: ${(p) => p.$pct};
  background: rgba(0, 191, 255, 0.4);
`;

const EclResetBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 228, 253, 0.25);
  background: rgba(0, 228, 253, 0.08);
  color: rgba(0, 228, 253, 0.8);
  font-size: 11px;
`;

const EclInput = styled.input`
  width: 40px;
  text-align: center;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  padding: 2px 4px;
`;

const EclToggleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const EclToggleLabel = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${PINK};
`;

// ── EyeIcon styled ──────────────────────────────────────────────────────

const EyeWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 448px;
`;

const EyeBtnStyled = styled.button<{ $visible: boolean; $highlighted?: boolean }>`
  width: 22px;
  height: 22px;
  border-radius: 4px;
  border: 1px solid
    rgba(
      ${(p) => (p.$highlighted ? PINK_RGB : "0,228,253")},
      ${(p) => (p.$visible ? 0.5 : 0.2)}
    );
  background: rgba(
    ${(p) => (p.$highlighted ? PINK_RGB : "0,228,253")},
    ${(p) => (p.$visible ? 0.15 : 0.04)}
  );
  color: ${(p) =>
    p.$visible
      ? p.$highlighted
        ? PINK
        : "rgba(0,228,253,0.6)"
      : "rgba(255,255,255,0.3)"};
  box-shadow: ${(p) =>
    p.$visible && p.$highlighted
      ? `0 0 10px rgba(${PINK_RGB}, 0.5)`
      : "none"};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
`;

const EyeRowLabel = styled.span`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
`;

// ── QMBM styled ─────────────────────────────────────────────────────────

const QmbmBubbleStyled = styled.button<{ $highlighted?: boolean }>`
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid
    rgba(${(p) => (p.$highlighted ? PINK_RGB : "247,183,0")}, 0.6);
  background: rgba(
    ${(p) => (p.$highlighted ? PINK_RGB : "247,183,0")},
    0.15
  );
  color: ${(p) => (p.$highlighted ? PINK : "rgba(247,183,0,0.6)")};
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  box-shadow: ${(p) =>
    p.$highlighted
      ? `0 0 8px rgba(${PINK_RGB}, 0.5)`
      : "none"};
`;

const QmbmWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 448px;
  min-height: 200px;
`;

const QmbmFieldRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const QmbmFieldLabel = styled.label`
  font-size: 12px;
  color: ${MUTED_TEXT};
`;

const QmbmFieldLabelActive = styled.label`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
`;

const QmbmInput = styled.input`
  width: 100%;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid ${MUTED};
  color: ${MUTED_TEXT};
`;

const QmbmRelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
`;

const QmbmCard = styled.div`
  position: absolute;
  top: 26px;
  left: 0;
  z-index: 10;
  width: 260px;
  padding: 12px;
  border-radius: 10px;
  background: rgba(6, 8, 12, 0.98);
  border: 1px solid rgba(${PINK_RGB}, 0.45);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 16px rgba(${PINK_RGB}, 0.2);
`;

const QmbmCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const QmbmCardTitle = styled.span`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${PINK};
`;

const QmbmCloseBtn = styled.button`
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
  background: none;
  border: none;
  cursor: pointer;
`;

const QmbmCardBody = styled.p`
  font-size: 11px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
`;

// ── DDM styled ──────────────────────────────────────────────────────────

const DdmWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 448px;
  min-height: 200px;
`;

const DdmFieldLabel = styled.label`
  font-size: 12px;
  color: ${MUTED_TEXT};
`;

const DdmMutedBtn = styled.button`
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid ${MUTED};
  color: ${MUTED_TEXT};
`;

const DdmRelWrap = styled.div`
  position: relative;
`;

const DdmTriggerBtn = styled.button`
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(${PINK_RGB}, 0.14);
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  color: ${PINK};
`;

const DdmArrow = styled.span`
  font-size: 8px;
`;

const DdmMenu = styled.div`
  position: absolute;
  top: 52px;
  left: 8px;
  z-index: 10;
  width: 180px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(6, 8, 12, 0.98);
  border: 1px solid rgba(${PINK_RGB}, 0.45);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 16px rgba(${PINK_RGB}, 0.2);
`;

const DdmMenuItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  color: ${(p) => (p.$active ? PINK : "rgba(255,255,255,0.7)")};
  background: ${(p) =>
    p.$active ? `rgba(${PINK_RGB}, 0.1)` : "transparent"};
  border: none;
  cursor: pointer;
`;

// ── SRT styled ──────────────────────────────────────────────────────────

const SrtWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 448px;
`;

const SrtRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 0.75rem;
  width: 100%;
  min-width: 360px;
`;

const SrtLabel = styled.span<{ $active?: boolean }>`
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  width: 56px;
  color: ${(p) => (p.$active ? PINK : MUTED_TEXT)};
`;

const SrtSlider = styled.input`
  flex: 1;
  accent-color: ${PINK};
`;

const SrtResetBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(${PINK_RGB}, 0.15);
  color: ${PINK};
  font-size: 11px;
`;

const SrtValueInput = styled.input`
  width: 48px;
  text-align: center;
  border-radius: 4px;
  font-size: 12px;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  color: ${PINK};
  font-variant-numeric: tabular-nums;
`;

const SrtMutedRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${MUTED};
`;

const SrtMutedTrack = styled.div`
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
`;

const SrtMutedFill = styled.div<{ $pct: string }>`
  height: 100%;
  border-radius: 999px;
  width: ${(p) => p.$pct};
  background: rgba(255, 255, 255, 0.15);
`;

const SrtMutedVal = styled.span`
  font-size: 10px;
  color: ${MUTED_TEXT};
`;

// ── Reset Button styled ─────────────────────────────────────────────────

const RstWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 448px;
`;

const RstRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid ${MUTED};
`;

const RstLabel = styled.span<{ $active?: boolean }>`
  font-size: 11px;
  width: 56px;
  color: ${(p) => (p.$active ? "rgba(255,255,255,0.85)" : MUTED_TEXT)};
`;

const RstMutedResetBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(0, 228, 253, 0.2);
  background: rgba(0, 228, 253, 0.05);
  color: rgba(0, 228, 253, 0.4);
  font-size: 10px;
`;

const RstHighlightBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  background: rgba(${PINK_RGB}, 0.15);
  color: ${PINK};
  font-size: 12px;
  font-weight: 700;
`;

const RstActiveFill = styled.div<{ $pct: string }>`
  height: 100%;
  border-radius: 999px;
  width: ${(p) => p.$pct};
  background: rgba(0, 191, 255, 0.4);
`;

const RstMonoVal = styled.span`
  font-size: 10px;
  font-family: var(--font-geist-mono), monospace;
  color: rgba(255, 255, 255, 0.5);
`;

// ── TSG styled ──────────────────────────────────────────────────────────

const TsgWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 512px;
`;

const TsgControlBar = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  width: 100%;
  min-width: 360px;
  background: rgba(${PINK_RGB}, 0.04);
`;

const TsgToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TsgToggleLabel = styled.span<{ $active?: boolean }>`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${(p) => (p.$active ? PINK : MUTED_TEXT)};
`;

const TsgPinkLabel = styled.span`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${PINK};
`;

// ── SBDM styled ─────────────────────────────────────────────────────────

const SbdmWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 448px;
  min-height: 360px;
`;

const SbdmFieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SbdmFieldLabel = styled.label<{ $active?: boolean }>`
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${(p) => (p.$active ? PINK : MUTED_TEXT)};
`;

const SbdmFieldInput = styled.input`
  width: 100%;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid ${MUTED};
  color: ${MUTED_TEXT};
`;

const SbdmRelGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
`;

const SbdmSearchWrap = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 320px;
  position: relative;
`;

const SbdmSearchIcon = styled.span`
  position: absolute;
  left: 10px;
  color: rgba(${PINK_RGB}, 0.7);
  font-size: 12px;
  pointer-events: none;
`;

const SbdmSearchInput = styled.input`
  flex: 1;
  padding: 6px 40px 6px 32px;
  border-radius: 8px;
  outline: none;
  font-size: 12px;
  background: rgba(${PINK_RGB}, 0.06);
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  color: ${PINK};
`;

const SbdmDropdownBtn = styled.button<{ $open?: boolean }>`
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: ${(p) =>
    p.$open
      ? `rgba(${PINK_RGB}, 0.25)`
      : `rgba(${PINK_RGB}, 0.12)`};
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  color: ${PINK};
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SbdmPanel = styled.div`
  position: absolute;
  top: 80px;
  left: 0;
  right: 0;
  z-index: 20;
  max-height: 240px;
  padding: 6px;
  background: rgba(6, 8, 12, 0.99);
  border: 1px solid rgba(${PINK_RGB}, 0.45);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7),
    0 0 18px rgba(${PINK_RGB}, 0.2);
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const SbdmPanelHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px;
`;

const SbdmInnerInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  outline: none;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  color: rgba(255, 255, 255, 0.85);
`;

const SbdmSortBtn = styled.button`
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: rgba(${PINK_RGB}, 0.14);
  border: 1px solid rgba(${PINK_RGB}, 0.5);
  color: ${PINK};
  white-space: nowrap;
`;

const SbdmScrollList = styled.div`
  overflow-y: auto;
  max-height: 180px;
  scrollbar-width: thin;
`;

const SbdmEmptyMsg = styled.div`
  padding: 16px 12px;
  text-align: center;
  font-size: 10px;
  color: ${MUTED_TEXT};
`;

const SbdmOptionBtn = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 11px;
  color: ${(p) => (p.$active ? PINK : "rgba(255,255,255,0.7)")};
  background: ${(p) =>
    p.$active ? `rgba(${PINK_RGB}, 0.1)` : "transparent"};
  border: none;
  cursor: pointer;
`;

const SbdmFooter = styled.div`
  padding: 4px 8px;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${MUTED_TEXT};
  border-top: 1px solid rgba(${PINK_RGB}, 0.15);
`;

// ── LDM styled ──────────────────────────────────────────────────────────

const LdmWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
`;

const LdmPreview = styled.div<{ $dark: boolean }>`
  padding: 24px;
  border-radius: 16px;
  background: ${(p) =>
    p.$dark ? "rgba(10,10,10,0.95)" : "rgba(248,246,243,0.95)"};
  border: ${(p) =>
    p.$dark
      ? "1px solid rgba(255,255,255,0.08)"
      : "1px solid rgba(0,0,0,0.08)"};
  transition: all 0.3s;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const LdmModeLabel = styled.span<{ $dark: boolean }>`
  font-size: 10px;
  color: ${(p) => (p.$dark ? MUTED_TEXT : "rgba(0,0,0,0.4)")};
  text-transform: uppercase;
  letter-spacing: 0.15em;
  font-weight: 700;
`;

const LdmToggleBtn = styled.button<{ $dark: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: ${(p) =>
    p.$dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)"};
  border: ${(p) =>
    p.$dark
      ? "1px solid rgba(255,255,255,0.12)"
      : "1px solid rgba(0,0,0,0.12)"};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 16px;
`;

const LdmAlertBox = styled.div`
  padding: 16px;
  border-radius: 12px;
  background: rgba(${PINK_RGB}, 0.04);
  border: 1px solid rgba(${PINK_RGB}, 0.2);
  text-align: center;
  max-width: 220px;
`;

const LdmAlertTitle = styled.div`
  font-size: 10px;
  color: ${PINK};
  font-weight: 700;
  margin-bottom: 8px;
`;

const LdmAlertActions = styled.div`
  display: flex;
  gap: 8px;
  justify-content: center;
`;

const LdmStayBtn = styled.button`
  font-size: 9px;
  padding: 4px 10px;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff4ecb, #a855f7);
  color: #fff;
  font-weight: 700;
  border: none;
  cursor: pointer;
`;

const LdmSwitchBtn = styled.button`
  font-size: 9px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
`;

// ── SuggestionBox styled ────────────────────────────────────────────────

const SbWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const SbDashedBox = styled.div<{ $open: boolean }>`
  width: 140px;
  height: 100px;
  border-radius: 16px;
  border: 2px dashed ${(p) => (p.$open ? PINK : MUTED)};
  background: transparent;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: border-color 0.2s;
`;

const SbCta = styled.button`
  padding: 6px 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #ff4ecb, #a855f7);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(${PINK_RGB}, 0.3);
`;

const SbModalPreview = styled.div`
  width: 220px;
  padding: 16px;
  border-radius: 12px;
  background: rgba(${PINK_RGB}, 0.04);
  border: 1px solid rgba(${PINK_RGB}, 0.2);
`;

const SbModalTitle = styled.div`
  font-size: 10px;
  color: ${PINK};
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
`;

const SbLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SbLine = styled.div<{ $color: string; $width: string }>`
  height: 6px;
  border-radius: 3px;
  background: ${(p) => p.$color};
  width: ${(p) => p.$width};
`;

const SbFooter = styled.div`
  margin-top: 10px;
  display: flex;
  justify-content: center;
`;

const SbSendBadge = styled.span`
  font-size: 9px;
  padding: 3px 10px;
  border-radius: 6px;
  background: linear-gradient(135deg, #ff4ecb, #a855f7);
  color: #fff;
  font-weight: 700;
`;

// ── GPG demo ────────────────────────────────────────────────────────────
function useGPGColumns() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return cols;
}

function GPGDemo() {
  const total = 12;
  const cols = useGPGColumns();
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [cols]);

  const pageSize = cols;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * pageSize;
  const items = Array.from({ length: pageSize }, (_, i) => start + i).filter((n) => n < total);
  const showPager = total > pageSize;

  return (
    <DemoCol>
      <Highlight label={`GPG · ${cols}-col`}>
        <GpgGrid $cols={cols}>
          {items.map((i) => (
            <GpgTile key={i}>
              <GpgTileNum>{i + 1}</GpgTileNum>
            </GpgTile>
          ))}
        </GpgGrid>
      </Highlight>

      {showPager ? (
        <GpgPagerRow>
          <GpgPagerBtn
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            $disabled={safePage === 0}
          >‹</GpgPagerBtn>
          <GpgPagerInfo>{safePage + 1} / {totalPages}</GpgPagerInfo>
          <GpgPagerBtn
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage === totalPages - 1}
            $disabled={safePage === totalPages - 1}
          >›</GpgPagerBtn>
        </GpgPagerRow>
      ) : (
        <MutedNote>(no pager — total ≤ pageSize)</MutedNote>
      )}
    </DemoCol>
  );
}

// ── TPG demo ────────────────────────────────────────────────────────────
function TPGDemo() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const total = 3;
  return (
    <DemoCol>
      <TpgTable>
        {["Row A", "Row B", "Row C", "Row D"].map((r, i) => (
          <TpgTableRow key={i} $alt={!!(i % 2)} $last={i === 3}>
            <TpgMono>{r}</TpgMono>
            <Spacer />
            <TpgDash>—</TpgDash>
          </TpgTableRow>
        ))}
      </TpgTable>

      <Highlight label="TPG">
        <TpgControlRow>
          <TpgPageInfo>Page {page} of {total} · 24 results</TpgPageInfo>
          <Spacer />
          <TpgSmallBtn onClick={() => setSize(10)} title="Reset">↺</TpgSmallBtn>
          <TpgSelect value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </TpgSelect>
          <TpgNavBtn
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            $disabled={page === 1}
          >‹</TpgNavBtn>
          <TpgNavBtn
            onClick={() => setPage((p) => Math.min(total, p + 1))}
            disabled={page === total}
            $disabled={page === total}
          >›</TpgNavBtn>
        </TpgControlRow>
      </Highlight>
    </DemoCol>
  );
}

// ── ACR demo ────────────────────────────────────────────────────────────
function ACRDemo() {
  const [cols, setCols] = useState(3);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 600) setCols(1);
      else if (w < 900) setCols(2);
      else if (w < 1200) setCols(3);
      else setCols(5);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <Highlight label="ACR">
      <DemoCol>
        <AcrViewportLabel>
          viewport → <b>{cols === 1 ? "GPG (mobile)" : `TPG ${cols}-col`}</b>
        </AcrViewportLabel>
        <AcrGrid $cols={cols}>
          {Array.from({ length: cols }).map((_, i) => (
            <AcrTile key={i} />
          ))}
        </AcrGrid>
        <MutedNote>Resize the window — cols switch at 600/900/1200.</MutedNote>
      </DemoCol>
    </Highlight>
  );
}

// ── Lightswitch demo ────────────────────────────────────────────────────
function LightswitchSwitch({ on, onChange, highlighted }: { on: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  return (
    <LsTrack onClick={() => onChange(!on)} $on={on} $highlighted={highlighted}>
      <LsThumb $on={on} $highlighted={highlighted} />
    </LsTrack>
  );
}

function LightswitchDemo() {
  const [a, setA] = useState(false);
  const [b, setB] = useState(true);
  const [c, setC] = useState(true);
  return (
    <LsWrap>
      {[
        { label: "Notifications", state: a, set: setA },
        { label: "Sound effects",  state: b, set: setB },
      ].map((r, i) => (
        <MutedRow key={i}>
          <MutedLabel>{r.label}</MutedLabel>
          <LightswitchSwitch on={r.state} onChange={r.set} highlighted={false} />
        </MutedRow>
      ))}
      <Highlight label="Lightswitch">
        <LsHighlightRow>
          <LsExpandLabel>Expand section</LsExpandLabel>
          <LightswitchSwitch on={c} onChange={setC} highlighted />
        </LsHighlightRow>
      </Highlight>
    </LsWrap>
  );
}

// ── RRT demo ────────────────────────────────────────────────────────────
const RrtList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 100%;
  max-width: 360px;
`;

const RrtRow = styled.button<{ $active?: boolean }>`
  all: unset;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border-radius: 6px;
  background: ${(p) => (p.$active ? "rgba(255,255,255,0.06)" : "transparent")};
  border: 1px solid ${(p) => (p.$active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)")};
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.78);

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  [data-theme="light"] & {
    color: rgba(0, 0, 0, 0.72);
    border-color: rgba(0, 0, 0, 0.08);
    background: ${(p) => (p.$active ? "rgba(0,0,0,0.04)" : "transparent")};
  }
`;

const RrtLabel = styled.span`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
`;

const RrtTag = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  padding: 0.1rem 0.35rem;
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-family: var(--font-geist-sans, system-ui), sans-serif;
  color: ${PINK};
  background: rgba(${PINK_RGB}, 0.15);
  border: 1px solid rgba(${PINK_RGB}, 0.6);
  border-radius: 999px;
  text-shadow: 0 0 4px rgba(${PINK_RGB}, 0.85);
  box-shadow:
    0 0 6px rgba(${PINK_RGB}, 0.5),
    inset 0 0 4px rgba(${PINK_RGB}, 0.25);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.12);
    text-shadow: none;
    box-shadow: 0 0 4px rgba(${PINK_RGB}, 0.4);
  }
`;

const RrtHint = styled.div`
  margin-top: 0.4rem;
  font-size: 0.65rem;
  color: rgba(255, 255, 255, 0.45);
  [data-theme="light"] & { color: rgba(0, 0, 0, 0.5); }
`;

function RRTDemo() {
  const items = [
    { key: "r1", label: "Saved chart", isNew: false },
    { key: "r2", label: "Transit report", isNew: true },
    { key: "r3", label: "Profile export", isNew: true },
    { key: "r4", label: "Archived session", isNew: false },
  ];
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const markSeen = (key: string) =>
    setSeen((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  const newCount = items.filter((i) => i.isNew && !seen.has(i.key)).length;
  return (
    <DemoCol>
      <Highlight label="RRT">
        <RrtList>
          {items.map((it) => {
            const showTag = it.isNew && !seen.has(it.key);
            return (
              <RrtRow
                key={it.key}
                onClick={() => {
                  if (showTag) markSeen(it.key);
                }}
              >
                <RrtLabel>{it.label}</RrtLabel>
                {showTag && <RrtTag aria-label="New entry">NEW</RrtTag>}
              </RrtRow>
            );
          })}
        </RrtList>
      </Highlight>
      <RrtHint>
        {newCount > 0
          ? `Click a row with a NEW tag to dismiss it (${newCount} left).`
          : "All receipts consumed — refresh the page to reset this demo."}
      </RrtHint>
    </DemoCol>
  );
}

// ── ECL demo ────────────────────────────────────────────────────────────
function ECLDemo() {
  const [expanded, setExpanded] = useState(true);
  return (
    <EclWrap>
      <EclRow>
        <EclSectionLabel>Zoom</EclSectionLabel>
        <EclTrackBar>
          <EclFill $pct={expanded ? "55%" : "0%"} />
        </EclTrackBar>
        {expanded && (
          <>
            <EclResetBtn>↺</EclResetBtn>
            <EclInput defaultValue="1.0" />
          </>
        )}
        <Highlight label="ECL">
          <EclToggleRow>
            <EclToggleLabel>{expanded ? "Collapse" : "Expand"}</EclToggleLabel>
            <LightswitchSwitch on={expanded} onChange={setExpanded} highlighted />
          </EclToggleRow>
        </Highlight>
      </EclRow>
      <MutedNote>Toggling ECL hides only the controls (↺ + input), not the row or label.</MutedNote>
    </EclWrap>
  );
}

// ── Eyeball demo ────────────────────────────────────────────────────────
// SVG matches the TGV editor accordion toggle on the editor taskbar. See
// vocab/Eyeball.md. NEVER fall back to emoji.
function EyeballOpenSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M1 12 C4 6 8 4 12 4 C16 4 20 6 23 12 C20 18 16 20 12 20 C8 20 4 18 1 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeballClosedSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 3 L21 21" />
      <path d="M10.7 5.1 C11.1 5.0 11.6 5 12 5 C16 5 20 7 23 12 C22.2 13.3 21.3 14.4 20.3 15.4" />
      <path d="M6.6 6.6 C3.9 8.0 2.1 10.0 1 12 C4 17 8 19 12 19 C13.5 19 15 18.7 16.4 18.1" />
      <path d="M9.9 9.9 A3 3 0 0 0 14.1 14.1" />
    </svg>
  );
}

function EyeBtn({ visible, onChange, highlighted }: { visible: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  return (
    <EyeBtnStyled onClick={() => onChange(!visible)} $visible={visible} $highlighted={highlighted}>
      {visible ? <EyeballOpenSvg /> : <EyeballClosedSvg />}
    </EyeBtnStyled>
  );
}

function EyeIconDemo() {
  const [show1, setShow1] = useState(true);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(true);
  return (
    <EyeWrap>
      {[
        { label: "Header block", state: show1, set: setShow1 },
        { label: "Sidebar widget", state: show2, set: setShow2 },
      ].map((r, i) => (
        <MutedRow key={i}>
          <MutedLabel>{r.label}</MutedLabel>
          <EyeBtn visible={r.state} onChange={r.set} />
        </MutedRow>
      ))}
      <MutedRow>
        <EyeRowLabel>Footer section</EyeRowLabel>
        <Highlight label="EYE">
          <EyeBtn visible={show3} onChange={setShow3} highlighted />
        </Highlight>
      </MutedRow>
    </EyeWrap>
  );
}

// ── QMBM demo ───────────────────────────────────────────────────────────
function QMBMBubble({ highlighted, onClick }: { highlighted?: boolean; onClick: () => void }) {
  return (
    <QmbmBubbleStyled onClick={onClick} $highlighted={highlighted}>?</QmbmBubbleStyled>
  );
}

function QMBMDemo() {
  const [open, setOpen] = useState(false);
  return (
    <QmbmWrap>
      <QmbmFieldRow>
        <QmbmFieldLabel>API Key</QmbmFieldLabel>
        <QMBMBubble onClick={() => {}} />
      </QmbmFieldRow>
      <QmbmInput placeholder="sk-…" readOnly />
      <QmbmRelRow>
        <QmbmFieldLabelActive>Webhook secret</QmbmFieldLabelActive>
        <Highlight label="QMBM">
          <QMBMBubble highlighted onClick={() => setOpen((v) => !v)} />
        </Highlight>
        {open && (
          <QmbmCard>
            <QmbmCardHeader>
              <QmbmCardTitle>Webhook secret</QmbmCardTitle>
              <QmbmCloseBtn onClick={() => setOpen(false)}>✕</QmbmCloseBtn>
            </QmbmCardHeader>
            <QmbmCardBody>
              Used to sign outbound webhook payloads. Rotate quarterly. Clients verify via HMAC-SHA256.
            </QmbmCardBody>
          </QmbmCard>
        )}
      </QmbmRelRow>
    </QmbmWrap>
  );
}

// ── DDM demo ────────────────────────────────────────────────────────────
function DDMDemo() {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("Markdown");
  return (
    <DdmWrap>
      <QmbmFieldRow>
        <DdmFieldLabel>Theme</DdmFieldLabel>
        <DdmMutedBtn>Dark ▾</DdmMutedBtn>
      </QmbmFieldRow>
      <DdmRelWrap>
        <Highlight label="DDM">
          <DdmTriggerBtn onClick={() => setOpen((v) => !v)}>
            Save as: {val}
            <DdmArrow>▼</DdmArrow>
          </DdmTriggerBtn>
        </Highlight>
        {open && (
          <DdmMenu>
            {["Markdown", "JSON", "HTML", "Plain text"].map((opt) => (
              <DdmMenuItem
                key={opt}
                onClick={() => { setVal(opt); setOpen(false); }}
                $active={val === opt}
              >{opt}</DdmMenuItem>
            ))}
          </DdmMenu>
        )}
      </DdmRelWrap>
    </DdmWrap>
  );
}

// ── SRT demo ────────────────────────────────────────────────────────────
function SRTDemo() {
  const [v, setV] = useState(1);
  return (
    <SrtWrap>
      <Highlight label="SRT">
        <SrtRow>
          <SrtLabel $active>Zoom</SrtLabel>
          <SrtSlider
            type="range" min={0.5} max={2} step={0.05} value={v}
            onChange={(e) => setV(Number(e.target.value))}
          />
          <SrtResetBtn onClick={() => setV(1)}>↺</SrtResetBtn>
          <SrtValueInput
            value={v.toFixed(2)}
            onChange={(e) => { const n = Number(e.target.value); if (!Number.isNaN(n)) setV(n); }}
          />
          <LightswitchSwitch on={true} onChange={() => {}} highlighted={false} />
        </SrtRow>
      </Highlight>
      {["X-Axis", "Y-Axis"].map((lbl) => (
        <SrtMutedRow key={lbl}>
          <SrtLabel>{lbl}</SrtLabel>
          <SrtMutedTrack>
            <SrtMutedFill $pct="50%" />
          </SrtMutedTrack>
          <SrtMutedVal>0.00</SrtMutedVal>
        </SrtMutedRow>
      ))}
    </SrtWrap>
  );
}

// ── Reset Button demo ───────────────────────────────────────────────────
function ResetBtnDemo() {
  const [v, setV] = useState(1.35);
  return (
    <RstWrap>
      {[
        { label: "X-Axis" },
        { label: "Y-Axis" },
      ].map((r) => (
        <RstRow key={r.label}>
          <RstLabel>{r.label}</RstLabel>
          <SrtMutedTrack>
            <SrtMutedFill $pct="50%" />
          </SrtMutedTrack>
          <RstMutedResetBtn>↺</RstMutedResetBtn>
        </RstRow>
      ))}
      <RstRow>
        <RstLabel $active>Zoom</RstLabel>
        <SrtMutedTrack>
          <RstActiveFill $pct={`${(v / 2) * 100}%`} />
        </SrtMutedTrack>
        <Highlight label="RESET">
          <RstHighlightBtn onClick={() => setV(1)}>↺</RstHighlightBtn>
        </Highlight>
        <RstMonoVal>{v.toFixed(2)}</RstMonoVal>
      </RstRow>
    </RstWrap>
  );
}

// ── TSG demo ────────────────────────────────────────────────────────────
function TSGDemo() {
  const [icons, setIcons] = useState(false);
  const [all, setAll] = useState(true);
  return (
    <TsgWrap>
      <Highlight label="TSG">
        <TsgControlBar>
          <TsgToggleGroup>
            <TsgPinkLabel>Labels</TsgPinkLabel>
            <LightswitchSwitch on={icons} onChange={setIcons} highlighted />
            <TsgToggleLabel $active={icons}>Icons</TsgToggleLabel>
          </TsgToggleGroup>
          <TsgToggleGroup>
            <TsgPinkLabel>{all ? "Collapse all" : "Expand all"}</TsgPinkLabel>
            <LightswitchSwitch on={all} onChange={setAll} highlighted />
          </TsgToggleGroup>
        </TsgControlBar>
      </Highlight>
      {["Sessions", "Members", "Payouts"].map((s) => (
        <MutedRow key={s}>
          <MutedLabel>{s}</MutedLabel>
          <LightswitchSwitch on={all} onChange={() => {}} highlighted={false} />
        </MutedRow>
      ))}
    </TsgWrap>
  );
}

// ── SBDM demo ───────────────────────────────────────────────────────────
const SBDM_OPTIONS = [
  "Argentina", "Australia", "Brazil", "Canada", "Chile", "Denmark",
  "Egypt", "France", "Germany", "Greece", "India", "Italy",
  "Japan", "Kenya", "Mexico", "Norway", "Poland", "Portugal",
  "Spain", "Sweden", "Thailand", "Turkey",
];

function SBDMDemo() {
  const [outer, setOuter] = useState("");
  const [open, setOpen] = useState(false);
  const [inner, setInner] = useState("");
  const [asc, setAsc] = useState(true);

  const filtered = SBDM_OPTIONS
    .filter((o) => o.toLowerCase().includes((open ? inner : outer).toLowerCase()))
    .sort((a, b) => (asc ? a.localeCompare(b) : b.localeCompare(a)));

  return (
    <SbdmWrap>
      <SbdmFieldGroup>
        <SbdmFieldLabel>Email</SbdmFieldLabel>
        <SbdmFieldInput placeholder="user@example.com" readOnly />
      </SbdmFieldGroup>
      <SbdmFieldGroup>
        <SbdmFieldLabel>Tag</SbdmFieldLabel>
        <SbdmFieldInput placeholder="optional" readOnly />
      </SbdmFieldGroup>

      <SbdmRelGroup>
        <SbdmFieldLabel $active>Country</SbdmFieldLabel>
        <Highlight label="SBDM">
          <SbdmSearchWrap>
            <SbdmSearchIcon>🔍</SbdmSearchIcon>
            <SbdmSearchInput
              value={outer}
              onChange={(e) => setOuter(e.target.value)}
              placeholder="Search countries…"
            />
            <SbdmDropdownBtn
              onClick={() => setOpen((v) => !v)}
              $open={open}
              title={open ? "Close" : "Browse all"}
            >▾</SbdmDropdownBtn>
          </SbdmSearchWrap>
        </Highlight>

        {open && (
          <SbdmPanel>
            <SbdmPanelHeader>
              <SbdmInnerInput
                value={inner}
                onChange={(e) => setInner(e.target.value)}
                placeholder="Search inside…"
                autoFocus
              />
              <SbdmSortBtn
                onClick={() => setAsc((v) => !v)}
                title="Toggle sort order"
              >
                {asc ? "Z-A" : "A-Z"} ↕
              </SbdmSortBtn>
            </SbdmPanelHeader>
            <SbdmScrollList>
              {filtered.length === 0 ? (
                <SbdmEmptyMsg>No matches.</SbdmEmptyMsg>
              ) : (
                filtered.map((o) => (
                  <SbdmOptionBtn
                    key={o}
                    onClick={() => { setOuter(o); setOpen(false); setInner(""); }}
                    $active={outer === o}
                  >{o}</SbdmOptionBtn>
                ))
              )}
            </SbdmScrollList>
            <SbdmFooter>
              {filtered.length} of {SBDM_OPTIONS.length} · sorted {asc ? "A → Z" : "Z → A"}
            </SbdmFooter>
          </SbdmPanel>
        )}
      </SbdmRelGroup>
    </SbdmWrap>
  );
}

// ── LDM demo ────────────────────────────────────────────────────
function LDMDemo() {
  const [dark, setDark] = useState(true);
  const [alert, setAlert] = useState(false);

  return (
    <LdmWrap>
      <LdmPreview $dark={dark}>
        <LdmModeLabel $dark={dark}>
          {dark ? "Dark Mode" : "Light Mode"}
        </LdmModeLabel>
        <Highlight label="LDM">
          <LdmToggleBtn
            onClick={() => { if (dark) setAlert(true); else setDark(true); }}
            $dark={dark}
          >
            {dark ? "🌙" : "☀️"}
          </LdmToggleBtn>
        </Highlight>
      </LdmPreview>
      {alert && (
        <LdmAlertBox>
          <LdmAlertTitle>Dark mode is greener</LdmAlertTitle>
          <LdmAlertActions>
            <LdmStayBtn onClick={() => setAlert(false)}>Stay dark</LdmStayBtn>
            <LdmSwitchBtn onClick={() => { setDark(false); setAlert(false); }}>Switch anyway</LdmSwitchBtn>
          </LdmAlertActions>
        </LdmAlertBox>
      )}
    </LdmWrap>
  );
}

// ── SuggestionBox demo ──────────────────────────────────────────────────
function SuggestionBoxDemo() {
  const [open, setOpen] = useState(false);
  return (
    <SbWrap>
      <SbDashedBox $open={open}>
        <Highlight label="tile">
          <SbCta onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Make a suggestion"}
          </SbCta>
        </Highlight>
      </SbDashedBox>
      {open && (
        <SbModalPreview>
          <SbModalTitle>SuggestionBox Modal</SbModalTitle>
          <SbLines>
            <SbLine $color={`rgba(${PINK_RGB},0.15)`} $width="80%" />
            <SbLine $color={`rgba(${rgb.cyan},0.15)`} $width="100%" />
            <SbLine $color={`rgba(${rgb.cyan},0.1)`} $width="60%" />
          </SbLines>
          <SbFooter>
            <SbSendBadge>Send to admin</SbSendBadge>
          </SbFooter>
        </SbModalPreview>
      )}
    </SbWrap>
  );
}

// ── Tooltip demo ────────────────────────────────────────────────────────
// Single-accent canonical. Every color below is derived from one `$accent`
// hex via `color-mix`, so changing the accent cascades to button bg/border/
// text and tooltip bg/border/arrow/glow in lockstep.
const TtWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  padding: 0.75rem;
`;

const TtRow = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: center;
`;

const TtTriggerBtn = styled.button<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-text: color-mix(in srgb, var(--acc) 55%, white 45%);
  --acc-bg: color-mix(in srgb, var(--acc) 12%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);
  position: relative;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  border: 1px solid var(--acc-border);
  background: var(--acc-bg);
  color: var(--acc-text);
`;

const TtBubble = styled.div<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-text: color-mix(in srgb, var(--acc) 55%, white 45%);
  --acc-border: color-mix(in srgb, var(--acc) 55%, transparent);
  --acc-glow: color-mix(in srgb, var(--acc) 30%, transparent);
  --bg-top: color-mix(in srgb, var(--acc) 18%, #0a0a12);
  --bg-bottom: color-mix(in srgb, var(--acc) 6%, #05050a);
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.6px;
  line-height: 1.3;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
  animation: ttInSb 0.14s ease-out;
  background: linear-gradient(160deg, var(--bg-top), var(--bg-bottom));
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.5),
    0 0 18px var(--acc-glow);

  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%) translateY(-5px) rotate(45deg);
    width: 10px;
    height: 10px;
    background: var(--bg-bottom);
    border-right: 1px solid var(--acc-border);
    border-bottom: 1px solid var(--acc-border);
  }

  @keyframes ttInSb {
    from { opacity: 0; transform: translate(-50%, 3px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }
`;

const TtCaption = styled.p`
  margin: 0;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
  max-width: 28ch;
  line-height: 1.4;
`;

function TooltipDemo() {
  const [hovered, setHovered] = useState(false);
  const accent = "#c4b5fd"; // lavender — change this hex, everything cascades

  useEffect(() => {
    if (!hovered) return;
    const t = setTimeout(() => setHovered(false), 2000);
    return () => clearTimeout(t);
  }, [hovered]);

  return (
    <TtWrap>
      <TtRow>
        <Highlight label="Tooltip">
          <TtTriggerBtn
            $accent={accent}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)}
            onBlur={() => setHovered(false)}
          >
            Save
            {hovered && <TtBubble $accent={accent}>Save</TtBubble>}
          </TtTriggerBtn>
        </Highlight>
      </TtRow>
      <TtCaption>Hover or focus. Auto-dismisses after 2 seconds.</TtCaption>
    </TtWrap>
  );
}

// ── Tile demo ───────────────────────────────────────────────────────────
// Two variants of the dashboard tile container pattern:
//   TileButton   — clickable launcher: icon + uppercase label + sub, hover
//                  bumps bg + adds outer glow.
//   SectionCard  — non-clickable content holder: always-on ambient glow,
//                  title + optional subtitle + children.
// Single-accent canonical via `color-mix` — one hex drives every derived
// tint/shade/border/glow across both variants.
const TileDemoWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 0.75rem;
  width: 100%;
`;

const TileDemoRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
`;

const TileButton = styled.button<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);
  --acc-bg: color-mix(in srgb, var(--acc) 6%, transparent);
  --acc-bg-hover: color-mix(in srgb, var(--acc) 10%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 18%, transparent);
  --acc-glow: color-mix(in srgb, var(--acc) 18%, transparent);
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 0.75rem;
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  background: var(--acc-bg);
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  font-family: inherit;

  &:hover {
    background: var(--acc-bg-hover);
    box-shadow: 0 0 14px var(--acc-glow);
  }
`;

const TileButtonIcon = styled.span`
  font-size: 1rem;
  line-height: 1;
`;

const TileButtonLabel = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--acc-text);
`;

const TileButtonSub = styled.span`
  font-size: 0.5625rem;
  color: rgba(255, 255, 255, 0.45);
`;

const SectionCard = styled.div<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);
  --acc-bg: color-mix(in srgb, var(--acc) 4%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 15%, transparent);
  --acc-glow: color-mix(in srgb, var(--acc) 8%, transparent);
  border-radius: 1rem;
  padding: 1.5rem;
  background: var(--acc-bg);
  border: 1px solid var(--acc-border);
  box-shadow: 0 0 24px var(--acc-glow);
`;

const SectionCardTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin: 0 0 0.25rem;
  color: var(--acc-text);
`;

const SectionCardSub = styled.p`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0 0 1rem;
`;

const SectionCardBody = styled.p`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  line-height: 1.5;
`;

const TileCaption = styled.p`
  margin: 0;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
  line-height: 1.4;
`;

function TileDemo() {
  const accent = "#ff4ecb"; // sandbox pink — change this hex, everything cascades
  return (
    <TileDemoWrap>
      <TileDemoRow>
        <Highlight label="Tile">
          <SectionCard $accent={accent}>
            <SectionCardTitle>Section</SectionCardTitle>
            <SectionCardSub>Things sit in here</SectionCardSub>
            <SectionCardBody>
              Non-clickable container. Always-on ambient glow. Wrap each logical
              section of a modal or page in one of these.
            </SectionCardBody>
          </SectionCard>
        </Highlight>
      </TileDemoRow>
      <TileCaption>A Tile is a container — things sit on it, it doesn&apos;t launch.</TileCaption>
    </TileDemoWrap>
  );
}

function TileButtonDemo() {
  const accent = "#ff4ecb"; // sandbox pink — change this hex, everything cascades
  return (
    <TileDemoWrap>
      <TileDemoRow>
        <Highlight label="TileButton">
          <TileButton $accent={accent} type="button">
            <TileButtonIcon>⚡</TileButtonIcon>
            <TileButtonLabel>Launch</TileButtonLabel>
            <TileButtonSub>Clickable</TileButtonSub>
          </TileButton>
        </Highlight>
      </TileDemoRow>
      <TileCaption>Clickable launcher. Hover bumps bg + adds outer glow.</TileCaption>
    </TileDemoWrap>
  );
}

// ── Drawer / DrawerIcon / DrawerMenuButton / NeonButton / concrete-drawer demos ─

const DrawerWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
  padding: 0.75rem;
  width: 100%;
`;

const DrawerShell = styled.div<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-bg-top: color-mix(in srgb, var(--acc) 10%, #0a0a12);
  --acc-bg-bot: color-mix(in srgb, var(--acc) 4%, #05050a);
  --acc-border: color-mix(in srgb, var(--acc) 35%, transparent);
  --acc-glow: color-mix(in srgb, var(--acc) 25%, transparent);
  position: relative;
  width: 220px;
  height: 140px;
  border-radius: 10px;
  background: linear-gradient(160deg, var(--acc-bg-top), var(--acc-bg-bot));
  border: 1px solid var(--acc-border);
  box-shadow: 0 0 22px var(--acc-glow), inset 0 0 12px color-mix(in srgb, var(--acc) 6%, transparent);
  display: flex;
  flex-direction: column;
  padding: 0.55rem 0.6rem;
  gap: 0.35rem;
`;

const DrawerTabPill = styled.div<{ $accent: string; $side?: "left" | "right" }>`
  --acc: ${(p) => p.$accent};
  --acc-bg: color-mix(in srgb, var(--acc) 14%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);
  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$side === "right" ? "right: -16px;" : "left: -16px;")}
  width: 20px;
  height: 52px;
  border-radius: ${(p) => (p.$side === "right" ? "6px 0 0 6px" : "0 6px 6px 0")};
  background: var(--acc-bg);
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const DrawerBodyHint = styled.div`
  font-size: 0.625rem;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const MenuBtnRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  justify-content: center;
`;

const MenuBtn = styled.button<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-bg: color-mix(in srgb, var(--acc) 14%, transparent);
  --acc-bg-hover: color-mix(in srgb, var(--acc) 28%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);
  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);
  --acc-glow: color-mix(in srgb, var(--acc) 50%, transparent);
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  background: var(--acc-bg);
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-shadow: 0 0 6px var(--acc-glow);
  transition: background 0.15s, box-shadow 0.15s;
  &:hover {
    background: var(--acc-bg-hover);
    box-shadow: 0 0 10px var(--acc-glow);
  }
`;

const MenuSep = styled.div<{ $accent: string }>`
  width: 1px;
  height: 1.25rem;
  background: color-mix(in srgb, ${(p) => p.$accent} 30%, transparent);
  margin: 0 0.2rem;
`;

const DrawerCaption = styled.p`
  margin: 0;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.45);
  text-align: center;
  line-height: 1.4;
  max-width: 36ch;
`;

// Drawer identity SVGs (never emoji).
function BellSvg() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8 A6 6 0 0 1 18 8 V13 L20 16 H4 L6 13 Z" />
      <path d="M10 20 A2 2 0 0 0 14 20" />
    </svg>
  );
}
function SpeechSvg() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5 H20 A1 1 0 0 1 21 6 V15 A1 1 0 0 1 20 16 H13 L9 20 V16 H4 A1 1 0 0 1 3 15 V6 A1 1 0 0 1 4 5 Z" />
    </svg>
  );
}
function EnvelopeSvg() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="1" />
      <path d="M3 7 L12 14 L21 7" />
    </svg>
  );
}
function CameraSvg() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="7" width="14" height="10" rx="1" />
      <path d="M16 10 L22 6 V18 L16 14 Z" />
    </svg>
  );
}

function DrawerDemo() {
  const accent = "#ff4ecb";
  return (
    <DrawerWrap>
      <Highlight label="Drawer">
        <DrawerShell $accent={accent}>
          <DrawerTabPill $accent={accent}><CameraSvg /></DrawerTabPill>
          <DrawerBodyHint>Slide-in panel body</DrawerBodyHint>
          <MenuBtnRow>
            <MenuBtn $accent={accent}>−</MenuBtn>
            <MenuBtn $accent={accent}>+</MenuBtn>
            <MenuSep $accent={accent} />
            <MenuBtn $accent={accent}>⧉</MenuBtn>
            <MenuBtn $accent={accent}>✕</MenuBtn>
          </MenuBtnRow>
        </DrawerShell>
      </Highlight>
      <DrawerCaption>Edge-anchored panel: tab pill, header controls, resizable width.</DrawerCaption>
    </DrawerWrap>
  );
}

function DrawerIconDemo() {
  const icons: { label: string; accent: string; Icon: React.FC }[] = [
    { label: "Alerts", accent: "#f7b700", Icon: BellSvg },
    { label: "Chats", accent: "#4ade80", Icon: SpeechSvg },
    { label: "Inbox", accent: "#00bfff", Icon: EnvelopeSvg },
    { label: "Sessions", accent: "#ff4ecb", Icon: CameraSvg },
  ];
  return (
    <DrawerWrap>
      <MenuBtnRow>
        {icons.map(({ label, accent, Icon }) => (
          <Highlight key={label} label={label}>
            <MenuBtn $accent={accent} aria-label={label}><Icon /></MenuBtn>
          </Highlight>
        ))}
      </MenuBtnRow>
      <DrawerCaption>Each drawer gets an outline SVG identity glyph in its accent.</DrawerCaption>
    </DrawerWrap>
  );
}

function DrawerMenuButtonDemo() {
  const accent = "#ff4ecb";
  return (
    <DrawerWrap>
      <Highlight label="DrawerMenuButton">
        <MenuBtnRow>
          <MenuBtn $accent={accent}>−</MenuBtn>
          <MenuBtn $accent={accent}>+</MenuBtn>
          <MenuSep $accent={accent} />
          <MenuBtn $accent={accent}>⧉</MenuBtn>
          <MenuBtn $accent={accent}>⊞</MenuBtn>
          <MenuBtn $accent={accent}>✕</MenuBtn>
        </MenuBtnRow>
      </Highlight>
      <DrawerCaption>2.125rem squares, bold glyph, one accent per drawer, glow on hover.</DrawerCaption>
    </DrawerWrap>
  );
}

const NeonPill = styled.button<{ $accent: string; $compact?: boolean }>`
  --acc: ${(p) => p.$accent};
  --acc-bg: color-mix(in srgb, var(--acc) 12%, transparent);
  --acc-bg-hover: color-mix(in srgb, var(--acc) 22%, transparent);
  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);
  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);
  --acc-glow: color-mix(in srgb, var(--acc) 50%, transparent);
  padding: ${(p) => (p.$compact ? "0.3rem 0.75rem" : "0.5rem 1rem")};
  border-radius: 999px;
  font-size: ${(p) => (p.$compact ? "0.625rem" : "0.75rem")};
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  background: var(--acc-bg);
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  text-shadow: 0 0 6px var(--acc-glow);
  transition: background 0.15s, box-shadow 0.15s;
  &:hover {
    background: var(--acc-bg-hover);
    box-shadow: 0 0 10px var(--acc-glow);
  }
`;

function NeonButtonDemo() {
  return (
    <DrawerWrap>
      <MenuBtnRow>
        <Highlight label="cyan"><NeonPill $accent="#00e4fd" type="button">Save</NeonPill></Highlight>
        <Highlight label="pink"><NeonPill $accent="#ff4ecb" type="button">Deploy</NeonPill></Highlight>
        <Highlight label="gold"><NeonPill $accent="#f7b700" type="button">Review</NeonPill></Highlight>
      </MenuBtnRow>
      <MenuBtnRow>
        <Highlight label="compact"><NeonPill $accent="#4ade80" $compact type="button">On</NeonPill></Highlight>
        <Highlight label="compact"><NeonPill $accent="#c4b5fd" $compact type="button">Off</NeonPill></Highlight>
      </MenuBtnRow>
      <DrawerCaption>Accent-pill CTA: thin border, low-alpha bg, full-strength text, hover glow.</DrawerCaption>
    </DrawerWrap>
  );
}

function ConcreteDrawerDemo({ accent, Icon, roster }: {
  accent: string;
  Icon: React.FC;
  roster: { glyph: React.ReactNode; accent?: string; label: string }[];
}) {
  return (
    <DrawerWrap>
      <Highlight label="Drawer">
        <DrawerShell $accent={accent}>
          <DrawerTabPill $accent={accent}><Icon /></DrawerTabPill>
          <DrawerBodyHint>Panel body</DrawerBodyHint>
          <MenuBtnRow>
            {roster.map((b, i) =>
              b.glyph === "sep" ? (
                <MenuSep key={`s${i}`} $accent={accent} />
              ) : (
                <MenuBtn key={i} $accent={b.accent ?? accent} aria-label={b.label}>{b.glyph}</MenuBtn>
              )
            )}
          </MenuBtnRow>
        </DrawerShell>
      </Highlight>
    </DrawerWrap>
  );
}

// ── ADL (Accordion Dropdown with Lightswitch) demo ─────────────────────

const AdlDemoWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 280px;
  padding: 0.75rem;
  border-radius: 10px;
  background: linear-gradient(160deg, color-mix(in srgb, #ff4ecb 6%, #0a0a12), #05050a);
  border: 1px solid color-mix(in srgb, #ff4ecb 22%, transparent);
`;

const AdlHeaderDemo = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  min-height: 1.85rem;
  padding: 0.3rem 0.75rem 0.3rem 0.5rem;
  background: ${(p) => (p.$open ? "rgba(255, 78, 203, 0.06)" : "transparent")};
  border: 1px solid ${(p) => (p.$open ? "rgba(255, 78, 203, 0.22)" : "rgba(255,255,255,0.08)")};
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: ${(p) => (p.$open ? "#ff4ecb" : "rgba(255, 78, 203, 0.65)")};
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: rgba(255, 78, 203, 0.1);
    border-color: rgba(255, 78, 203, 0.35);
    color: #ff4ecb;
  }
`;

const AdlLabelDemo = styled.span`
  flex: 1;
`;

const AdlCountDemo = styled.span`
  font-size: 0.6rem;
  color: rgba(255, 78, 203, 0.55);
  font-weight: 600;
`;

const AdlSwitchTrackDemo = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? "rgba(255, 78, 203, 0.7)" : "rgba(255,255,255,0.2)")};
  background: ${(p) => (p.$on ? "rgba(255, 78, 203, 0.2)" : "rgba(255,255,255,0.05)")};
  box-shadow: ${(p) => (p.$on ? "0 0 8px rgba(255, 78, 203, 0.45)" : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
`;

const AdlSwitchThumbDemo = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? "#ff4ecb" : "rgba(255,255,255,0.35)")};
  box-shadow: ${(p) =>
    p.$on
      ? "0 0 8px rgba(255, 78, 203, 0.85), 0 0 2px rgba(255, 78, 203, 1)"
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const AdlBodyDemo = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? "flex" : "none")};
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.2rem 0.4rem 0.4rem;
`;

const AdlBodyItem = styled.div`
  font-size: 0.65rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.55);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  &:hover { background: rgba(255, 78, 203, 0.08); color: rgba(255, 78, 203, 0.9); }
`;

function AdlDemoGroup({ label, items, defaultOpen }: { label: string; items: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <AdlHeaderDemo $open={open} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <AdlLabelDemo>{label}</AdlLabelDemo>
        <AdlCountDemo>{items.length}</AdlCountDemo>
        <AdlSwitchTrackDemo $on={open} aria-hidden="true">
          <AdlSwitchThumbDemo $on={open} />
        </AdlSwitchTrackDemo>
      </AdlHeaderDemo>
      <AdlBodyDemo $open={open}>
        {items.map((it) => <AdlBodyItem key={it}>{it}</AdlBodyItem>)}
      </AdlBodyDemo>
    </div>
  );
}

function ADLDemo() {
  return (
    <DrawerWrap>
      <Highlight label="ADL">
        <AdlDemoWrap>
          <AdlDemoGroup label="Menus" defaultOpen={true} items={["AlertsDrawer", "ChatsDrawer", "Drawer", "Dropdown Menu"]} />
          <AdlDemoGroup label="Navigation" defaultOpen={false} items={["ACR", "GPG", "Scrollbar"]} />
          <AdlDemoGroup label="Toggles" defaultOpen={true} items={["DTog", "ECL", "Eyeball", "Lightswitch"]} />
        </AdlDemoWrap>
      </Highlight>
      <DrawerCaption>Whole row is the hit target. Click anywhere on a header to toggle the mini Lightswitch AND collapse/expand the body together.</DrawerCaption>
    </DrawerWrap>
  );
}

function AlertsDrawerDemo() {
  return (
    <ConcreteDrawerDemo
      accent="#f7b700"
      Icon={BellSvg}
      roster={[
        { glyph: "−", label: "Zoom out" },
        { glyph: "+", label: "Zoom in" },
        { glyph: "sep", label: "" },
        { glyph: "⧉", label: "Popout" },
        { glyph: "⊞", label: "Fullscreen" },
        { glyph: "✕", label: "Close" },
      ]}
    />
  );
}

function ChatsDrawerDemo() {
  return (
    <ConcreteDrawerDemo
      accent="#4ade80"
      Icon={SpeechSvg}
      roster={[
        { glyph: "⎘", label: "Members" },
        { glyph: "⌫", label: "Clear" },
        { glyph: "⚙", label: "Settings" },
        { glyph: "sep", label: "" },
        { glyph: "⧉", label: "Popout" },
        { glyph: "✕", label: "Close" },
      ]}
    />
  );
}

function InboxDrawerDemo() {
  return (
    <ConcreteDrawerDemo
      accent="#00bfff"
      Icon={EnvelopeSvg}
      roster={[
        { glyph: "−", label: "Zoom out" },
        { glyph: "+", label: "Zoom in" },
        { glyph: "sep", label: "" },
        { glyph: "⧉", label: "Popout" },
        { glyph: "⊞", label: "Fullscreen" },
        { glyph: "✕", label: "Close" },
      ]}
    />
  );
}

function SessionsDrawerDemo() {
  return (
    <ConcreteDrawerDemo
      accent="#ff4ecb"
      Icon={CameraSvg}
      roster={[
        { glyph: "⎋", accent: "#ef4444", label: "Leave (destructive)" },
        { glyph: "sep", label: "" },
        { glyph: "⧉", label: "Popout" },
        { glyph: "✕", label: "Close" },
      ]}
    />
  );
}

// ── DTog (Drag Toggle) + Scrollbar demos ────────────────────────────────

const DTogRow = styled.div`
  display: flex;
  width: 320px;
  height: 140px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, #ff4ecb 25%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, #ff4ecb 6%, #0a0a12), #05050a);
`;

const DTogPanel = styled.div<{ $left?: boolean }>`
  flex: 1;
  padding: 0.55rem 0.75rem;
  font-size: 0.625rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const DTogDivider = styled.div`
  width: 8px;
  flex-shrink: 0;
  position: relative;
  cursor: col-resize;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  > svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 78, 203, 0.75);
    opacity: 0.8;
    transition: opacity 0.15s, filter 0.15s, color 0.15s;
    pointer-events: none;
  }

  &:hover {
    background: rgba(255, 78, 203, 0.1);
    border-color: rgba(255, 78, 203, 0.45);
    box-shadow:
      0 0 10px rgba(255, 78, 203, 0.35),
      inset 0 0 6px rgba(255, 78, 203, 0.18);
    > svg {
      opacity: 1;
      color: #ff4ecb;
      filter: drop-shadow(0 0 3px rgba(255, 78, 203, 0.6));
    }
  }
`;

function DTogGripDemoSvg() {
  return (
    <svg width="14" height="30" viewBox="0 0 14 30" fill="currentColor" aria-hidden="true">
      <polygon points="7,0.5 2.5,5 11.5,5" />
      <rect x="1" y="8.5" width="12" height="2" rx="1" />
      <rect x="1" y="13" width="12" height="2" rx="1" />
      <rect x="1" y="17.5" width="12" height="2" rx="1" />
      <polygon points="7,29.5 2.5,25 11.5,25" />
    </svg>
  );
}

function ExpandIconDemoSvg({ side }: { side: "left" | "right" }) {
  const pts = side === "left" ? "17,8 17,18 22,13" : "7,8 7,18 2,13";
  const barX = side === "left" ? 2 : 11;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2" y="4" width="20" height="2" rx="1" />
      <rect x={barX} y="10" width="11" height="2" rx="1" />
      <rect x={barX} y="14" width="11" height="2" rx="1" />
      <rect x="2" y="20" width="20" height="2" rx="1" />
      <polygon points={pts} />
    </svg>
  );
}

const DTogTabRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-top: 0.5rem;
`;

const DTogTab = styled.div`
  width: 22px;
  height: 48px;
  border-radius: 0 6px 6px 0;
  background: rgba(255, 78, 203, 0.1);
  border: 1px solid rgba(255, 78, 203, 0.3);
  border-left: none;
  color: #ff4ecb;
  display: flex;
  align-items: center;
  justify-content: center;
  filter: drop-shadow(0 0 3px rgba(255, 78, 203, 0.4));
`;

const DTogTabRight = styled(DTogTab)`
  border-radius: 6px 0 0 6px;
  border: 1px solid rgba(255, 78, 203, 0.3);
  border-right: none;
`;

const DTogTabLabel = styled.span`
  font-size: 0.625rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 78, 203, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

function DTogDemo() {
  return (
    <DrawerWrap>
      <Highlight label="DTog">
        <DTogRow>
          <DTogPanel>Files</DTogPanel>
          <DTogDivider aria-label="Drag to resize">
            <DTogGripDemoSvg />
          </DTogDivider>
          <DTogPanel>Preview</DTogPanel>
        </DTogRow>
      </Highlight>
      <DrawerCaption>Neon SVG grip (3 bars + up/down triangles) dead-center — inherits accent via currentColor, glows on hover.</DrawerCaption>
      <DTogTabRow>
        <DTogTab><ExpandIconDemoSvg side="left" /></DTogTab>
        <DTogTabLabel>collapsed — left</DTogTabLabel>
        <DTogTabLabel style={{ marginLeft: "auto" }}>collapsed — right</DTogTabLabel>
        <DTogTabRight><ExpandIconDemoSvg side="right" /></DTogTabRight>
      </DTogTabRow>
      <DrawerCaption>Snapped panel tabs use the same SVG language — bars + a neon arrow pointing back INTO the panel. No emoji, ever.</DrawerCaption>
    </DrawerWrap>
  );
}

// ── RSD (Row Section Divider) demo ──────────────────────────────────────

const RsdRow = styled.div`
  display: flex;
  align-items: center;
  width: 320px;
  height: 56px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, #ff4ecb 22%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, #ff4ecb 6%, #0a0a12), #05050a);
`;

const RsdCol = styled.div`
  flex: 1;
  align-self: stretch;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.9rem;
  font-size: 0.625rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 78, 203, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const RsdLine = styled.div`
  flex: 0 0 1px;
  align-self: stretch;
  background: rgba(255, 78, 203, 0.35);
`;

// Sandbox-mirror layout: the pattern here matches `SandboxModal.tsx` — a
// Header row (HeaderLeft + RSD + HeaderRight) stacked above a Body row
// (FileSidebar + DTog + CenterPane). The RSD and DTog share the same
// x-position and the same accent color: the DTog's OUTSIDE (right) hairline
// inherits the RSD's pink at rest so the neon line reads as one continuous
// stroke from the top of the header down through the full body split.
// All four DTog edges light up on hover/drag.

const SANDBOX_LEFT_W = 128; // width of the left column in the demo

const RsdStackFrame = styled.div`
  display: flex;
  flex-direction: column;
  width: 340px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, #ff4ecb 22%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, #ff4ecb 6%, #0a0a12), #05050a);
`;

const RsdHeaderRow = styled.div`
  display: flex;
  align-items: stretch;
  height: 38px;
  border-bottom: 1px solid rgba(255, 78, 203, 0.18);
`;

const RsdHeaderLeft = styled.div`
  flex-shrink: 0;
  width: ${SANDBOX_LEFT_W}px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.625rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 78, 203, 0.75);
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const RsdHeaderRight = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 0.75rem 0 0.6rem;
  font-size: 0.6rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.5);
`;

// The RSD — 1px rail; margin-left: 7px so it lands on the DTog's outside edge
// (DTog width 8 − 1px right hairline = 7px offset from the left column).
const RsdHeaderRsd = styled.div`
  flex: 0 0 1px;
  align-self: stretch;
  margin-left: 7px;
  background: rgba(255, 78, 203, 0.35);

  [data-theme="light"] & {
    background: rgba(255, 78, 203, 0.22);
  }
`;

const RsdBodyRow = styled.div`
  display: flex;
  align-items: stretch;
  min-height: 80px;
`;

const RsdFilePanel = styled.div`
  flex-shrink: 0;
  width: ${SANDBOX_LEFT_W}px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.6rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.5);
`;

const RsdCenterPane = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.6rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.5);
`;

// DTog — closed rectangle with the OUTSIDE (right) hairline tinted to match
// the RSD's accent at rest. The other three hairlines stay neutral until the
// whole rectangle lights up on hover.
const RsdHoverDTog = styled.div`
  width: 8px;
  flex-shrink: 0;
  position: relative;
  cursor: col-resize;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-right-color: rgba(255, 78, 203, 0.35);
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  [data-theme="light"] & {
    border-right-color: rgba(255, 78, 203, 0.22);
  }

  > svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 78, 203, 0.75);
    opacity: 0.8;
    transition: opacity 0.15s, filter 0.15s, color 0.15s;
    pointer-events: none;
  }

  &:hover {
    background: rgba(255, 78, 203, 0.1);
    border-color: rgba(255, 78, 203, 0.4);
    box-shadow:
      0 0 10px rgba(255, 78, 203, 0.35),
      inset 0 0 6px rgba(255, 78, 203, 0.18);
    > svg {
      opacity: 1;
      color: #ff4ecb;
      filter: drop-shadow(0 0 3px rgba(255, 78, 203, 0.55));
    }
  }
`;

function RSDDemo() {
  return (
    <DrawerWrap>
      <Highlight label="RSD">
        <RsdRow>
          <RsdCol>Left</RsdCol>
          <RsdLine />
          <RsdCol>Right</RsdCol>
        </RsdRow>
      </Highlight>
      <DrawerCaption>
        Simple two-column row — the 1px neon rail between the columns IS the RSD. No glow, no animation; purely structural.
      </DrawerCaption>

      <Highlight label="RSD + DTog — sandbox convention">
        <RsdStackFrame>
          <RsdHeaderRow>
            <RsdHeaderLeft>Menu</RsdHeaderLeft>
            <RsdHeaderRsd />
            <RsdHeaderRight>Summary · Preview controls</RsdHeaderRight>
          </RsdHeaderRow>
          <RsdBodyRow>
            <RsdFilePanel>File list</RsdFilePanel>
            <RsdHoverDTog aria-label="Drag to resize">
              <DTogGripDemoSvg />
            </RsdHoverDTog>
            <RsdCenterPane>Preview pane</RsdCenterPane>
          </RsdBodyRow>
        </RsdStackFrame>
      </Highlight>
      <DrawerCaption>
        Mirrors the Sandbox modal: <b>Menu</b> column sits under the Header's left block; the <b>Summary/Preview controls</b> live to the right of the RSD. Below, the <b>File list</b> ↔ <b>Preview pane</b> split is drawn by the DTog. The RSD sits at the DTog's OUTSIDE hairline AND inherits its color — so the pink line is one continuous stroke from the top of the header straight down through the body split. <b>Hover the DTog</b> to see all four hairlines light up together while the outside edge stays unbroken.
      </DrawerCaption>
    </DrawerWrap>
  );
}

const ScrollBox = styled.div`
  width: 280px;
  height: 160px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, #ff4ecb 25%, transparent);
  background: linear-gradient(160deg, color-mix(in srgb, #ff4ecb 6%, #0a0a12), #05050a);
  padding: 0.75rem 0.9rem;
  overflow: auto;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono, monospace);
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.55;

  scrollbar-width: thin;
  scrollbar-color: rgba(255, 78, 203, 0.35) transparent;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(255, 78, 203, 0.3);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 999px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 78, 203, 0.55);
    background-clip: padding-box;
  }
`;

function ScrollbarDemo() {
  const lines = [
    "// scroll me — pink accent thumb, rounded pill",
    "// thin rail, transparent track (dark mode)",
    "const surface = styled.div`",
    "  overflow: auto;",
    "  ${sandboxScrollbar}",
    "`;",
    "",
    "// same mixin flips to tinted track in light mode",
    "// via [data-theme=\"light\"] & selector",
    "",
    "function loremScroll() {",
    "  return Array.from({ length: 20 }, (_, i) =>",
    "    `line ${i + 1}: the quick brown fox jumps`,",
    "  ).join('\\n');",
    "}",
    "",
    "// keep scrolling — thumb auto-sizes to content",
    "// hover the thumb to intensify the pink glow",
    "// never global — always per-element on TGV surfaces",
  ];
  return (
    <DrawerWrap>
      <Highlight label="Scrollbar">
        <ScrollBox>
          {lines.map((l, i) => (
            <div key={i}>{l || "\u00a0"}</div>
          ))}
        </ScrollBox>
      </Highlight>
      <DrawerCaption>Pink accent thumb on transparent rail (dark) / tinted rail (light). Per-element, never global.</DrawerCaption>
    </DrawerWrap>
  );
}

// ── Registry ────────────────────────────────────────────────────────────
// Entries are sorted alphabetically by `name` within each category, and
// `CATEGORIES` below is sorted alphabetically by category name. Array order
// drives render order in SandboxModal, so keep new entries inserted in the
// correct alphabetical position — don't just append.
export const REGISTRY: SandboxEntry[] = [
  // ── Buttons ───────────────────────────────────────────────────────────
  {
    key: "ResetButton",
    name: "Reset Button",
    category: "Buttons",
    summary: "20×20 cyan-bordered square with ↺ glyph. Canonical 'back to default' affordance. Sits left of editable value inputs.",
    usage: "Reuse this exact element anywhere an editor control needs a reset affordance. Don't invent a new look.",
    code: `<ResetBtn onClick={() => setValue(defaultValue)}>↺</ResetBtn>

// styled
const ResetBtn = styled.button\`
  width: 20px; height: 20px; border-radius: 4px;
  border: 1px solid rgba(0,228,253,0.25);
  background: rgba(0,228,253,0.08);
  color: rgba(0,228,253,0.95);
  font-size: 12px;
  &:hover { background: rgba(0,228,253,0.2); }
\`;`,
    stylePath: "src/app/dashboard/editor/page.tsx",
    Demo: ResetBtnDemo,
  },
  {
    key: "SRT",
    name: "Sliding Resize Toggle",
    category: "Toggles",
    summary: "Editor slider with cyan gradient track + 3D radial-glow thumb. Four pieces: slider, Reset Button (↺), ValueInput (square, tabular numerals, typing moves slider), and ECL at far right. The canonical 3-axis block is Zoom / X-Axis / Y-Axis in that order.",
    usage: "Use resetValue prop or auto-pick (0 if range straddles 0, else 1 if covers 1, else midpoint). ValueInput is controlled — typing updates slider immediately.",
    code: `<SRT
  label="Zoom"
  min={0.5} max={2} step={0.05}
  resetValue={1}
  value={v} onChange={setV}
/>`,
    style: "const SliderTrack = styled.div`\nflex: 1; height: 6px;\nborder-radius: 999px;\nbackground: rgba(255,255,255,0.06);\nposition: relative;\n`;\n\nconst SliderFill = styled.div<{ $pct: number }>`\nheight: 100%;\nborder-radius: 999px;\nbackground: linear-gradient(90deg, rgba(${rgb.cyan}, 0.4), ${colors.cyan});\nwidth: ${(p) => p.$pct}%;\n`;\n\nconst SliderThumb = styled.div`\nwidth: 16px; height: 16px;\nborder-radius: 50%;\nbackground: radial-gradient(circle at 40% 40%, ${colors.cyan}, rgba(${rgb.cyan}, 0.6));\nbox-shadow: 0 0 8px ${colors.cyan};\nposition: absolute;\ntop: -5px;\ncursor: grab;\n`;\n\nconst ValueInput = styled.input`\nwidth: 48px;\ntext-align: center;\nborder-radius: 4px;\nfont-size: 12px;\npadding: 2px 4px;\nbackground: rgba(255,255,255,0.05);\nborder: 1px solid rgba(${rgb.cyan}, 0.35);\ncolor: ${colors.cyan};\nfont-variant-numeric: tabular-nums;\n`;",
    stylePath: "src/app/dashboard/editor/page.tsx",
    Demo: SRTDemo,
  },
  {
    key: "TSG",
    name: "Tab Switch Group",
    category: "Toggles",
    summary: "Horizontal control row at the top of a dashboard tab. Contains: (1) Labels/Icons Lightswitch (toggles text labels vs. SVG icons), (2) Collapse-All Lightswitch (expands/collapses every collapsible section in the tab).",
    usage: "Both switches left-aligned. Tooltip on hover (mouse) or always visible (touch). Add a TSG to every new dashboard tab with collapsible sections.",
    code: `<TSG>
  <Lightswitch on={iconMode} onChange={setIconMode} />
  <Label>Labels / Icons</Label>
  <Lightswitch on={allExpanded} onChange={setAllExpanded} />
  <Label>{allExpanded ? "Collapse all" : "Expand all"}</Label>
</TSG>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: TSGDemo,
  },

  // ── Menus ─────────────────────────────────────────────────────────────
  {
    key: "ADL",
    name: "Accordion Dropdown with Lightswitch",
    category: "Menus",
    summary: "Collapsible group header pairing an accent-tinted uppercase label (+ optional item count) with a mini Lightswitch (28×14). Whole row is the hit target — click anywhere on the header toggles switch and body together. Default open; label is always low-alpha accent, never grey.",
    usage: "Wrap any grouped sidebar or settings list. Hold open-state per group in a `Record<string, boolean>`. Click the AdlHeader to flip `$open`; the AdlBody below renders/hides accordingly. Canonical for the Sandbox Files sidebar categories (see `catOpen` state in SandboxModal).",
    code: `const [catOpen, setCatOpen] = useState<Record<string, boolean>>(() =>
  Object.fromEntries(CATEGORIES.map((c) => [c, true]))
);

{CATEGORIES.map((cat) => {
  const open = catOpen[cat] ?? true;
  return (
    <FileGroup key={cat}>
      <AdlHeader
        $open={open}
        aria-expanded={open}
        onClick={() => setCatOpen((p) => ({ ...p, [cat]: !open }))}
      >
        <AdlLabel>{cat}</AdlLabel>
        <AdlCount>{grouped[cat].length}</AdlCount>
        <AdlSwitchTrack $on={open} aria-hidden="true">
          <AdlSwitchThumb $on={open} />
        </AdlSwitchTrack>
      </AdlHeader>
      <AdlBody $open={open}>{/* items */}</AdlBody>
    </FileGroup>
  );
})}`,
    style: `const AdlHeader = styled.button<{ $open: boolean }>\`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.3rem 0.4rem;
  background: \${(p) => (p.$open ? \`rgba(\${PINK_RGB}, 0.06)\` : "transparent")};
  border: 1px solid \${(p) => (p.$open ? \`rgba(\${PINK_RGB}, 0.22)\` : "rgba(255,255,255,0.08)")};
  border-radius: 6px;
  cursor: pointer;
  color: \${(p) => (p.$open ? PINK : \`rgba(\${PINK_RGB}, 0.65)\`)};
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: rgba(\${PINK_RGB}, 0.1);
    border-color: rgba(\${PINK_RGB}, 0.35);
    color: \${PINK};
  }
\`;

const AdlSwitchTrack = styled.span<{ $on: boolean }>\`
  position: relative;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid \${(p) => (p.$on ? \`rgba(\${PINK_RGB}, 0.7)\` : "rgba(255,255,255,0.2)")};
  background: \${(p) => (p.$on ? \`rgba(\${PINK_RGB}, 0.2)\` : "rgba(255,255,255,0.05)")};
  box-shadow: \${(p) => (p.$on ? \`0 0 8px rgba(\${PINK_RGB}, 0.45)\` : "none")};
  transition: all 0.18s;
\`;

const AdlSwitchThumb = styled.span<{ $on: boolean }>\`
  position: absolute;
  top: 1px;
  left: \${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: \${(p) => (p.$on ? PINK : "rgba(255,255,255,0.35)")};
  box-shadow: \${(p) => (p.$on
    ? \`0 0 8px rgba(\${PINK_RGB}, 0.85), 0 0 2px rgba(\${PINK_RGB}, 1)\`
    : "0 1px 2px rgba(0,0,0,0.3)")};
  transition: all 0.18s;
\`;

const AdlBody = styled.div<{ $open: boolean }>\`
  display: \${(p) => (p.$open ? "block" : "none")};
\`;`,
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: ADLDemo,
  },
  {
    key: "AlertsDrawer",
    name: "AlertsDrawer",
    category: "Menus",
    summary: "Concrete gold drawer for system announcements. Bell glyph; menu = zoom out, zoom %, zoom in, separator, popout, fullscreen, close — all gold accent-filled. Left edge, Y ~20%, default width 640px. Popout route /dashboard/announcements. Reference implementation for the accent-fill pattern.",
    usage: "Mount at the app shell (dashboard layout). Wraps `AnnouncementsPanel`. Use this as the reference when adding a new drawer — roster, spacing, and accent application are canonical here.",
    code: `<AlertsDrawer
  side="left"
  defaultY={0.2}
  defaultWidth={640}
  popoutRoute="/dashboard/announcements"
/>`,
    stylePath: "src/app/components/drawers/AlertsDrawer.tsx",
    Demo: AlertsDrawerDemo,
  },
  {
    key: "ChatsDrawer",
    name: "ChatsDrawer",
    category: "Menus",
    summary: "Concrete green drawer for team chat. Speech-bubble glyph with unread badge. Menu = members, clear, settings, popout, close (chat view). Self-contained message list + composer + settings modal. Left edge, Y ~40%. Mutex detail 'chat'; popout route /dashboard/chat.",
    usage: "Mount at the app shell. Speech-bubble glyph shows an unread count badge when messages are pending. Menu differs from Alerts/Inbox — no zoom, but adds Members/Clear/Settings.",
    code: `<ChatsDrawer
  side="left"
  defaultY={0.4}
  defaultWidth={640}
  popoutRoute="/dashboard/chat"
/>`,
    stylePath: "src/app/components/drawers/ChatsDrawer.tsx",
    Demo: ChatsDrawerDemo,
  },
  {
    key: "Drawer",
    name: "Drawer",
    category: "Menus",
    summary: "Edge-anchored slide-in panel, full viewport height, left or right side. Closed state is a vertical accent-tinted tab pill pinned to the edge; draggable Y position persists to localStorage. Open state slides the panel in with a resize handle. One accent per drawer; drawers on the same side are mutually exclusive via CustomEvent bus. ESC closes.",
    usage: "Use for team/client auxiliary panels on the dashboard (Alerts, Chats, Inbox, Sessions). Pick an edge (left|right) and an accent. Wrap header controls with `DrawerMenuButton`s. Use `NeonButton` for primary CTAs inside the body. Never nest drawers — they communicate via a CustomEvent bus to stay mutually exclusive on the same edge.",
    code: `<Drawer
  side="left"
  accent="#ff4ecb"
  icon={<CameraSvg />}
  defaultY={0.8}
  defaultWidth={640}
  mutexDetail="sessions"
>
  {/* body */}
</Drawer>`,
    style: "const Shell = styled.aside<{ $accent: string }>\`\n  --acc: \\${(p) => p.$accent};\n  position: fixed;\n  top: 0; bottom: 0;\n  width: var(--drawer-w, 640px);\n  background: color-mix(in srgb, var(--acc) 4%, #05060a 96%);\n  border-right: 1px solid color-mix(in srgb, var(--acc) 25%, transparent);\n  box-shadow: 0 0 40px color-mix(in srgb, var(--acc) 10%, transparent);\n\`;\n\nconst TabPill = styled.button<{ $accent: string }>\`\n  position: absolute;\n  top: var(--drawer-y, 20%);\n  right: -28px;\n  width: 28px; height: 64px;\n  border-radius: 0 8px 8px 0;\n  background: color-mix(in srgb, var(--acc) 14%, transparent);\n  border: 1px solid color-mix(in srgb, var(--acc) 40%, transparent);\n  color: var(--acc);\n  cursor: grab;\n\`;",
    stylePath: "src/app/components/drawers/Drawer.tsx",
    Demo: DrawerDemo,
  },
  {
    key: "DrawerIcon",
    name: "DrawerIcon",
    category: "Icons",
    summary: "Abstract styling pattern for the SVG glyph on a Drawer's tab pill + popout header. Rules: 13–14px, outline preferred, accent-colored, open-state swaps for 10×10 × close icon. Per-drawer specifics (bell/bubble/envelope/camera) live in the `<Name>Drawer` entries.",
    usage: "Every drawer needs an identity glyph — gold bell (Alerts), green speech bubble (Chats), cyan envelope (Inbox), pink video camera (Sessions). Use inline SVG with `stroke=\"currentColor\"` so it inherits the drawer accent. Never emoji.",
    code: `<TabPill $accent={accent}>
  {open ? <CloseSvg /> : <BellSvg />}
</TabPill>`,
    stylePath: "src/app/components/drawers/icons/",
    Demo: DrawerIconDemo,
  },
  {
    key: "DrawerMenuButton",
    name: "DrawerMenuButton",
    category: "Buttons",
    summary: "Abstract styling pattern for a Drawer's header control buttons. Rules: 2.125rem square, low-alpha accent bg + thin accent border + bold accent glyph + text-shadow glow (dark) + box-shadow glow on hover. One accent per drawer; destructive actions may stay red. Per-drawer button rosters in the concrete `<Name>Drawer` entries.",
    usage: "Use for every control in a drawer's header roster — zoom, popout, fullscreen, settings, close, etc. Match the drawer's accent. The only exception: destructive actions (leave, delete) may use `#ef4444` red. In a popout window, replace the `⧉` button with a `ReturnToMain` button using the same styling.",
    code: `<MenuBtnRow>
  <MenuBtn $accent={accent} aria-label="Zoom out">−</MenuBtn>
  <MenuBtn $accent={accent} aria-label="Zoom in">+</MenuBtn>
  <MenuSep $accent={accent} />
  <MenuBtn $accent={accent} aria-label="Popout">⧉</MenuBtn>
  <MenuBtn $accent={accent} aria-label="Close">✕</MenuBtn>
</MenuBtnRow>`,
    style: "const MenuBtn = styled.button<{ $accent: string }>\`\n  --acc: \\${(p) => p.$accent};\n  --acc-bg: color-mix(in srgb, var(--acc) 14%, transparent);\n  --acc-bg-hover: color-mix(in srgb, var(--acc) 26%, transparent);\n  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);\n  --acc-glow: color-mix(in srgb, var(--acc) 50%, transparent);\n  width: 2.125rem; height: 2.125rem;\n  display: inline-flex; align-items: center; justify-content: center;\n  border-radius: 0.5rem;\n  background: var(--acc-bg);\n  border: 1px solid var(--acc-border);\n  color: var(--acc);\n  text-shadow: 0 0 6px var(--acc-glow);\n  font-weight: 700;\n  cursor: pointer;\n  &:hover {\n    background: var(--acc-bg-hover);\n    box-shadow: 0 0 10px var(--acc-glow);\n  }\n\`;",
    stylePath: "src/app/components/drawers/DrawerHeader.tsx",
    Demo: DrawerMenuButtonDemo,
  },
  {
    key: "DDM",
    name: "Dropdown Menu",
    category: "Menus",
    summary: "Rounded-pill dropdown. Two variants: simple (whole trigger toggles) and split-pill (left half = default action, right half = triangle that opens menu, divided by 1.5px border). Mystic-purple gradient on hover, filled triangle arrow, fade+slide-down menu entry.",
    usage: "Escape closes before any parent modal's Escape. Outside-click closes. Action pairs use `min-width: 140px` to stay visually matched.",
    code: `<DDMWrapper>
  <DDMTrigger onClick={toggle}>
    {value} <Triangle />
  </DDMTrigger>
  {open && (
    <DDMMenu>
      {options.map(o => <DDMItem onClick={() => pick(o)}>{o}</DDMItem>)}
    </DDMMenu>
  )}
</DDMWrapper>`,
    style: "const DDMTrigger = styled.button`\ndisplay: flex;\nalign-items: center;\ngap: 0.5rem;\npadding: 0.375rem 0.75rem;\nborder-radius: 999px;\nfont-size: 0.6875rem;\nfont-weight: 700;\ntext-transform: uppercase;\nletter-spacing: 0.1em;\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbackground: rgba(${rgb.pink}, 0.06);\ncolor: ${colors.pink};\ncursor: pointer;\n`;\n\nconst DDMMenu = styled.div`\nposition: absolute;\ntop: 100%;\nright: 0;\nmargin-top: 0.5rem;\nborder-radius: 0.75rem;\nmin-width: 180px;\nbackground: rgba(8, 10, 16, 0.98);\nborder: 1px solid rgba(${rgb.pink}, 0.25);\nbox-shadow: 0 12px 40px rgba(0,0,0,0.7);\nz-index: 80;\noverflow: hidden;\n`;\n\nconst DDMItem = styled.button`\nwidth: 100%;\ntext-align: left;\npadding: 0.5rem 1rem;\nfont-size: 0.6875rem;\nbackground: none;\nborder: none;\ncolor: var(--t-textMuted);\ncursor: pointer;\n&:hover { background: var(--t-inputBg); }\n`;",
    stylePath: "src/app/components/TopNav.tsx",
    Demo: DDMDemo,
  },
  {
    key: "InboxDrawer",
    name: "InboxDrawer",
    category: "Menus",
    summary: "Concrete cyan drawer wrapping Fastmail JMAP EmailClient inside EmailErrorBoundary. Envelope glyph. Menu mirrors Alerts: zoom out, %, zoom in, separator, popout, fullscreen, close — all cyan. Left edge, Y ~60%, default width 720px. Popout route /dashboard/email. Lazy-loaded via next/dynamic.",
    usage: "Mount at the app shell behind a dynamic import (email client is heavy). Menu matches AlertsDrawer exactly — only the accent + glyph + popout route differ.",
    code: `const InboxDrawer = dynamic(
  () => import("./drawers/InboxDrawer"),
  { ssr: false }
);

<InboxDrawer
  side="left"
  defaultY={0.6}
  defaultWidth={720}
  popoutRoute="/dashboard/email"
/>`,
    stylePath: "src/app/components/drawers/InboxDrawer.tsx",
    Demo: InboxDrawerDemo,
  },
  {
    key: "NeonButton",
    name: "NeonButton",
    category: "Buttons",
    summary: "Rounded accent-pill button. Thin accent border (alpha ~0.3–0.4), low-alpha accent background (~0.1–0.14), full-strength accent text. Dark mode adds text-shadow glow; hover intensifies bg and adds box-shadow glow. Compact uppercase variant for toggle pills. Canonical CTA style inside any drawer/panel.",
    usage: "Use for primary and secondary actions inside drawers, modals, and panels. Pick one accent per drawer to stay visually consistent. Compact variant for toggle/pill rows. Light mode drops the text-shadow but keeps border + bg + box-shadow glow on hover.",
    code: `<NeonButton $accent="#ff4ecb" onClick={join}>Join Session</NeonButton>
<NeonButton $accent="#00bfff" $compact>On</NeonButton>`,
    style: "const NeonButton = styled.button<{ $accent: string; $compact?: boolean }>\`\n  --acc: \\${(p) => p.$accent};\n  --acc-bg: color-mix(in srgb, var(--acc) 12%, transparent);\n  --acc-bg-hover: color-mix(in srgb, var(--acc) 22%, transparent);\n  --acc-border: color-mix(in srgb, var(--acc) 45%, transparent);\n  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);\n  --acc-glow: color-mix(in srgb, var(--acc) 50%, transparent);\n  padding: \\${(p) => (p.$compact ? \"0.3rem 0.75rem\" : \"0.5rem 1rem\")};\n  border-radius: 999px;\n  font-size: \\${(p) => (p.$compact ? \"0.625rem\" : \"0.75rem\")};\n  font-weight: 700;\n  letter-spacing: 0.1em;\n  text-transform: uppercase;\n  cursor: pointer;\n  background: var(--acc-bg);\n  border: 1px solid var(--acc-border);\n  color: var(--acc-text);\n  text-shadow: 0 0 6px var(--acc-glow);\n  &:hover {\n    background: var(--acc-bg-hover);\n    box-shadow: 0 0 10px var(--acc-glow);\n  }\n\`;",
    stylePath: "packages/@tgv/core/src/components/ui/NeonButton.tsx",
    Demo: NeonButtonDemo,
  },
  {
    key: "QMBM",
    name: "Question-Mark-Bubble Modal",
    category: "Menus",
    summary: "Small `?` bubble that opens an info card with title + body. Use instead of hover-tooltips when the explanation is longer than a sentence or needs to be touch-friendly. Portaled to body so ancestor overflow/z-index doesn't clip it.",
    usage: "Click toggles, Escape closes, × closes, outside-click closes. Themes: neutral/cyan/lavender. Placements: modal (backdrop) or popover (inside an open modal).",
    code: `<QMBM
  theme="cyan"
  placement="popover"
  title="Webhook secret"
  body="Used to sign outbound payloads…"
/>`,
    style: "const Bubble = styled.button`\nwidth: 20px; height: 20px;\nborder-radius: 50%;\nborder: 1px solid rgba(${rgb.pink}, 0.4);\nbackground: rgba(${rgb.pink}, 0.08);\ncolor: ${colors.pink};\nfont-size: 10px;\nfont-weight: 700;\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\n`;\n\nconst InfoCard = styled.div`\nposition: fixed;\nz-index: 9999;\nwidth: 280px;\nborder-radius: 0.75rem;\npadding: 1rem;\nbackground: rgba(8, 10, 16, 0.98);\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbox-shadow: 0 12px 40px rgba(0,0,0,0.6);\n`;",
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: QMBMDemo,
  },
  {
    key: "SBDM",
    name: "Search Bar Dropdown Menu",
    category: "Menus",
    summary: "Hybrid type-ahead + browse pattern. Single rounded input with a 🔍 icon (left) and a ▾ dropdown arrow (right). Typing filters in place. Clicking the arrow opens a panel below with its own inner search bar and an A-Z ⇄ Z-A sort toggle whose label reads the OPPOSITE of the current state.",
    usage: "Use when the dataset is large enough that typing alone is faster than scrolling, but the user might not know the exact name. Examples: country picker, tag selector, model picker. Don't use for small fixed lists (≤8 items) — use a DDM instead. Selecting a list item fills the trigger input and closes the panel.",
    code: `<SBDMWrapper>
  <SBDMTrigger>
    <SearchIcon />
    <input value={value} onChange={onChange} placeholder="Search…" />
    <ArrowBtn onClick={() => setOpen(o => !o)}>▾</ArrowBtn>
  </SBDMTrigger>

  {open && (
    <SBDMPanel>
      <PanelHeader>
        <input value={inner} onChange={...} placeholder="Search inside…" autoFocus />
        <SortToggle onClick={() => setAsc(a => !a)}>
          {asc ? "Z-A" : "A-Z"} ↕
        </SortToggle>
      </PanelHeader>
      <PanelList>
        {items
          .filter(matches(inner))
          .sort(asc ? az : za)
          .map(item => (
            <PanelItem onClick={() => select(item)}>{item}</PanelItem>
          ))}
      </PanelList>
    </SBDMPanel>
  )}
</SBDMWrapper>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: SBDMDemo,
  },
  {
    key: "SessionsDrawer",
    name: "SessionsDrawer",
    category: "Menus",
    summary: "Concrete pink drawer for LiveKit E2EE video rooms. Video-camera glyph (padlock replaced 2026-04-18). Menu = leave (red exception), popout, close — closing the drawer does NOT disconnect the room. Lobby shows pink NeonButton JoinBtn. Left edge, Y ~80%. Popout route /dashboard/sessions.",
    usage: "Mount at the app shell. Pink is the session accent everywhere. The Leave button uses red (`#ef4444`) as the only non-accent-conforming destructive action. Closing the drawer must keep the underlying LiveKit room connected — only Leave disconnects.",
    code: `<SessionsDrawer
  side="left"
  defaultY={0.8}
  defaultWidth={640}
  popoutRoute="/dashboard/sessions"
/>`,
    stylePath: "src/app/components/drawers/SessionsDrawer.tsx",
    Demo: SessionsDrawerDemo,
  },
  {
    key: "Tile",
    name: "Tile",
    category: "Menus",
    summary: "Non-clickable accent-tinted rounded container (aka SectionCard). Things *sit on* a Tile — it's not a launcher. Always-on ambient box-shadow glow (the key tell vs. TileButton). Uppercase accent title + optional subtitle + arbitrary children. Canonical way to break a modal or page into labeled sections.",
    usage: "Use to break a modal or page into labeled sections. One Tile per logical group (Recent Activity, Team Members, Billing, etc.). Single `$accent` hex drives every derived tint via `color-mix`. Do NOT use for clickable launchers — use TileButton. Do NOT use for drawer header controls — use DrawerMenuButton.",
    code: `<Tile $accent={colors.cyan}>
  <TileTitle>Recent Activity</TileTitle>
  <TileSub>PM2 + git · last 24h</TileSub>
  {children}
</Tile>`,
    style: "const Tile = styled.div<{ $accent: string }>\`\n  --acc: \\${(p) => p.$accent};\n  --acc-bg: color-mix(in srgb, var(--acc) 4%, transparent);\n  --acc-border: color-mix(in srgb, var(--acc) 15%, transparent);\n  --acc-glow: color-mix(in srgb, var(--acc) 8%, transparent);\n  border-radius: 1rem;\n  padding: 1.5rem;\n  background: var(--acc-bg);\n  border: 1px solid var(--acc-border);\n  box-shadow: 0 0 24px var(--acc-glow);\n\`;",
    stylePath: "src/app/components/DashCard.tsx",
    Demo: TileDemo,
  },
  {
    key: "TileButton",
    name: "TileButton",
    category: "Buttons",
    summary: "Clickable launcher sibling of Tile. Same accent palette + border-radius, but icon + uppercase label + sub layout and hover-only outer glow (vs. Tile's always-on ambient glow). Canonical on the dashboard's 1→2→3→5 launcher grid. Dashed-border sub-variant (transparent bg + 2px dashed border) for '+Add' / SuggestionBox slots.",
    usage: "Use for launcher grids: dashboards, modal home screens, category pickers, shortcut panels. Pair with GPG/ACR for responsive pagination when the grid exceeds the viewport. Dashed variant for 'add new' slots. Do NOT use as a content container — use Tile.",
    code: `<TileButton $accent={colors.pink} onClick={openModal}>
  <TileButtonIcon>🚀</TileButtonIcon>
  <TileButtonLabel>Deploy</TileButtonLabel>
  <TileButtonSub>Projects</TileButtonSub>
</TileButton>`,
    style: "const TileButton = styled.button<{ $accent: string }>\`\n  --acc: \\${(p) => p.$accent};\n  --acc-text: color-mix(in srgb, var(--acc) 75%, white 25%);\n  --acc-bg: color-mix(in srgb, var(--acc) 6%, transparent);\n  --acc-bg-hover: color-mix(in srgb, var(--acc) 10%, transparent);\n  --acc-border: color-mix(in srgb, var(--acc) 18%, transparent);\n  --acc-glow: color-mix(in srgb, var(--acc) 18%, transparent);\n  display: flex; flex-direction: column;\n  align-items: center; justify-content: center;\n  gap: 0.5rem;\n  border-radius: 1rem;\n  padding: 1.25rem 0.75rem;\n  cursor: pointer;\n  background: var(--acc-bg);\n  border: 1px solid var(--acc-border);\n  color: var(--acc-text);\n  transition: background 0.2s, box-shadow 0.2s;\n  &:hover {\n    background: var(--acc-bg-hover);\n    box-shadow: 0 0 18px var(--acc-glow);\n  }\n\`;",
    stylePath: "src/app/dashboard/page.tsx",
    Demo: TileButtonDemo,
  },
  {
    key: "Tooltip",
    name: "Tooltip",
    category: "Menus",
    summary: "Portal-rendered themed bubble that replaces native `title=` on buttons, icons, and controls. Small bubble appears below the trigger with an upward-pointing arrow. Three themes (cyan default, lavender for Orakle, neutral tan). Auto-dismisses at 2s; viewport-clamped; arrow always points at the true trigger center. Canonical source lives in `@tgv/core`.",
    usage: "Wrap any button/icon needing a ≤4-word hint. `<Tooltip label=\"Zoom in\" theme=\"cyan\"><button>+</button></Tooltip>`. For longer explanations use QMBM. Disabled-button safe (outer wrap is a span so hover fires even when inner button is disabled). Hides on blur/click/touchend; shows on focus/mouseenter.",
    code: `<Tooltip label="Zoom in" theme="cyan">
  <button onClick={zoomIn}>+</button>
</Tooltip>

<Tooltip label="Open settings" theme="lavender">
  <IconBtn>⚙</IconBtn>
</Tooltip>`,
    style: "const Bubble = styled.div\`\n  position: fixed;\n  z-index: 10000;\n  padding: 8px 14px;\n  border-radius: 10px;\n  font-size: 11.5px;\n  font-weight: 600;\n  letter-spacing: 0.6px;\n  line-height: 1.3;\n  text-transform: uppercase;\n  white-space: nowrap;\n  background: linear-gradient(160deg, \\${bgTop}, \\${bgBottom});\n  border: 1px solid \\${borderAlpha};\n  color: \\${textColor};\n  box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 18px \\${glow};\n  animation: tt-in 0.14s ease-out;\n\`;\n\nconst Arrow = styled.div\`\n  position: absolute;\n  top: -5px;\n  width: 10px;\n  height: 10px;\n  background: \\${bgTop};\n  border-top: 1px solid \\${borderAlpha};\n  border-left: 1px solid \\${borderAlpha};\n  transform: rotate(45deg);\n\`;",
    stylePath: "packages/@tgv/core/src/components/ui/Tooltip.tsx",
    Demo: TooltipDemo,
  },

  // ── Navigation ────────────────────────────────────────────────────────
  {
    key: "ACR",
    name: "Adaptive Collection Renderer",
    category: "Navigation",
    summary: "Orchestrator that switches between GPG (mobile) and TPG (tablet+) based on viewport. Detects columns via `matchMedia` at 600/900/1200px. Default page size = column count so every page fills one row.",
    usage: "Wrap any repeated-card collection. Provide a shared `renderCard()`. ACR picks the view mode, column count, and page size — child GPG/TPG just render from it.",
    code: `<ACR
  items={items}
  renderCard={(item) => <Card {...item} />}
  breakpoints={{ 600: 1, 900: 2, 1200: 3, Infinity: 5 }}
/>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: ACRDemo,
  },
  {
    key: "DTog",
    name: "Drag Toggle",
    category: "Toggles",
    summary: "Grabbable divider between two resizable panels. ~8px **closed-rectangle** rail (1px hairline on all four sides) with a visible **neon SVG grip** (3 bars + up/down triangles) dead-center between the left/right hairlines, inheriting accent via `currentColor` for dark/light mode. **Whole rectangle glows on hover** (outer + inset box-shadow). **Drag to resize, plain click to collapse** (≤4px slop = click → snap). When a panel snaps fully collapsed, the restore tab shows a matching SVG `ExpandIcon` (bars + directional arrow) — never an emoji. When paired with an [RSD](#RSD) above/beside it, the RSD MUST align with the DTog's OUTSIDE (right) hairline AND that outside hairline adopts the RSD's accent color at rest (other three edges stay neutral), so one continuous neon line runs from the RSD straight through the DTog's outer edge.",
    usage: "Render `<DTog><DTogGrip /></DTog>` between any two resizable panels. Pointer handlers + width state live on the parent (see `useResizePanel` — track a `moved` flag and on pointerup, if `!moved`, snap to zero so click-only gestures also collapse). When a side snaps, show `<ExpandIcon side=\"left\" />` (or `\"right\"`) inside the restore `DrawerTab`. Grip and expand icon both use `fill=\"currentColor\"` so one `color` rule per surface drives hue + mode. Siblings that update with resize state (e.g. header column widths) must disable their CSS `transition` during active drag — otherwise they lag behind the pointer.",
    code: `function DTogGrip() {
  return (
    <svg width="14" height="30" viewBox="0 0 14 30" fill="currentColor" aria-hidden="true">
      <polygon points="7,0.5 2.5,5 11.5,5" />
      <rect x="1" y="8.5"  width="12" height="2" rx="1" />
      <rect x="1" y="13"   width="12" height="2" rx="1" />
      <rect x="1" y="17.5" width="12" height="2" rx="1" />
      <polygon points="7,29.5 2.5,25 11.5,25" />
    </svg>
  );
}

function ExpandIcon({ side }: { side: "left" | "right" }) {
  const pts = side === "left" ? "17,8 17,18 22,13" : "7,8 7,18 2,13";
  const barX = side === "left" ? 2 : 11;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="2"    y="4"  width="20" height="2" rx="1" />
      <rect x={barX} y="10" width="11" height="2" rx="1" />
      <rect x={barX} y="14" width="11" height="2" rx="1" />
      <rect x="2"    y="20" width="20" height="2" rx="1" />
      <polygon points={pts} />
    </svg>
  );
}

// Closed-rectangle rail: 1px hairline on all four sides.
// Grip sits dead-center between the left + right hairlines.
//
// $pairedSide ties the DTog to a sibling RSD: the hairline on that side
// inherits the RSD's accent at rest so the line reads as ONE continuous
// stroke from the RSD into the DTog. The other three edges stay neutral
// until hover/drag lights them all up together.
const DTog = styled.div<{
  $dragging?: boolean;
  $pairedSide?: "left" | "right";
}>\`
  width: 8px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  box-sizing: border-box;
  border: 1px solid var(--t-border);
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  /* OUTSIDE hairline matches the paired RSD's accent — canonical pattern. */
  \${(p) =>
    p.$pairedSide &&
    css\`
      border-\${p.$pairedSide}-color: rgba(\${PINK_RGB}, 0.35);
      [data-theme="light"] & {
        border-\${p.$pairedSide}-color: rgba(\${PINK_RGB}, 0.22);
      }
    \`}

  > svg {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(\${PINK_RGB}, 0.75);
    opacity: 0.8;
    pointer-events: none;
  }

  [data-theme="light"] & > svg { color: rgba(\${PINK_RGB}, 0.9); }

  /* Whole rectangle glows on hover/drag — outer halo + subtle inset. */
  &:hover {
    background: rgba(\${PINK_RGB}, 0.1);
    border-color: rgba(\${PINK_RGB}, 0.4);
    box-shadow:
      0 0 10px rgba(\${PINK_RGB}, 0.35),
      inset 0 0 6px rgba(\${PINK_RGB}, 0.18);
    > svg {
      opacity: 1;
      color: \${PINK};
      filter: drop-shadow(0 0 3px rgba(\${PINK_RGB}, 0.55));
    }
  }
\`;

// Usage — parent owns drag + snap logic. Pass $pairedSide when an RSD
// sits above/beside this DTog on the same vertical line (see RSD.md).
<DTog onPointerDown={startDrag} $dragging={dragging} $pairedSide="right">
  <DTogGrip />
</DTog>

// Snapped-panel restore tab
{snapped && (
  <DrawerTab $side="left" onClick={restore}>
    <ExpandIcon side="left" />
  </DrawerTab>
)}`,
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: DTogDemo,
  },
  {
    key: "GPG",
    name: "Gallery Pagination Group",
    category: "Navigation",
    summary: "Responsive paginated grid: columns scale 1 → 2 → 3 → 5 across the 600/900/1200px breakpoints, page size always equals column count. Pager (28px circle ‹ ›  + `N / M` counter) only renders when `total > pageSize` — small datasets show as a static grid with no pager.",
    usage: "Wrap any repeated-card collection. Use TileGrid styled-component with responsive media queries at 600/900/1200px breakpoints. Track current column count via `matchMedia` for slicing. Reset page to 0 when filter or column count changes.",
    code: "// Hook (mirrors refusionist AnnouncementsWidget)\nfunction useGPGColumns() {\n  const [cols, setCols] = useState(3);\n  useEffect(() => {\n    const update = () => {\n      const w = window.innerWidth;\n      if (w < 600) setCols(1);\n      else if (w < 900) setCols(2);\n      else if (w < 1200) setCols(3);\n      else setCols(5);\n    };\n    update();\n    window.addEventListener(\"resize\", update);\n    return () => window.removeEventListener(\"resize\", update);\n  }, []);\n  return cols;\n}\n\n// Render\nconst cols = useGPGColumns();\nconst pageSize = cols;\nconst totalPages = Math.max(1, Math.ceil(items.length / pageSize));\nconst showPager = items.length > pageSize;\nconst visible = items.slice(page * pageSize, (page + 1) * pageSize);\n\n<>\n  <TileGrid>\n    {visible.map(renderCard)}\n  </TileGrid>\n  {showPager && (\n    <PagerRow>\n      <PagerBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</PagerBtn>\n      <PagerInfo>{page + 1} / {totalPages}</PagerInfo>\n      <PagerBtn disabled={page === totalPages - 1} onClick={() => setPage(p => p + 1)}>›</PagerBtn>\n    </PagerRow>\n  )}\n</>",
    style: "const TileGrid = styled.section`\ndisplay: grid;\ngrid-template-columns: 1fr;\ngap: 0.75rem;\n\n@media (min-width: 600px) { grid-template-columns: repeat(2, 1fr); }\n@media (min-width: 900px) { grid-template-columns: repeat(3, 1fr); }\n@media (min-width: 1200px) { grid-template-columns: repeat(5, 1fr); }\n`;\n\nconst PagerRow = styled.div`\ndisplay: flex;\nalign-items: center;\njustify-content: center;\ngap: 0.75rem;\nmargin-top: 0.75rem;\n`;\n\nconst PagerBtn = styled.button`\nwidth: 28px; height: 28px;\nborder-radius: 50%;\nborder: 1px solid rgba(${rgb.pink}, 0.3);\nbackground: rgba(${rgb.pink}, 0.06);\ncolor: ${colors.pink};\ncursor: pointer;\n&:disabled { opacity: 0.3; cursor: not-allowed; }\n`;",
    stylePath: "src/app/dashboard/page.tsx",
    Demo: GPGDemo,
  },
  {
    key: "RSD",
    name: "Row Section Divider",
    category: "Navigation",
    summary: "1px neon-tinted vertical (or horizontal) hairline that separates labeled sections within a single row. Structural, never interactive — no glow, no animation. Accent low-alpha (`rgba(accent, 0.35)` dark, `rgba(accent, 0.22)` light), spans edge-to-edge via `align-self: stretch`. The static cousin of [DTog](#DTog): DTog is the grabbable divider between resizable panels; RSD is the fixed divider inside a fixed row. **Pairing rule:** when an RSD sits above/beside a DTog on the same vertical line, the RSD is the source of truth for that line's color — the DTog's OUTSIDE hairline adopts the RSD's accent at rest so the line reads as one continuous neon stroke from row into body.",
    usage: "Render an `<Rsd>` element as a flex item between the two columns of any row that needs a labeled section split. Use `flex: 0 0 1px` + `align-self: stretch` so it is exactly 1px wide and spans the full row height. When the row sits directly above/beside a DTog (e.g. the Sandbox modal Header above the Files/Body DTog), the RSD MUST align with the DTog's OUTSIDE hairline — set `margin-left: 7px` (DTog width 8px − 1px right hairline) so one continuous outer line runs from the header into the body. Hide the RSD conditionally when the preceding column's width is 0 (e.g. sidebar snapped closed).",
    code: `const Rsd = styled.div<{ $edit?: boolean }>\`
  flex: 0 0 1px;
  align-self: stretch;

  /* 7px margin lands the RSD on the DTog's outside (right) hairline —
     DTog is 8px wide with a 1px hairline at its right edge. */
  margin-left: 7px;

  background: rgba(\${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.35);

  [data-theme="light"] & {
    background: rgba(\${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.22);
  }
\`;

// Usage inside a flex row
<HeaderLeft>…</HeaderLeft>
{!sidebar.snapped && <Rsd $edit={editMode} />}
<HeaderRight>…</HeaderRight>`,
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: RSDDemo,
  },
  {
    key: "Scrollbar",
    name: "Scrollbar",
    category: "Navigation",
    summary: "Themed thin scrollbar for TGV surfaces. Pink accent thumb (rounded pill, `background-clip: padding-box` inset) on a transparent track in dark mode; tinted track + stronger thumb in light mode. Emitted as a styled-components `css` mixin; both modes switched via `[data-theme=\"light\"] &`.",
    usage: "Apply per-element to any scrollable container inside a TGV surface (sidebar, code pane, drawer body). Never global — browser page chrome keeps its native scrollbar. The mixin emits both dark and light modes; the active mode is selected automatically from the `data-theme` attribute set by LDM.",
    code: `import styled, { css } from "styled-components";

const scrollbar = css\`
  scrollbar-width: thin;
  scrollbar-color: rgba(\${PINK_RGB}, 0.35) transparent;

  &::-webkit-scrollbar { width: 10px; height: 10px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: rgba(\${PINK_RGB}, 0.28);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 999px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(\${PINK_RGB}, 0.5);
    background-clip: padding-box;
  }

  [data-theme="light"] & {
    scrollbar-color: rgba(\${PINK_RGB}, 0.55) rgba(0, 0, 0, 0.04);
    &::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.04); }
    &::-webkit-scrollbar-thumb { background: rgba(\${PINK_RGB}, 0.55); }
    &::-webkit-scrollbar-thumb:hover { background: rgba(\${PINK_RGB}, 0.75); }
  }
\`;

// Apply per-element
const FileSidebar = styled.aside\`
  overflow: auto;
  \${scrollbar}
\`;`,
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: ScrollbarDemo,
  },
  {
    key: "SB",
    name: "SuggestionBox",
    category: "Navigation",
    summary: "Dashed-border dashboard tile that opens a feature-request modal. Users describe an idea, Claude AI generates a structured implementation plan, GPG paginates responses. A 'Send to admin team' button emails the full conversation via Fastmail JMAP with an 'Implement immediately' CTA that routes to Sandbox staging.",
    usage: "Add as the final dashboard tile. Tile has transparent background with dashed pink border. Modal has three phases: form (name + description), chat (Claude conversation with GPG), sent (confirmation). The API route handles both Claude chat and email sending via action parameter.",
    code: `// Tile (in dashboard page.tsx tiles array)\n{ key: "Suggest", title: "Suggest", subtitle: "Feature ideas",\n  glow: "pink", icon: <span>💡</span>,\n  onClick: () => setSuggestionOpen(true) }\n\n// SuggestTile styled-component handles dashed border\nconst SuggestTile = styled(DashTile)\`\n  background: transparent;\n  border: 2px dashed rgba(\${rgb.pink}, 0.4);\n\`;\n\n// Modal import\nimport SuggestionBoxModal from "./suggestion/SuggestionBoxModal";\n{suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}`,
    stylePath: "src/app/components/suggestion/SuggestionBoxModal.tsx",
    Demo: SuggestionBoxDemo,
  },
  {
    key: "TPG",
    name: "Table Pagination Group",
    category: "Navigation",
    summary: "Full pagination bar: page info (left), controls (right) = reset + page-size selector + prev/next. Used for grid/table views on tablet+. Two modes: standalone (fixed sizes 5/10/25/50) or inside ACR (column-count multiples).",
    usage: "Place below a table/grid. Show reset button only when custom page size is active. `TpgBtn` is 5×10 padding, radius 8. Dropdown options reflect mode.",
    code: `<TpgRow>
  <TpgInfo>Page {page} of {total} · {count} results</TpgInfo>
  <TpgControls>
    {custom && <ResetBtn onClick={resetSize}>↺</ResetBtn>}
    <TpgSelect value={size} onChange={setSize}>
      {sizes.map(n => <option key={n}>{n}</option>)}
    </TpgSelect>
    <TpgBtn onClick={prev} disabled={page === 1}>‹</TpgBtn>
    <TpgBtn onClick={next} disabled={page === total}>›</TpgBtn>
  </TpgControls>
</TpgRow>`,
    stylePath: "src/app/dashboard/page.tsx",
    Demo: TPGDemo,
  },

  // ── Toggles ───────────────────────────────────────────────────────────
  {
    key: "ECL",
    name: "Expand-Collapse Lightswitch",
    category: "Toggles",
    summary: "A single Lightswitch per component that toggles whether the component's interactive controls are visible (off = controls hidden; label, row, and ECL itself stay visible). Side-label reads 'Collapse' when expanded, 'Expand' when collapsed — immediately left of the switch.",
    usage: "Exactly one ECL per component. On an SRT it hides slider+reset+input. Controlled (`expanded` + `onExpandedChange`) or uncontrolled.",
    code: `<Row>
  <Label>{name}</Label>
  {expanded && <Slider {...} />}
  <CollapseLabel>{expanded ? "Collapse" : "Expand"}</CollapseLabel>
  <Lightswitch on={expanded} onChange={setExpanded} />
</Row>`,
    stylePath: "src/app/components/LDM.tsx",
    Demo: ECLDemo,
  },
  {
    key: "Eyeball",
    name: "Eyeball",
    category: "Toggles",
    summary: "22×22 cyan square button with inline eye / eye-off SVG (open eyeball when visible, slashed eyeball when hidden). Toggles whether a component **renders on the page** (show/hide). Replaces the Lightswitch for visibility specifically — Lightswitch is reserved for expand/collapse and on/off state. SVG matches the TGV editor accordion toggle on the editor taskbar; never use emoji.",
    usage: "Open eyeball = visible, slashed eyeball = hidden. 4px radius, cyan when visible, dim gray when hidden. Always inline SVG — never emoji.",
    code: `<EyeBtn visible={visible} onClick={() => setVisible(v => !v)}>
  {visible ? <EyeballOpenSvg /> : <EyeballClosedSvg />}
</EyeBtn>`,
    style: "const EyeBtn = styled.button<{ $visible: boolean }>`\nwidth: 22px; height: 22px;\nborder-radius: 4px;\nborder: 1px solid rgba(${rgb.cyan}, 0.4);\nbackground: ${(p) => p.$visible ? `rgba(${rgb.cyan}, 0.12)` : \"rgba(255,255,255,0.04)\"};\ncolor: ${(p) => p.$visible ? colors.cyan : \"rgba(255,255,255,0.3)\"};\nfont-size: 12px;\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: EyeIconDemo,
  },
  {
    key: "LDM",
    name: "Light-Dark Mode Toggle",
    category: "Toggles",
    summary: "Moon/sun icon button that toggles between dark (default) and light themes. On first switch to light, a popup explains dark mode uses less power and is better for the environment, with 'Stay dark', 'Switch anyway', and 'Do not show again' options. Persists choice to localStorage. Theme applied via data-theme attribute on <html>.",
    usage: "Place in the top nav bar next to user controls. Wrap the app with ThemeProvider. Add [data-theme=\"light\"] CSS overrides in globals.css. The accentColor prop lets each project set its own brand accent. Size prop controls the icon button dimensions.",
    code: `// ThemeProvider wraps the app
import ThemeProvider from "./ThemeProvider";
<ThemeProvider>{children}</ThemeProvider>

// LDM in the nav
import LDM from "./LDM";
<LDM size={28} accentColor="#ff4ecb" />

// CSS: [data-theme="light"] body { background: #f8f6f3; color: #1a1a2e; }
// [data-theme="light"] .nav-tgv { ... }`,
    style: "const LDMBtn = styled.button`\nwidth: var(--ldm-size, 28px);\nheight: var(--ldm-size, 28px);\nborder-radius: 50%;\nborder: 1px solid var(--t-border);\nbackground: var(--t-inputBg);\ncolor: var(--t-textMuted);\nfont-size: calc(var(--ldm-size, 28px) * 0.5);\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\ntransition: all 0.2s;\n&:hover {\nborder-color: var(--t-borderStrong);\ncolor: var(--t-text);\n}\n`;\n\nconst Popup = styled.div`\nposition: fixed;\ntop: 50%; left: 50%;\ntransform: translate(-50%, -50%);\nz-index: 9999;\npadding: 1.5rem;\nborder-radius: 1rem;\nbackground: var(--t-surface);\nborder: 1px solid var(--t-border);\nbox-shadow: 0 24px 80px rgba(0,0,0,0.4);\nmax-width: 320px;\ntext-align: center;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: LDMDemo,
  },
  {
    key: "Lightswitch",
    name: "Lightswitch",
    category: "Toggles",
    summary: "The 3D circle-on-a-stick toggle for collapse/expand and on/off semantics. Glows when on, dims when off, greyed when there's no content to toggle. Use for collapse/expand, on/off, mobile-preview switchers, batch-collapse in TSG.",
    usage: "Do NOT use for show/hide visibility — that's the Eye Icon Toggle. Keep the semantic split clean.",
    code: `<Lightswitch
  on={expanded}
  onChange={setExpanded}
  disabled={!hasContent}
/>`,
    style: "const Track = styled.div<{ $on: boolean; $glow: GlowColor }>`\nwidth: 32px; height: 18px;\nborder-radius: 999px;\nbackground: ${(p) => p.$on ? `rgba(${rgb[p.$glow]}, 0.35)` : \"rgba(255,255,255,0.08)\"};\nborder: 1px solid ${(p) => p.$on ? `rgba(${rgb[p.$glow]}, 0.6)` : \"rgba(255,255,255,0.15)\"};\nposition: relative;\ncursor: pointer;\ntransition: all 0.2s;\n`;\n\nconst Thumb = styled.div<{ $on: boolean; $glow: GlowColor }>`\nwidth: 12px; height: 12px;\nborder-radius: 50%;\nposition: absolute;\ntop: 2px;\nleft: ${(p) => p.$on ? \"17px\" : \"2px\"};\nbackground: ${(p) => p.$on ? colors[p.$glow] : \"rgba(255,255,255,0.4)\"};\nbox-shadow: ${(p) => p.$on ? `0 0 8px ${colors[p.$glow]}` : \"none\"};\ntransition: all 0.2s;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: LightswitchDemo,
  },
  {
    key: "RRT",
    name: "Read Receipt Tag",
    category: "Toggles",
    summary: "Small neon-accent pill (canonical copy \"NEW\") that hugs the right side of a list-row title to flag a freshly-added entry. Dismisses on intentional click — the same gesture that opens the row — not on hover, focus, or scroll. Seen-keys persist per browser via localStorage; first visit seeds the baseline so brand-new users don't see NEW flashing on every item.",
    usage: "Use wherever a list surfaces a new item inside an otherwise-familiar set (sandbox entries, inbox folders, preset galleries). Copy is always one uppercase word (NEW, UPDATED, BETA). The row's onClick must call markSeen(key) before opening the entry. Match the pill's accent to the enclosing drawer/surface.",
    code: `// One storage key per scope — bump the version only if you want everyone to re-see.
const SEEN_STORAGE = "sandbox-seen-keys-v1";

function useNewKeys(currentKeys: string[]) {
  const [newKeys, setNewKeys] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEEN_STORAGE);
      if (raw === null) {
        // First-ever visit — seed so no NEW flashes today.
        localStorage.setItem(SEEN_STORAGE, JSON.stringify(currentKeys));
        return;
      }
      const seen: Set<string> = new Set(JSON.parse(raw));
      const news = new Set<string>();
      for (const k of currentKeys) if (!seen.has(k)) news.add(k);
      setNewKeys(news);
    } catch { /* ignore */ }
  }, []);

  const markSeen = useCallback((key: string) => {
    setNewKeys(prev => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev); next.delete(key);
      try {
        const raw = localStorage.getItem(SEEN_STORAGE);
        const seen: Set<string> = new Set(raw ? JSON.parse(raw) : []);
        seen.add(key);
        localStorage.setItem(SEEN_STORAGE, JSON.stringify([...seen]));
      } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { newKeys, markSeen };
}

<Row onClick={() => { if (isNew) onSeen(entry.key); onOpen(); }}>
  <Label>{entry.name}</Label>
  {isNew && <NewTag aria-label="New entry">NEW</NewTag>}
</Row>`,
    style: `const NewTag = styled.span\`
  margin-left: auto;
  flex-shrink: 0;
  padding: 0.1rem 0.35rem;
  font-size: 0.5rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-family: var(--font-geist-sans, system-ui), sans-serif;
  color: \${PINK};
  background: rgba(\${PINK_RGB}, 0.15);
  border: 1px solid rgba(\${PINK_RGB}, 0.6);
  border-radius: 999px;
  text-shadow: 0 0 4px rgba(\${PINK_RGB}, 0.85);
  box-shadow:
    0 0 6px rgba(\${PINK_RGB}, 0.5),
    inset 0 0 4px rgba(\${PINK_RGB}, 0.25);

  [data-theme="light"] & {
    background: rgba(\${PINK_RGB}, 0.12);
    text-shadow: none;
    box-shadow: 0 0 4px rgba(\${PINK_RGB}, 0.4);
  }
\`;`,
    stylePath: "src/app/components/sandbox/SandboxModal.tsx",
    Demo: RRTDemo,
  },
];

export const CATEGORIES: Array<SandboxEntry["category"]> = ["Buttons", "Icons", "Menus", "Navigation", "Toggles"];
