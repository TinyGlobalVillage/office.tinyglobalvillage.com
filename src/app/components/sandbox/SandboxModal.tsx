"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styled, { css } from "styled-components";
import { colors, rgb } from "../../theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelSidebar,
  PanelSidebarItem,
  Spacer,
} from "../../styled";
import SandboxIcon from "./SandboxIcon";
import { REGISTRY, CATEGORIES, type SandboxEntry } from "./registry";
import { useDraftStore } from "./useDraftStore";
import SandboxEditToolbar from "./SandboxEditToolbar";
import SandboxClaudeDrawer from "./SandboxClaudeDrawer";
import Tooltip from "../ui/Tooltip";

const TT_ACCENT = "#ff4ecb";

const PINK = colors.pink;
const PINK_RGB = rgb.pink;
const GOLD = colors.gold;
const GOLD_RGB = rgb.gold;

// Sandbox-themed scrollbar (pink accent). Dark = default; light mode swaps the
// track to sit on a lighter surface. Apply via `${sandboxScrollbar}` on any
// styled component whose content scrolls inside the Sandbox modal/popout.
const sandboxScrollbar = css`
  scrollbar-width: thin;
  scrollbar-color: rgba(${PINK_RGB}, 0.35) transparent;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(${PINK_RGB}, 0.28);
    border: 2px solid transparent;
    background-clip: padding-box;
    border-radius: 999px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: rgba(${PINK_RGB}, 0.5);
    background-clip: padding-box;
    border: 2px solid transparent;
  }
  &::-webkit-scrollbar-corner {
    background: transparent;
  }

  [data-theme="light"] & {
    scrollbar-color: rgba(${PINK_RGB}, 0.55) rgba(0, 0, 0, 0.04);

    &::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.04);
    }
    &::-webkit-scrollbar-thumb {
      background: rgba(${PINK_RGB}, 0.55);
      background-clip: padding-box;
    }
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(${PINK_RGB}, 0.75);
      background-clip: padding-box;
    }
  }
`;

// ── Styled ───────────────────────────────────────────────────────

const Backdrop = styled(PanelBackdrop)``;

const SandboxCtrlBtn = styled(PanelIconBtn)`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  background: rgba(${rgb.pink}, 0.14);
  border: 1px solid rgba(${rgb.pink}, 0.45);
  color: ${colors.pink};
  text-shadow: 0 0 6px rgba(${rgb.pink}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.pink}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.pink}, 0.5);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & { text-shadow: none; }
`;

const Modal = styled(Panel)<{ $edit?: boolean }>`
  border-color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.32);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.85),
    0 0 32px rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.12);
`;

// All padding lives on the columns so the column divider (HeaderLeft's
// border-right) sits at x = sidebar.width inside the Modal — exactly where
// the FileSidebar's right edge sits in the Body row. That lets the same
// 1px line run the full height of the left column.
const Header = styled(PanelHeader)<{ $edit?: boolean }>`
  gap: 0;
  padding: 0;
  border-bottom-color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.18);
`;

// Left section — title cluster + right-justified ECL. The column divider
// itself now lives in the sibling <Rsd> element (see below) so it can align
// with the DTog's OUTSIDE hairline (x = sidebar.width + 7) instead of its
// inside edge. padding-right = 21px here mirrors the inset AdlHeader creates
// inside FileSidebar (8px FileSidebar pad + 12px AdlHeader pad + 1px border),
// so the ECL sits in the same vertical line as every ADL mini-switch below.
// align-self: stretch overrides PanelHeader's align-items: center so the
// column spans the full Header height edge-to-edge.
const HeaderLeft = styled.div<{ $w: number; $edit?: boolean }>`
  flex-shrink: 0;
  align-self: stretch;
  width: ${(p) => p.$w}px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: ${(p) => (p.$w === 0 ? "0" : "0.75rem 21px 0.75rem 1.25rem")};
  overflow: hidden;
  box-sizing: border-box;
  /* Only animate width on snap-collapse (w → 0). During active drag, width
     follows the pointer instantly so the Rsd + DTog stay 1:1 with the
     cursor — matches FileSidebar's behaviour below. */
  transition: ${(p) => (p.$w === 0 ? "width 0.2s" : "none")};
`;

// RSD — Row Section Divider. 1px neon-tinted vertical line separating the
// Header's two columns. Sits as a flex item between HeaderLeft and
// HeaderRight with margin-left: 7px so its x-position lands on the DTog's
// OUTSIDE hairline (sidebar.width + 7), keeping the vertical line continuous
// from Header through the Body split. flex-basis: 1px + align-self: stretch
// guarantees a 1px-wide, full-height rail. See ~/.claude/vocabulary/RSD.md.
const Rsd = styled.div<{ $edit?: boolean }>`
  flex: 0 0 1px;
  align-self: stretch;
  margin-left: 7px;
  background: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.35);

  [data-theme="light"] & {
    background: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.22);
  }
`;

// Right section — drawer-control toolbar. Padding-left holds the content
// off the column divider; padding-right replaces the Header's old right
// padding so the right controls still have breathing room.
// The `sandboxhdr` container query lives here (not on Header) so the
// control-collapse thresholds respond to HeaderRight's *actual* width —
// meaning dragging the Files DTog (which narrows HeaderRight even if the
// window stays the same size) triggers the same collapse as shrinking
// the window. Pure window-resize still works because HeaderRight is
// flex:1 and scales with Header.
const HeaderRight = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem 0.75rem 1rem;
  container-type: inline-size;
  container-name: sandboxhdr;
`;

const Title = styled.h2<{ $edit?: boolean }>`
  font-size: 0.875rem;
  font-weight: 700;
  margin: 0;
  color: ${(p) => (p.$edit ? GOLD : PINK)};
`;

// Sum-total of every sandbox entry, displayed just left of the header ECL.
// Same visual language as AdlCount next to each category label in the file
// list — small, low-alpha accent text, no glow — so the header reads as the
// "all groups" row and each ADL below reads as its own category row.
const HeaderTotal = styled.span<{ $edit?: boolean }>`
  margin-left: auto;
  font-size: 0.6rem;
  font-weight: 600;
  color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.55);

  [data-theme="light"] & {
    color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.7);
  }
`;

const CollapseAllBtn = styled.button<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.7)` : "rgba(255,255,255,0.2)")};
  background: ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.2)` : "rgba(255,255,255,0.05)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${PINK_RGB}, 0.45)` : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
  cursor: pointer;
  padding: 0;
`;

const CollapseAllThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "13px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? PINK : "rgba(255,255,255,0.35)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${PINK_RGB}, 0.85), 0 0 2px rgba(${PINK_RGB}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

// ToggleBtn — SVG icon always renders in the accent color ($color or pink),
// so the glyph "glows" regardless of state. Button chrome (bg/border) stays
// grey until $active = true, at which point it lights up with the full accent
// treatment. Text label is present but hidden via container query when the
// Header is too narrow to fit labels next to the drawer controls.
const ToggleBtn = styled.button<{ $active?: boolean; $color?: string }>`
  height: 2.125rem;
  padding: 0 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border-radius: 0.5rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  background: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.14)` : "rgba(255,255,255,0.04)")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.45)` : "rgba(255,255,255,0.15)")};
  color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "rgba(255,255,255,0.55)")};

  /* SVG glyph carries the neon hue at all times. */
  > svg {
    color: ${(p) => (p.$color ? `rgb(${p.$color})` : PINK)};
    filter: drop-shadow(0 0 4px rgba(${(p) => p.$color || PINK_RGB}, 0.55));
    flex-shrink: 0;
  }

  [data-theme="light"] & {
    background: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.1)` : "var(--t-inputBg)")};
    border-color: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.35)` : "var(--t-border)")};
    color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "var(--t-textMuted)")};

    > svg { filter: none; }
  }

  /* Labels stay visible while HeaderRight has breathing room; collapse to
     icon-only once the controls' own available width gets tight. Threshold
     calibrated against HeaderRight's inline-size (not the modal's) so this
     fires both on window-shrink AND on Files-DTog drag. */
  @container sandboxhdr (max-width: 540px) {
    padding: 0 0.55rem;
    gap: 0;
    > .label { display: none; }
  }
`;

const BtnLabel = styled.span.attrs({ className: "label" })``;

// Mobile-only DDM for the drawer controls. Below the mobile breakpoint the
// Edit/Files/Code + popout/fullscreen buttons collapse into this single
// hamburger menu. The X stays outside the DDM, as a sibling, always
// reachable. Above mobile, all icons remain individually visible.
// Threshold calibrated against HeaderRight's width (not the modal's) so
// both window-shrink AND Files-DTog drag collapse into the DDM identically.
const WideControls = styled.div`
  display: contents;

  @container sandboxhdr (max-width: 320px) {
    display: none;
  }
`;

const NarrowControls = styled.div`
  display: none;

  @container sandboxhdr (max-width: 320px) {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }
`;

const MenuDdmWrap = styled.div`
  position: relative;
`;

const MenuDdmPanel = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 80;
  min-width: 220px;
  background: rgba(8, 10, 16, 0.98);
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
`;

const MenuDdmItem = styled.button<{ $active?: boolean; $color?: string }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.55rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: ${(p) => (p.$active ? `rgba(${p.$color || PINK_RGB}, 0.12)` : "transparent")};
  border: none;
  cursor: pointer;
  color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "rgba(255,255,255,0.75)")};

  > svg {
    color: ${(p) => (p.$color ? `rgb(${p.$color})` : PINK)};
    filter: drop-shadow(0 0 4px rgba(${(p) => p.$color || PINK_RGB}, 0.45));
    flex-shrink: 0;
  }

  &:hover {
    background: rgba(${(p) => p.$color || PINK_RGB}, 0.14);
    color: ${(p) => (p.$color ? `rgb(${p.$color})` : PINK)};
  }

  [data-theme="light"] & {
    color: ${(p) => (p.$active ? (p.$color ? `rgb(${p.$color})` : PINK) : "var(--t-textMuted)")};
    > svg { filter: none; }
  }
`;

const DraftTrigger = styled.button`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(${GOLD_RGB}, 0.08);
  border: 1px solid rgba(${GOLD_RGB}, 0.3);
  color: ${GOLD};
  cursor: pointer;

  [data-theme="light"] & {
    background: rgba(${GOLD_RGB}, 0.05);
    border-color: rgba(${GOLD_RGB}, 0.2);
  }
`;

const DraftPanel = styled.div`
  position: absolute;
  left: 0;
  top: 100%;
  margin-top: 0.5rem;
  border-radius: 0.75rem;
  overflow: hidden;
  z-index: 80;
  min-width: 240px;
  background: rgba(8, 10, 16, 0.98);
  border: 1px solid rgba(${GOLD_RGB}, 0.3);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
`;

const DraftSearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-bottom: 1px solid var(--t-border);
`;

const DraftSearchInput = styled.input`
  flex: 1;
  background: var(--t-inputBg);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  border: none;

  &::placeholder { color: var(--t-textGhost); }
`;

const DraftSortBtn = styled.button`
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  background: rgba(${rgb.cyan}, 0.08);
  border: 1px solid rgba(${rgb.cyan}, 0.3);
  color: ${colors.cyan};
  cursor: pointer;
`;

const DraftList = styled.div`
  max-height: 256px;
  overflow-y: auto;
  ${sandboxScrollbar}
`;

const DraftItem = styled.div`
  display: flex;
  align-items: center;

  &:hover {
    background: var(--t-inputBg);
  }
`;

const DraftItemBtn = styled.button`
  flex: 1;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  background: none;
  border: none;
  cursor: pointer;
`;

const DraftItemDel = styled.button`
  padding: 0.5rem;
  font-size: 0.75rem;
  background: none;
  border: none;
  color: var(--t-textGhost);
  cursor: pointer;

  &:hover { color: #f87171; }
`;

const LiveBtn = styled.button`
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-textMuted);
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover { background: var(--t-inputBg); }
`;

const LiveDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
`;

const Body = styled.div`
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
`;

const Blackout = styled.div`
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.25rem;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(2px);
  animation: boIn 0.2s ease-out;

  @keyframes boIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

const BlackoutMsg = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
`;

const BlackoutSub = styled.p`
  margin: 0;
  font-size: 0.6875rem;
  color: rgba(${PINK_RGB}, 0.7);
  text-align: center;
  max-width: 28ch;
  line-height: 1.4;

  [data-theme="light"] & {
    color: rgba(${PINK_RGB}, 0.85);
  }
`;

const BlackoutCloseBtn = styled.button`
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  background: rgba(${PINK_RGB}, 0.12);
  border: 1px solid rgba(${PINK_RGB}, 0.45);
  color: ${PINK};
  text-shadow: 0 0 6px rgba(${PINK_RGB}, 0.5);
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${PINK_RGB}, 0.22);
    box-shadow: 0 0 12px rgba(${PINK_RGB}, 0.4);
  }
`;

function ReturnToMainGlyph() {
  return (
    <svg
      viewBox="0 0 20 20"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="8" y="5" width="10" height="10" rx="1" />
      <path d="M2 10 L11 10" />
      <path d="M6 6 L2 10 L6 14" />
    </svg>
  );
}

// Explicitly clear PanelSidebar's inherited border-right — the DTog
// (ResizeHandle) below owns both edge hairlines of the column divider;
// HeaderLeft's border-right above lines up with the DTog's LEFT hairline
// for visual continuity top-to-bottom. Without this override we got a
// doubled line AND a 1px math-offset that broke ECL/ADL-switch alignment.
const FileSidebar = styled(PanelSidebar)<{ $w: number }>`
  width: ${(p) => p.$w}px;
  flex-shrink: 0;
  padding: 0.75rem 0.5rem;
  border-right: none;
  box-sizing: border-box;
  transition: ${(p) => (p.$w === 0 ? "width 0.2s" : "none")};
  overflow: ${(p) => (p.$w < 80 ? "hidden" : "auto")};
  ${sandboxScrollbar}
`;

// DTog grip — 3 stacked horizontal bars bracketed by up/down neon triangles.
// SVG uses currentColor so the parent (ResizeHandle) drives hue + mode.
// Folder (Files toggle). Outline style — stroke uses currentColor so parent
// styled-component drives hue in both dark and light modes.
function FolderIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 7.5A1.5 1.5 0 014.5 6H9l2 2h8.5A1.5 1.5 0 0121 9.5V17a2 2 0 01-2 2H5a2 2 0 01-2-2V7.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Code brackets (Code toggle) — `</>` in outline SVG form.
function CodeBracketsIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 7l-5 5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 7l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 5l-4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Hamburger/menu icon for the narrow-screen DDM trigger.
function MenuIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

// Pencil (Edit toggle).
function PencilIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20l4-1L20 7l-3-3L5 16l-1 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function DTogGrip() {
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

// Expand icon for a collapsed panel tab — 3 bars (top/short/short/bottom)
// plus a neon arrow pointing INTO the panel that would re-open.
function ExpandIcon({ side }: { side: "left" | "right" }) {
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

// DTog — Drag Toggle on the center of a column divider. CLOSED RECTANGLE:
// four hairlines (top/right/bottom/left) forming a full rail with a neon
// SVG grip dead-center between them. The LEFT hairline is the inside edge
// (closer to the preceding content); the RIGHT hairline is the OUTSIDE edge
// that any paired RSD above/beside the DTog must align with — see
// ~/.claude/vocabulary/DTog.md and ~/.claude/vocabulary/RSD.md.
//
// When the DTog is paired with an RSD ($pairedSide = "left" | "right"), the
// hairline on that side MUST inherit the RSD's accent color instead of the
// neutral --t-border — so the RSD's pink/gold line flows continuously into
// the DTog's outside edge, top to bottom. The other three hairlines stay
// neutral until hover/drag, where they all light up with the accent together.
//
// On hover/drag the entire rectangle glows (full-perimeter neon box-shadow).
const ResizeHandle = styled.div<{
  $dragging?: boolean;
  $edit?: boolean;
  $pairedSide?: "left" | "right";
}>`
  width: 8px;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  z-index: 5;
  box-sizing: border-box;
  border: 1px solid var(--t-border);
  background: ${(p) => (p.$dragging ? `rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.2)` : "transparent")};
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;

  ${(p) =>
    p.$pairedSide &&
    css`
      border-${p.$pairedSide}-color: rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.35);
      [data-theme="light"] & {
        border-${p.$pairedSide}-color: rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.22);
      }
    `}

  > svg {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.75);
    opacity: 0.8;
    transition: opacity 0.15s, filter 0.15s, color 0.15s;
    pointer-events: none;
    z-index: 1;
  }

  [data-theme="light"] & > svg {
    color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.9);
  }

  &:hover {
    background: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.1);
    border-color: rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.4);
    box-shadow:
      0 0 10px rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.35),
      inset 0 0 6px rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.18);
    > svg {
      opacity: 1;
      color: ${(p) => (p.$edit ? GOLD : PINK)};
      filter: drop-shadow(0 0 3px rgba(${(p) => (p.$edit ? GOLD_RGB : PINK_RGB)}, 0.55));
    }
  }

  ${(p) =>
    p.$dragging &&
    css`
      border-color: rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.6);
      box-shadow:
        0 0 14px rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.5),
        inset 0 0 8px rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.25);
      > svg {
        opacity: 1;
        color: ${p.$edit ? GOLD : PINK};
        filter: drop-shadow(0 0 4px rgba(${p.$edit ? GOLD_RGB : PINK_RGB}, 0.75));
      }
    `}
`;

const DrawerTab = styled.button<{ $side: "left" | "right" }>`
  position: absolute;
  top: 50%;
  ${(p) => p.$side}: 0;
  transform: translateY(-50%);
  z-index: 10;
  width: 20px;
  height: 48px;
  border-radius: ${(p) => (p.$side === "left" ? "0 6px 6px 0" : "6px 0 0 6px")};
  background: rgba(${PINK_RGB}, 0.08);
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  border-${(p) => p.$side}: none;
  color: ${PINK};
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover {
    background: rgba(${PINK_RGB}, 0.18);
  }
`;

const FileGroup = styled.div`
  margin-bottom: 0.75rem;
`;

// ADL — Accordion Dropdown with Lightswitch.
// Uniform rule: every ADL header is the same height and spans the full parent
// container width regardless of title length. box-sizing: border-box so width
// 100% + padding/border collapses to the parent's exact width. Right padding
// is bumped so the mini-switch sits in the same vertical line as the header
// row's ECL (CollapseAllBtn) — ~21px clear of the column divider.
const AdlHeader = styled.button<{ $open: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  box-sizing: border-box;
  min-height: 1.85rem;
  padding: 0.3rem 0.75rem 0.3rem 0.5rem;
  margin: 0 0 0.35rem;
  background: ${(p) => (p.$open ? `rgba(${PINK_RGB}, 0.06)` : "transparent")};
  border: 1px solid ${(p) => (p.$open ? `rgba(${PINK_RGB}, 0.22)` : "rgba(255,255,255,0.08)")};
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: ${(p) => (p.$open ? PINK : `rgba(${PINK_RGB}, 0.65)`)};
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  &:hover {
    background: rgba(${PINK_RGB}, 0.1);
    border-color: rgba(${PINK_RGB}, 0.35);
    color: ${PINK};
  }

  [data-theme="light"] & {
    color: ${(p) => (p.$open ? PINK : `rgba(${PINK_RGB}, 0.75)`)};
  }
`;

const AdlLabel = styled.span`
  flex: 1;
`;

const AdlCount = styled.span`
  font-size: 0.6rem;
  color: rgba(${PINK_RGB}, 0.55);
  font-weight: 600;
`;

const AdlSwitchTrack = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.7)` : "rgba(255,255,255,0.2)")};
  background: ${(p) => (p.$on ? `rgba(${PINK_RGB}, 0.2)` : "rgba(255,255,255,0.05)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${PINK_RGB}, 0.45)` : "none")};
  transition: all 0.18s;
  flex-shrink: 0;
`;

const AdlSwitchThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 1px;
  left: ${(p) => (p.$on ? "15px" : "1px")};
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${(p) => (p.$on ? PINK : "rgba(255,255,255,0.35)")};
  box-shadow: ${(p) =>
    p.$on
      ? `0 0 8px rgba(${PINK_RGB}, 0.85), 0 0 2px rgba(${PINK_RGB}, 1)`
      : "0 1px 2px rgba(0,0,0,0.3)"};
  transition: all 0.18s;
`;

const AdlBody = styled.div<{ $open: boolean }>`
  display: ${(p) => (p.$open ? "block" : "none")};
`;

const FileItem = styled(PanelSidebarItem).attrs({ $accent: "pink" })`
  font-family: var(--font-geist-mono), monospace;
`;

const FileItemLabel = styled.span`
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  font-weight: 700;
`;

// "NEW" pill that hugs the right of a file-list row the first time a user
// sees a freshly-added sandbox entry. Pink neon — bright border + text
// shadow + box-shadow so it reads as an alert, not a subdued label. The
// row's IntersectionObserver (see FileEntry) fires once when the tag is
// visible in the sidebar scroll viewport and marks the key as seen, so
// the tag disappears permanently for that user on subsequent renders.
const NewTag = styled.span`
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
  transition: opacity 0.4s ease;

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.12);
    text-shadow: none;
    box-shadow: 0 0 4px rgba(${PINK_RGB}, 0.4);
  }
`;

const FileItemSub = styled.span<{ $active?: boolean }>`
  font-size: 0.625rem;
  color: ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.85)` : `rgba(${PINK_RGB}, 0.55)`)};
  white-space: nowrap;

  [data-theme="light"] & {
    color: ${(p) => (p.$active ? PINK : `rgba(${PINK_RGB}, 0.75)`)};
  }
`;

const CenterPane = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const SummaryBar = styled.div`
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
  background: rgba(${PINK_RGB}, 0.03);

  [data-theme="light"] & {
    background: rgba(${PINK_RGB}, 0.02);
  }
`;

const SummaryToggle = styled.button`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.25rem;
  padding: 0.5rem 1.25rem;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
`;

const SummaryTopRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const SummaryKeyRow = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const SummaryLabel = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${PINK};
  flex-shrink: 0;
`;

const SummaryKey = styled.span`
  font-size: 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  color: var(--t-text);
  opacity: 0.85;
  overflow-wrap: anywhere;
  min-width: 0;
`;

const SummaryKeyAcronym = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${PINK};
  margin-right: 0.4rem;
`;

const SummaryBody = styled.div`
  padding: 0 1.25rem 1rem;
  max-width: 56rem;
`;

const SummaryText = styled.p`
  font-size: 0.75rem;
  color: var(--t-text);
  opacity: 0.75;
  line-height: 1.6;
  margin: 0 0 0.5rem;
`;

const UsageLabel = styled.span`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${PINK};
  margin-right: 0.5rem;
`;

const UsageText = styled.span`
  font-size: 0.6875rem;
  color: rgba(${PINK_RGB}, 0.75);
  line-height: 1.6;

  [data-theme="light"] & {
    color: rgba(${PINK_RGB}, 0.9);
  }
`;

const Viewport = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.25);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const DemoArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: 2rem;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  ${sandboxScrollbar}

  [data-theme="light"] & {
    background: #1a1028;
    border-radius: 0.75rem;
    margin: 0.5rem;
  }
`;

const DemoWrap = styled.div`
  width: 100%;
  max-width: 42rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
`;

const ClaudeWrap = styled.div`
  flex-shrink: 0;
`;

const EmptyCenter = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(${PINK_RGB}, 0.7);
  font-size: 0.875rem;

  [data-theme="light"] & {
    color: rgba(${PINK_RGB}, 0.85);
  }
`;

const CodePane = styled.div<{ $w: number }>`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  width: ${(p) => p.$w}px;
  overflow: hidden;
  transition: ${(p) => (p.$w === 0 ? "width 0.2s" : "none")};
  background: rgba(4, 6, 10, 0.7);

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  flex-shrink: 0;
  border-bottom: 1px solid var(--t-border);
`;

const CodeLabel = styled.span<{ $edit?: boolean }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => (p.$edit ? GOLD : PINK)};
`;

const CodeTag = styled.span`
  font-size: 0.5625rem;
  font-family: var(--font-geist-mono), monospace;
  color: rgba(${PINK_RGB}, 0.7);

  [data-theme="light"] & {
    color: rgba(${PINK_RGB}, 0.85);
  }
`;

const CodeEditorWrap = styled.div`
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const CodeEditor = styled.textarea`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  padding: 0.75rem;
  resize: none;
  color: var(--t-text);
  opacity: 0.85;
  line-height: 1.55;
  border: none;
  ${sandboxScrollbar}
`;

const SearchBar = styled.div`
  position: absolute;
  top: 4px;
  right: 16px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(8, 10, 16, 0.96);
  border: 1px solid rgba(${PINK_RGB}, 0.35);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
`;

const SearchInput = styled.input`
  width: 180px;
  padding: 3px 6px;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(${PINK_RGB}, 0.2);
  color: var(--t-text);
  outline: none;

  &:focus {
    border-color: rgba(${PINK_RGB}, 0.5);
  }

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: var(--t-border);
    &:focus { border-color: rgba(${PINK_RGB}, 0.4); }
  }
`;

const SearchCount = styled.span`
  font-size: 0.5625rem;
  font-family: var(--font-geist-mono), monospace;
  color: rgba(${PINK_RGB}, 0.7);
  white-space: nowrap;
  min-width: 48px;
  text-align: center;

  [data-theme="light"] & {
    color: rgba(${PINK_RGB}, 0.85);
  }
`;

const SearchNavBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid rgba(${PINK_RGB}, 0.25);
  background: rgba(${PINK_RGB}, 0.06);
  color: ${PINK};
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { background: rgba(${PINK_RGB}, 0.14); }
  &:disabled { opacity: 0.3; cursor: default; }
`;

const SearchCloseBtn = styled.button`
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: none;
  border: none;
  color: var(--t-textMuted);
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { color: var(--t-text); }
`;

const SearchCaseBtn = styled.button<{ $active?: boolean }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.5)` : "rgba(255,255,255,0.1)")};
  background: ${(p) => (p.$active ? `rgba(${PINK_RGB}, 0.12)` : "transparent")};
  color: ${(p) => (p.$active ? PINK : "var(--t-textMuted)")};
  font-size: 9px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const CodeTabBar = styled.div`
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--t-border);
`;

const CodeTabBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  padding: 0.375rem 0.75rem;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  background: ${(p) => (p.$active ? "var(--t-inputBg)" : "transparent")};
  border: none;
  border-bottom: 2px solid ${(p) => (p.$active ? PINK : "transparent")};
  color: ${(p) => (p.$active ? PINK : "var(--t-textFaint)")};
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    color: ${PINK};
  }
`;

const CodeFooter = styled.div`
  padding: 0.5rem 1rem;
  font-size: 0.5625rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  flex-shrink: 0;
  border-top: 1px solid var(--t-border);
  color: var(--t-textFaint);
`;

const DraftSbdmWrap = styled.div`
  position: relative;
`;

const DraftArrow = styled.span`
  font-size: 8px;
`;

const DraftNumber = styled.span`
  font-family: var(--font-geist-mono), monospace;
  color: ${GOLD};
`;

const DraftDate = styled.span`
  margin-left: 0.5rem;
  font-size: 0.625rem;
  color: rgba(${GOLD_RGB}, 0.7);

  [data-theme="light"] & {
    color: rgba(${GOLD_RGB}, 0.85);
  }
`;

const FileItemsWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

const FileItemRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
`;

// ── New-entry tracking ───────────────────────────────────────────────
// Persist the set of sandbox entry keys the user has scrolled past at
// least once. On first ever visit (no value in localStorage), seed the
// set with every current REGISTRY key so NO entries flash "NEW" — the
// baseline is "you've already seen everything that exists today." On
// subsequent visits, any key in REGISTRY that isn't in the seen set is
// "new" and shows a NewTag next to its file-list row. The IntersectionObserver
// in FileEntry marks a key seen the first time its row becomes ≥50%
// visible inside the sidebar scroll viewport.

const SANDBOX_SEEN_STORAGE = "sandbox-seen-keys-v1";

function loadSeenKeys(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SANDBOX_SEEN_STORAGE);
    if (raw === null) return null;
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistSeenKeys(seen: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SANDBOX_SEEN_STORAGE, JSON.stringify([...seen]));
  } catch {
    /* ignore quota / disabled storage */
  }
}

function useNewKeys() {
  const [newKeys, setNewKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const currentKeys = REGISTRY.map((e) => e.key);
    const seen = loadSeenKeys();
    if (seen === null) {
      // First visit — seed seen-set with every existing key so nothing
      // flashes "NEW" for brand-new users.
      persistSeenKeys(new Set(currentKeys));
      setNewKeys(new Set());
      return;
    }
    const news = new Set<string>();
    for (const k of currentKeys) if (!seen.has(k)) news.add(k);
    setNewKeys(news);
  }, []);

  const markSeen = useCallback((key: string) => {
    setNewKeys((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      const seen = loadSeenKeys() ?? new Set<string>();
      seen.add(key);
      persistSeenKeys(seen);
      return next;
    });
  }, []);

  return { newKeys, markSeen };
}

// One row in the Files sidebar. The NEW tag behaves like a read-receipt:
// it disappears permanently the first time the user clicks the row to
// open that sandbox entry. No scroll / intersection tracking — seeing
// the tag isn't enough, the user has to actually engage with the entry.
function FileEntry({
  entry,
  active,
  isNew,
  onClick,
  onSeen,
}: {
  entry: SandboxEntry;
  active: boolean;
  isNew: boolean;
  onClick: () => void;
  onSeen: (key: string) => void;
}) {
  const isAbbrev = entry.key.length <= 5;
  const subText = entry.name
    .replace(`${entry.key} — `, "")
    .replace(entry.key, "")
    .trim();

  const handleClick = () => {
    if (isNew) onSeen(entry.key);
    onClick();
  };

  return (
    <FileItem $active={active} onClick={handleClick}>
      <FileItemRow>
        <FileItemLabel>{isAbbrev ? entry.key : entry.name}</FileItemLabel>
        {isAbbrev && subText && (
          <FileItemSub $active={active}>{subText}</FileItemSub>
        )}
        {isNew && <NewTag aria-label="New sandbox entry">NEW</NewTag>}
      </FileItemRow>
    </FileItem>
  );
}

const StyleFooterRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
`;

const AutoSavedFlash = styled.span<{ $visible: boolean }>`
  font-size: 0.5625rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.7);
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transition: opacity ${(p) => (p.$visible ? "0.15s" : "1.5s")} ease;
  pointer-events: none;
  white-space: nowrap;
`;

// ── Component ────────────────────────────────────────────────────

const SNAP_THRESHOLD = 50;
// Wide enough that file names + subpaths never clip — users can still drag
// the DTog to shrink; the default must not require horizontal scroll.
const SIDEBAR_DEFAULT = 340;
const CODE_DEFAULT = 420;
const SIDEBAR_MIN = 140;
const CODE_MIN = 200;

// DTog click-vs-drag threshold: if the pointer moves less than this many pixels
// before release, the gesture is treated as a plain click and collapses the
// panel (snap). Anything beyond it is a drag and resizes normally.
const DTOG_CLICK_SLOP = 4;

function useResizePanel(
  defaultW: number,
  minW: number,
  side: "left" | "right",
  containerRef: React.RefObject<HTMLDivElement | null>,
) {
  const [width, setWidth] = useState(defaultW);
  const [snapped, setSnapped] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width || defaultW;
    setDragging(true);
    let moved = false;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX.current;
      if (!moved && Math.abs(dx) < DTOG_CLICK_SLOP) return;
      moved = true;
      const raw = side === "left" ? startW.current + dx : startW.current - dx;
      if (raw < SNAP_THRESHOLD) {
        setWidth(0);
        setSnapped(true);
      } else {
        setWidth(Math.max(minW, raw));
        setSnapped(false);
      }
    };
    const onUp = () => {
      setDragging(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      if (!moved) {
        // Plain click on the DTog grip → collapse (snap) the panel. A second
        // click on the restore tab brings it back; no drag required to close.
        setWidth(0);
        setSnapped(true);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [width, defaultW, minW, side]);

  const restore = useCallback(() => {
    setWidth(defaultW);
    setSnapped(false);
  }, [defaultW]);

  return { width: snapped ? 0 : width, snapped, dragging, onPointerDown, restore };
}

type SandboxMode = "main" | "popout";
const BC_NAME = "sandbox";
const POPOUT_STALE_MS = 3000;
const POPOUT_HEARTBEAT_MS = 1200;

export default function SandboxModal({
  onClose,
  mode = "main",
}: {
  onClose: () => void;
  mode?: SandboxMode;
}) {
  const [activeKey, setActiveKey] = useState<string>(REGISTRY[0]?.key ?? "");
  const [popoutActive, setPopoutActive] = useState(false);
  const [fsOpen, setFsOpen] = useState(true);
  const [catOpen, setCatOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c, true]))
  );
  const allCatsOpen = CATEGORIES.every((c) => catOpen[c] ?? true);
  const toggleAllCats = () =>
    setCatOpen(Object.fromEntries(CATEGORIES.map((c) => [c, !allCatsOpen])));
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeTab, setCodeTab] = useState<"component" | "style">("component");
  const [liveStyle, setLiveStyle] = useState<string | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  const [styleDirty, setStyleDirty] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [codeDraft, setCodeDraft] = useState<string>("");
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const sidebar = useResizePanel(SIDEBAR_DEFAULT, SIDEBAR_MIN, "left", bodyRef);
  const codePanel = useResizePanel(CODE_DEFAULT, CODE_MIN, "right", bodyRef);
  const { newKeys, markSeen } = useNewKeys();

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCase, setSearchCase] = useState(false);
  const [searchIdx, setSearchIdx] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const codeEditorRef = useRef<HTMLTextAreaElement | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [unsavedCode, setUnsavedCode] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [draftSearch, setDraftSearch] = useState("");
  const [draftAsc, setDraftAsc] = useState(true);
  const draftSbdmRef = useRef<HTMLDivElement | null>(null);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const toolbarMenuRef = useRef<HTMLDivElement | null>(null);

  const active: SandboxEntry | undefined = useMemo(
    () => REGISTRY.find((e) => e.key === activeKey),
    [activeKey]
  );

  const drafts = useDraftStore(activeKey, active?.code ?? "");

  useEffect(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  // Popout ↔ main coordination. See DrawerMenuButton.md cascade step 5.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BC_NAME);

    if (mode === "main") {
      let lastSeen = 0;
      const tick = setInterval(() => {
        if (lastSeen && Date.now() - lastSeen > POPOUT_STALE_MS) {
          setPopoutActive(false);
          lastSeen = 0;
        }
      }, 1000);
      bc.onmessage = (e) => {
        const t = e.data?.type;
        if (t === "popout-open") {
          lastSeen = Date.now();
          setPopoutActive(true);
        } else if (t === "popout-close") {
          lastSeen = 0;
          setPopoutActive(false);
        }
      };
      bc.postMessage({ type: "ping" });
      return () => {
        clearInterval(tick);
        bc.close();
      };
    }

    bc.postMessage({ type: "popout-open" });
    bc.onmessage = (e) => {
      const t = e.data?.type;
      if (t === "ping") bc.postMessage({ type: "popout-open" });
      else if (t === "close-request") window.close();
    };
    const beat = setInterval(() => bc.postMessage({ type: "popout-open" }), POPOUT_HEARTBEAT_MS);
    const onUnload = () => bc.postMessage({ type: "popout-close" });
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(beat);
      bc.postMessage({ type: "popout-close" });
      window.removeEventListener("beforeunload", onUnload);
      bc.close();
    };
  }, [mode]);

  const requestPopoutClose = useCallback(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: "close-request" });
    bc.close();
  }, []);

  useEffect(() => {
    if (!editMode) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(Array.isArray(d) ? d.map((p: { name: string }) => ({ name: p.name })) : []))
      .catch(() => setProjects([]));
  }, [editMode]);

  useEffect(() => {
    setCodeDraft(active?.code ?? "");
    setUnsavedCode(null);
  }, [active]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (draftPickerOpen) { setDraftPickerOpen(false); return; }
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen, draftPickerOpen]);

  useEffect(() => {
    if (!draftPickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (draftSbdmRef.current && !draftSbdmRef.current.contains(e.target as Node)) setDraftPickerOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [draftPickerOpen]);

  useEffect(() => {
    if (!toolbarMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (toolbarMenuRef.current && !toolbarMenuRef.current.contains(e.target as Node)) setToolbarMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setToolbarMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolbarMenuOpen]);

  const grouped = useMemo(() => {
    const m: Record<string, SandboxEntry[]> = {};
    for (const c of CATEGORIES) m[c] = [];
    for (const e of REGISTRY) m[e.category].push(e);
    return m;
  }, []);

  const Demo = active?.Demo;

  useEffect(() => { setCodeTab("component"); setLiveStyle(null); setStyleDirty(false); }, [activeKey]);

  useEffect(() => {
    if (codeTab !== "style" || !active?.stylePath) return;
    setStyleLoading(true);
    fetch(`/api/sandbox/styles?path=${encodeURIComponent(active.stylePath)}`)
      .then((r) => r.json())
      .then((d: { styles?: string }) => { setLiveStyle(d.styles ?? "// No styled blocks found"); setStyleDirty(false); })
      .catch(() => setLiveStyle("// Failed to load styles"))
      .finally(() => setStyleLoading(false));
  }, [codeTab, active?.stylePath]);

  const [autoSavedFlash, setAutoSavedFlash] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveStyle = useCallback(async () => {
    if (!active?.stylePath || !liveStyle) return;
    const res = await fetch("/api/sandbox/styles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: active.stylePath, styles: liveStyle }),
    });
    const d = await res.json();
    if (d.ok) {
      setStyleDirty(false);
      setAutoSavedFlash(true);
      setTimeout(() => setAutoSavedFlash(false), 1800);
    }
  }, [active?.stylePath, liveStyle]);

  // Debounced auto-save: 1.5s after the user stops typing in the style tab
  useEffect(() => {
    if (codeTab !== "style" || !styleDirty || !liveStyle) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => { saveStyle(); }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [liveStyle, styleDirty, codeTab, saveStyle]);

  // Search: find all match positions in the current editor text
  const currentText = codeTab === "style" ? (liveStyle ?? "") : (editMode && drafts.active ? (unsavedCode ?? drafts.active.code) : codeDraft);

  const searchMatches = useMemo(() => {
    if (!searchQuery || !searchOpen) return [];
    const text = searchCase ? currentText : currentText.toLowerCase();
    const q = searchCase ? searchQuery : searchQuery.toLowerCase();
    const positions: number[] = [];
    let pos = 0;
    while ((pos = text.indexOf(q, pos)) !== -1) {
      positions.push(pos);
      pos += 1;
    }
    return positions;
  }, [currentText, searchQuery, searchCase, searchOpen]);

  const safeSearchIdx = searchMatches.length > 0 ? searchIdx % searchMatches.length : 0;

  const jumpToMatch = useCallback((idx: number) => {
    const ta = codeEditorRef.current;
    if (!ta || searchMatches.length === 0) return;
    const pos = searchMatches[idx % searchMatches.length];
    ta.focus();
    ta.setSelectionRange(pos, pos + searchQuery.length);
    // Scroll to match: estimate line position
    const textBefore = currentText.slice(0, pos);
    const lineNum = textBefore.split("\n").length - 1;
    const lineH = 15.4; // ~0.6875rem * 1.55 line-height ≈ 15.4px
    ta.scrollTop = Math.max(0, lineNum * lineH - ta.clientHeight / 3);
  }, [searchMatches, searchQuery, currentText]);

  // Cmd+F / Ctrl+F to open search, Escape to close, Enter to navigate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!codeOpen || codePanel.snapped) return;
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+F: open search
      if (mod && e.key === "f") {
        e.preventDefault();
        e.stopPropagation();
        setSearchOpen(true);
        setSearchIdx(0);
        setTimeout(() => searchInputRef.current?.focus(), 0);
        return;
      }

      // Cmd+/ or Cmd+\: toggle comment on current line
      if (mod && (e.key === "/" || e.key === "\\")) {
        e.preventDefault();
        e.stopPropagation();
        const ta = codeEditorRef.current;
        if (!ta) return;
        const val = ta.value;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        // Find line boundaries
        const lineStart = val.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = val.indexOf("\n", end);
        const actualEnd = lineEnd === -1 ? val.length : lineEnd;
        // Get all lines in selection
        const block = val.slice(lineStart, actualEnd);
        const lines = block.split("\n");
        const allCommented = lines.every((l) => l.trimStart().startsWith("// ") || l.trimStart().startsWith("//") && l.trim() === "//");
        const toggled = lines
          .map((l) => {
            if (allCommented) {
              const idx = l.indexOf("// ");
              if (idx !== -1) return l.slice(0, idx) + l.slice(idx + 3);
              const idx2 = l.indexOf("//");
              if (idx2 !== -1) return l.slice(0, idx2) + l.slice(idx2 + 2);
              return l;
            }
            return "// " + l;
          })
          .join("\n");
        const newVal = val.slice(0, lineStart) + toggled + val.slice(actualEnd);
        // Update via the appropriate handler
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
        nativeInputValueSetter?.call(ta, newVal);
        ta.dispatchEvent(new Event("input", { bubbles: true }));
        // Restore selection
        const diff = toggled.length - block.length;
        ta.setSelectionRange(start + (allCommented ? -3 : 3), end + diff);
        return;
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [codeOpen, codePanel.snapped]);

  const editorCode = editMode && drafts.active
    ? (unsavedCode ?? drafts.active.code)
    : codeDraft;

  const handleCodeChange = (next: string) => {
    if (editMode && drafts.active) {
      if (autoSave) {
        drafts.writeCode(next);
        setUnsavedCode(null);
      } else {
        setUnsavedCode(next);
      }
    } else {
      setCodeDraft(next);
    }
  };

  const handleManualSave = () => {
    if (!editMode || !drafts.active || unsavedCode == null) return;
    drafts.writeCode(unsavedCode);
    setUnsavedCode(null);
  };

  const isSaved = editMode && drafts.active ? unsavedCode == null : true;

  const handleEnterEditMode = () => {
    setEditMode(true);
    if (!drafts.active) drafts.startNewDraft();
    setCodeOpen(true);
  };

  const handleDeploy = async ({ targets, preview }: { targets?: string[]; preview?: boolean }) => {
    const res = await fetch("/api/sandbox/deploy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ components: ["@tgv/ui"], targets, preview }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
  };

  const filteredDrafts = drafts.drafts
    .filter((d) => `Draft #${d.number}`.toLowerCase().includes(draftSearch.toLowerCase()))
    .slice()
    .sort((a, b) => draftAsc ? a.number - b.number : b.number - a.number);

  return (
    <>
      <Backdrop onClick={onClose} />

      <Modal
        $edit={editMode}
        $accent={editMode ? "gold" : "pink"}
        $fs={fullscreen}
      >
        <Header $edit={editMode}>
          <HeaderLeft $w={sidebar.snapped ? 0 : sidebar.width} $edit={editMode}>
            <SandboxIcon size={22} color={editMode ? GOLD : PINK} />
            <Title $edit={editMode}>Sandbox{editMode ? " · Editing" : ""}</Title>

            {isAdmin && drafts.drafts.length > 0 && (
              <DraftSbdmWrap ref={draftSbdmRef}>
                <Tooltip label="Pick a draft or live" accent={TT_ACCENT}>
                  <DraftTrigger onClick={() => setDraftPickerOpen((v) => !v)}>
                    {drafts.active ? `Draft #${drafts.active.number}` : "Live"}
                    <DraftArrow>▾</DraftArrow>
                  </DraftTrigger>
                </Tooltip>
                {draftPickerOpen && (
                  <DraftPanel>
                    <DraftSearchBar>
                      <DraftSearchInput
                        autoFocus
                        value={draftSearch}
                        onChange={(e) => setDraftSearch(e.target.value)}
                        placeholder="Search drafts…"
                      />
                      <DraftSortBtn onClick={() => setDraftAsc((v) => !v)}>
                        {draftAsc ? "Z-A" : "A-Z"}
                      </DraftSortBtn>
                    </DraftSearchBar>
                    <DraftList>
                      <LiveBtn onClick={() => { drafts.closeDraft(); setEditMode(false); setDraftPickerOpen(false); }}>
                        <LiveDot />
                        <span>Live (deployed)</span>
                      </LiveBtn>
                      {filteredDrafts.map((d) => (
                        <DraftItem key={d.id}>
                          <DraftItemBtn onClick={() => { drafts.openDraft(d.id); setEditMode(true); setDraftPickerOpen(false); }}>
                            <DraftNumber>Draft #{d.number}</DraftNumber>
                            <DraftDate>{new Date(d.updatedAt).toLocaleString()}</DraftDate>
                          </DraftItemBtn>
                          <Tooltip label="Delete draft" accent="#ef4444">
                            <DraftItemDel onClick={() => drafts.deleteDraft(d.id)}>✕</DraftItemDel>
                          </Tooltip>
                        </DraftItem>
                      ))}
                    </DraftList>
                  </DraftPanel>
                )}
              </DraftSbdmWrap>
            )}

            <HeaderTotal $edit={editMode}>{REGISTRY.length}</HeaderTotal>
            <Tooltip label={allCatsOpen ? "Collapse all groups" : "Expand all groups"} accent={TT_ACCENT}>
              <CollapseAllBtn
                $on={allCatsOpen}
                onClick={toggleAllCats}
                aria-pressed={allCatsOpen}
                aria-label={allCatsOpen ? "Collapse all groups" : "Expand all groups"}
              >
                <CollapseAllThumb $on={allCatsOpen} />
              </CollapseAllBtn>
            </Tooltip>
          </HeaderLeft>

          {!sidebar.snapped && <Rsd $edit={editMode} />}

          <HeaderRight>
            {sidebar.snapped && (
              <>
                <SandboxIcon size={22} color={editMode ? GOLD : PINK} />
                <Title $edit={editMode}>
                  Sandbox{editMode ? " · Editing" : ""}
                </Title>
              </>
            )}
            <WideControls>
              {isAdmin && (
                <ToggleBtn
                  $active={editMode}
                  $color={GOLD_RGB}
                  onClick={() => editMode ? (setEditMode(false), drafts.closeDraft()) : handleEnterEditMode()}
                  aria-label={editMode ? "Exit edit mode" : "Enter edit mode"}
                >
                  <PencilIcon />
                  <BtnLabel>{editMode ? "Exit Edit" : "Edit Mode"}</BtnLabel>
                </ToggleBtn>
              )}

              <ToggleBtn
                $active={fsOpen && !sidebar.snapped}
                onClick={() => { if (sidebar.snapped) { sidebar.restore(); } else { setFsOpen((p) => !p); } }}
                aria-label="Toggle files panel"
              >
                <FolderIcon />
                <BtnLabel>Files</BtnLabel>
              </ToggleBtn>

              <ToggleBtn
                $active={codeOpen && !codePanel.snapped}
                onClick={() => { if (codePanel.snapped) { codePanel.restore(); } else { setCodeOpen((p) => !p); } }}
                aria-label="Toggle code panel"
              >
                <CodeBracketsIcon />
                <BtnLabel>Code</BtnLabel>
              </ToggleBtn>

              <Spacer />

              {mode === "main" ? (
                <Tooltip label="Open in new window" accent={TT_ACCENT}>
                  <SandboxCtrlBtn
                    onClick={() => {
                      const w = window.screen.width * 0.8;
                      const h = window.screen.height * 0.85;
                      const left = (window.screen.width - w) / 2;
                      const top = (window.screen.height - h) / 2;
                      window.open("/dashboard/sandbox?popout=1", "tgv-sandbox-popout", `width=${w},height=${h},left=${left},top=${top}`);
                    }}
                  >
                    ⧉
                  </SandboxCtrlBtn>
                </Tooltip>
              ) : (
                <Tooltip label="Return to main window" accent={TT_ACCENT}>
                  <SandboxCtrlBtn onClick={() => window.close()}>
                    <ReturnToMainGlyph />
                  </SandboxCtrlBtn>
                </Tooltip>
              )}
              <Tooltip label={fullscreen ? "Exit fullscreen" : "Fullscreen"} accent={TT_ACCENT}>
                <SandboxCtrlBtn onClick={() => setFullscreen((p) => !p)}>
                  {fullscreen ? "⊡" : "⊞"}
                </SandboxCtrlBtn>
              </Tooltip>
              <Tooltip label="Close (Esc)" accent={TT_ACCENT}>
                <SandboxCtrlBtn onClick={onClose}>✕</SandboxCtrlBtn>
              </Tooltip>
            </WideControls>

            <NarrowControls>
              <MenuDdmWrap ref={toolbarMenuRef}>
                <Tooltip label="Toolbar menu" accent={TT_ACCENT}>
                  <SandboxCtrlBtn
                    onClick={() => setToolbarMenuOpen((v) => !v)}
                    aria-expanded={toolbarMenuOpen}
                    aria-haspopup="menu"
                  >
                    <MenuIcon />
                  </SandboxCtrlBtn>
                </Tooltip>
                {toolbarMenuOpen && (
                  <MenuDdmPanel role="menu">
                    {isAdmin && (
                      <MenuDdmItem
                        $active={editMode}
                        $color={GOLD_RGB}
                        onClick={() => {
                          if (editMode) { setEditMode(false); drafts.closeDraft(); }
                          else { handleEnterEditMode(); }
                          setToolbarMenuOpen(false);
                        }}
                      >
                        <PencilIcon />
                        <span>{editMode ? "Exit Edit" : "Edit Mode"}</span>
                      </MenuDdmItem>
                    )}
                    <MenuDdmItem
                      $active={fsOpen && !sidebar.snapped}
                      onClick={() => {
                        if (sidebar.snapped) { sidebar.restore(); } else { setFsOpen((p) => !p); }
                        setToolbarMenuOpen(false);
                      }}
                    >
                      <FolderIcon />
                      <span>Files</span>
                    </MenuDdmItem>
                    <MenuDdmItem
                      $active={codeOpen && !codePanel.snapped}
                      onClick={() => {
                        if (codePanel.snapped) { codePanel.restore(); } else { setCodeOpen((p) => !p); }
                        setToolbarMenuOpen(false);
                      }}
                    >
                      <CodeBracketsIcon />
                      <span>Code</span>
                    </MenuDdmItem>
                    {mode === "main" ? (
                      <MenuDdmItem
                        onClick={() => {
                          const w = window.screen.width * 0.8;
                          const h = window.screen.height * 0.85;
                          const left = (window.screen.width - w) / 2;
                          const top = (window.screen.height - h) / 2;
                          window.open("/dashboard/sandbox?popout=1", "tgv-sandbox-popout", `width=${w},height=${h},left=${left},top=${top}`);
                          setToolbarMenuOpen(false);
                        }}
                      >
                        <span aria-hidden="true">⧉</span>
                        <span>Open in new window</span>
                      </MenuDdmItem>
                    ) : (
                      <MenuDdmItem onClick={() => { window.close(); setToolbarMenuOpen(false); }}>
                        <ReturnToMainGlyph />
                        <span>Return to main</span>
                      </MenuDdmItem>
                    )}
                    <MenuDdmItem
                      $active={fullscreen}
                      onClick={() => { setFullscreen((p) => !p); setToolbarMenuOpen(false); }}
                    >
                      <span aria-hidden="true">{fullscreen ? "⊡" : "⊞"}</span>
                      <span>{fullscreen ? "Exit fullscreen" : "Fullscreen"}</span>
                    </MenuDdmItem>
                  </MenuDdmPanel>
                )}
              </MenuDdmWrap>

              <Tooltip label="Close (Esc)" accent={TT_ACCENT}>
                <SandboxCtrlBtn onClick={onClose}>✕</SandboxCtrlBtn>
              </Tooltip>
            </NarrowControls>
          </HeaderRight>
        </Header>

        {isAdmin && editMode && (
          <SandboxEditToolbar
            active={drafts.active}
            autoSave={autoSave}
            setAutoSave={setAutoSave}
            onSave={handleManualSave}
            onUndo={drafts.undo}
            onRedo={drafts.redo}
            canUndo={drafts.canUndo}
            canRedo={drafts.canRedo}
            onResetToDeployed={drafts.resetToDeployed}
            isSaved={isSaved}
            componentKey={activeKey}
            projects={projects}
            onDeploy={handleDeploy}
          />
        )}

        <Body ref={bodyRef}>
          {fsOpen && !sidebar.snapped && (
            <FileSidebar $w={sidebar.width}>
              {CATEGORIES.map((cat) => {
                const open = catOpen[cat] ?? true;
                const items = grouped[cat];
                return (
                  <FileGroup key={cat}>
                    <AdlHeader
                      $open={open}
                      aria-expanded={open}
                      onClick={() => setCatOpen((prev) => ({ ...prev, [cat]: !open }))}
                    >
                      <AdlLabel>{cat}</AdlLabel>
                      <AdlCount>{items.length}</AdlCount>
                      <AdlSwitchTrack $on={open} aria-hidden="true">
                        <AdlSwitchThumb $on={open} />
                      </AdlSwitchTrack>
                    </AdlHeader>
                    <AdlBody $open={open}>
                      <FileItemsWrap>
                        {items.map((e) => (
                          <FileEntry
                            key={e.key}
                            entry={e}
                            active={activeKey === e.key}
                            isNew={newKeys.has(e.key)}
                            onClick={() => setActiveKey(e.key)}
                            onSeen={markSeen}
                          />
                        ))}
                      </FileItemsWrap>
                    </AdlBody>
                  </FileGroup>
                );
              })}
            </FileSidebar>
          )}
          {fsOpen && !sidebar.snapped && (
            <ResizeHandle
              $dragging={sidebar.dragging}
              $edit={editMode}
              $pairedSide="right"
              onPointerDown={sidebar.onPointerDown}
            >
              <DTogGrip />
            </ResizeHandle>
          )}
          {fsOpen && sidebar.snapped && (
            <Tooltip label="Restore file panel" accent={TT_ACCENT}>
              <DrawerTab $side="left" onClick={sidebar.restore}>
                <ExpandIcon side="left" />
              </DrawerTab>
            </Tooltip>
          )}

          <CenterPane>
            {active ? (
              <>
                <SummaryBar>
                  <SummaryToggle
                    onClick={() => setSummaryOpen((p) => !p)}
                    aria-pressed={summaryOpen}
                    aria-label={summaryOpen ? "Collapse summary" : "Expand summary"}
                  >
                    <SummaryTopRow>
                      <SummaryLabel>Summary</SummaryLabel>
                      <Spacer />
                      <AdlSwitchTrack $on={summaryOpen} aria-hidden="true">
                        <AdlSwitchThumb $on={summaryOpen} />
                      </AdlSwitchTrack>
                    </SummaryTopRow>
                    <SummaryKeyRow>
                      <SummaryKey>
                        {active.key.length > 5 ? (
                          active.name
                        ) : (
                          <>
                            <SummaryKeyAcronym>{active.key}</SummaryKeyAcronym>
                            {active.name}
                          </>
                        )}
                      </SummaryKey>
                    </SummaryKeyRow>
                  </SummaryToggle>
                  {summaryOpen && (
                    <SummaryBody>
                      <SummaryText>{active.summary}</SummaryText>
                      <div>
                        <UsageLabel>Usage</UsageLabel>
                        <UsageText>{active.usage}</UsageText>
                      </div>
                    </SummaryBody>
                  )}
                </SummaryBar>

                <Viewport>
                  <DemoArea>
                    <DemoWrap>
                      {Demo && <Demo />}
                    </DemoWrap>
                  </DemoArea>
                  {isAdmin && editMode && active && (
                    <ClaudeWrap>
                      <SandboxClaudeDrawer
                        componentKey={activeKey}
                        currentCode={editorCode}
                        onCodeUpdate={(code) => handleCodeChange(code)}
                        onDeploy={(targets) => handleDeploy({ targets: targets[0] === "all" ? undefined : targets })}
                      />
                    </ClaudeWrap>
                  )}
                </Viewport>
              </>
            ) : (
              <EmptyCenter>Select a component.</EmptyCenter>
            )}
          </CenterPane>

          {codeOpen && active && !codePanel.snapped && (
            <ResizeHandle
              $dragging={codePanel.dragging}
              $edit={editMode}
              onPointerDown={codePanel.onPointerDown}
            >
              <DTogGrip />
            </ResizeHandle>
          )}
          {codeOpen && codePanel.snapped && (
            <Tooltip label="Restore code panel" accent={TT_ACCENT}>
              <DrawerTab $side="right" onClick={codePanel.restore}>
                <ExpandIcon side="right" />
              </DrawerTab>
            </Tooltip>
          )}
          {codeOpen && active && !codePanel.snapped && (
            <CodePane $w={codePanel.width}>
              <CodeHeader>
                <CodeLabel $edit={editMode}>Code</CodeLabel>
                <CodeTag>{active.key}{codeTab === "style" ? ".styled.ts" : ".tsx"}</CodeTag>
                <Spacer />
                {codeTab === "style" && <AutoSavedFlash $visible={autoSavedFlash}>auto-saved</AutoSavedFlash>}
                <Tooltip label="Restore canonical / deployed code" accent={TT_ACCENT}>
                  <PanelActionBtn
                    $variant="ghost"
                    onClick={() => { if (codeTab === "style") { setLiveStyle(null); setStyleLoading(true); fetch(`/api/sandbox/styles?path=${encodeURIComponent(active.stylePath ?? "")}`).then(r => r.json()).then(d => { setLiveStyle(d.styles ?? ""); setStyleDirty(false); }).finally(() => setStyleLoading(false)); } else if (editMode) { drafts.resetToDeployed(); } else { setCodeDraft(active.code); } }}
                  >
                    Reset
                  </PanelActionBtn>
                </Tooltip>
              </CodeHeader>
              {active.stylePath && (
                <CodeTabBar>
                  <CodeTabBtn $active={codeTab === "component"} onClick={() => setCodeTab("component")}>
                    Component
                  </CodeTabBtn>
                  <CodeTabBtn $active={codeTab === "style"} onClick={() => setCodeTab("style")}>
                    Styles
                  </CodeTabBtn>
                </CodeTabBar>
              )}
              <CodeEditorWrap>
                {searchOpen && (
                  <SearchBar>
                    <SearchInput
                      ref={searchInputRef}
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setSearchIdx(0); }}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { e.stopPropagation(); setSearchOpen(false); setSearchQuery(""); codeEditorRef.current?.focus(); }
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (searchMatches.length === 0) return;
                          const next = e.shiftKey
                            ? (safeSearchIdx - 1 + searchMatches.length) % searchMatches.length
                            : (safeSearchIdx + 1) % searchMatches.length;
                          setSearchIdx(next);
                          jumpToMatch(next);
                        }
                      }}
                      placeholder="Find…"
                      spellCheck={false}
                    />
                    <Tooltip label="Match case" accent={TT_ACCENT}>
                      <SearchCaseBtn
                        $active={searchCase}
                        onClick={() => setSearchCase((v) => !v)}
                      >Aa</SearchCaseBtn>
                    </Tooltip>
                    <SearchCount>
                      {searchMatches.length > 0 ? `${safeSearchIdx + 1}/${searchMatches.length}` : searchQuery ? "0" : ""}
                    </SearchCount>
                    <Tooltip label="Previous (Shift+Enter)" accent={TT_ACCENT}>
                      <SearchNavBtn
                        disabled={searchMatches.length === 0}
                        onClick={() => { const p = (safeSearchIdx - 1 + searchMatches.length) % searchMatches.length; setSearchIdx(p); jumpToMatch(p); }}
                      >▲</SearchNavBtn>
                    </Tooltip>
                    <Tooltip label="Next (Enter)" accent={TT_ACCENT}>
                      <SearchNavBtn
                        disabled={searchMatches.length === 0}
                        onClick={() => { const n = (safeSearchIdx + 1) % searchMatches.length; setSearchIdx(n); jumpToMatch(n); }}
                      >▼</SearchNavBtn>
                    </Tooltip>
                    <Tooltip label="Close (Esc)" accent={TT_ACCENT}>
                      <SearchCloseBtn onClick={() => { setSearchOpen(false); setSearchQuery(""); codeEditorRef.current?.focus(); }}>✕</SearchCloseBtn>
                    </Tooltip>
                  </SearchBar>
                )}
                <CodeEditor
                  ref={codeEditorRef}
                  value={codeTab === "style" ? (liveStyle ?? "// Loading...") : editorCode}
                  onChange={(e) => { if (codeTab === "style") { setLiveStyle(e.target.value); setStyleDirty(true); } else { handleCodeChange(e.target.value); } }}
                  spellCheck={false}
                />
              </CodeEditorWrap>
              <CodeFooter>
                {codeTab === "style" ? (
                  <StyleFooterRow>
                    <span>{active.stylePath}</span>
                    <Spacer />
                    <span>{styleLoading ? "loading…" : "synced"}</span>
                  </StyleFooterRow>
                ) : editMode && drafts.active
                  ? `Draft #${drafts.active.number} · ${isSaved ? "saved" : "unsaved"} · auto-save ${autoSave ? "on" : "off"}`
                  : "Edits reset on file switch · not saved"}
              </CodeFooter>
            </CodePane>
          )}
          {mode === "main" && popoutActive && (
            <Blackout>
              <BlackoutMsg>Currently working in pop-out window</BlackoutMsg>
              <BlackoutSub>
                Your work is live in the other window. Close the pop-out to
                continue here.
              </BlackoutSub>
              <BlackoutCloseBtn type="button" onClick={requestPopoutClose}>
                Close pop-out
              </BlackoutCloseBtn>
            </Blackout>
          )}
        </Body>
      </Modal>
    </>
  );
}
