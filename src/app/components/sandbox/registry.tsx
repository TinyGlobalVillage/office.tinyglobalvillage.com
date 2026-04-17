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
  category: "Navigation" | "Toggles" | "Menus" | "Editor Controls";
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

// ── Eye Icon demo ───────────────────────────────────────────────────────
function EyeBtn({ visible, onChange, highlighted }: { visible: boolean; onChange: (v: boolean) => void; highlighted?: boolean }) {
  return (
    <EyeBtnStyled onClick={() => onChange(!visible)} $visible={visible} $highlighted={highlighted}>
      {visible ? "👁" : "⊘"}
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

// ── Registry ────────────────────────────────────────────────────────────
export const REGISTRY: SandboxEntry[] = [
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
    key: "EyeIcon",
    name: "Eye Icon Toggle",
    category: "Toggles",
    summary: "22×22 cyan square button with IconEye/IconEyeOff. Toggles whether a component **renders on the page** (show/hide). Replaces the Lightswitch for visibility specifically — Lightswitch is reserved for expand/collapse and on/off state.",
    usage: "Whole eyeball = visible, crossed-out eyeball = hidden. 4px radius, cyan when visible, dim gray when hidden.",
    code: `<EyeBtn visible={visible} onClick={() => setVisible(v => !v)}>
  {visible ? <IconEye /> : <IconEyeOff />}
</EyeBtn>`,
    style: "const EyeBtn = styled.button<{ $visible: boolean }>`\nwidth: 22px; height: 22px;\nborder-radius: 4px;\nborder: 1px solid rgba(${rgb.cyan}, 0.4);\nbackground: ${(p) => p.$visible ? `rgba(${rgb.cyan}, 0.12)` : \"rgba(255,255,255,0.04)\"};\ncolor: ${(p) => p.$visible ? colors.cyan : \"rgba(255,255,255,0.3)\"};\nfont-size: 12px;\ncursor: pointer;\ndisplay: flex;\nalign-items: center;\njustify-content: center;\n`;",
    stylePath: "src/app/components/LDM.tsx",
    Demo: EyeIconDemo,
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
    key: "SRT",
    name: "Sliding Resize Toggle",
    category: "Editor Controls",
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
    key: "ResetButton",
    name: "Reset Button",
    category: "Editor Controls",
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
    key: "TSG",
    name: "Tab Switch Group",
    category: "Editor Controls",
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
    key: "SB",
    name: "SuggestionBox",
    category: "Navigation",
    summary: "Dashed-border dashboard tile that opens a feature-request modal. Users describe an idea, Claude AI generates a structured implementation plan, GPG paginates responses. A 'Send to admin team' button emails the full conversation via Fastmail JMAP with an 'Implement immediately' CTA that routes to Sandbox staging.",
    usage: "Add as the final dashboard tile. Tile has transparent background with dashed pink border. Modal has three phases: form (name + description), chat (Claude conversation with GPG), sent (confirmation). The API route handles both Claude chat and email sending via action parameter.",
    code: `// Tile (in dashboard page.tsx tiles array)\n{ key: "Suggest", title: "Suggest", subtitle: "Feature ideas",\n  glow: "pink", icon: <span>💡</span>,\n  onClick: () => setSuggestionOpen(true) }\n\n// SuggestTile styled-component handles dashed border\nconst SuggestTile = styled(DashTile)\`\n  background: transparent;\n  border: 2px dashed rgba(\${rgb.pink}, 0.4);\n\`;\n\n// Modal import\nimport SuggestionBoxModal from "./suggestion/SuggestionBoxModal";\n{suggestionOpen && <SuggestionBoxModal onClose={() => setSuggestionOpen(false)} />}`,
    stylePath: "src/app/components/suggestion/SuggestionBoxModal.tsx",
    Demo: SuggestionBoxDemo,
  },
];

export const CATEGORIES: Array<SandboxEntry["category"]> = ["Navigation", "Toggles", "Menus", "Editor Controls"];
