"use client";

/**
 * NeonSelect — gold neon dropdown (house DDM) replacing native <select> in the
 * Front Desk alerts surfaces. Panel PORTALS to <body> (fixed, z above the
 * modal) so it's never clipped by a scrolling modal Body, and flips upward when
 * there's more room above. Shared by AlertsCalendarModal + AlertSettingsPanel.
 *
 * `inkWhite` is exported too: input/content ink is white on dark, near-black on
 * light — the companion to the amber-gold field labels.
 */

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled, { css } from "styled-components";
import { colors, rgb } from "../../theme";

export const inkWhite = css`
  color: #ffffff;
  [data-theme="light"] & { color: #14161a; }
`;

const NeonTrigger = styled.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  width: 100%;
  max-width: 20rem;
  padding: 0.5rem 0.7rem;
  font-size: 0.875rem;
  ${inkWhite}
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  &:hover:not(:disabled) { border-color: rgba(${rgb.gold}, 0.7); box-shadow: 0 0 10px rgba(${rgb.gold}, 0.18); }
  &:disabled { opacity: 0.5; cursor: default; }
  .arr { color: ${colors.gold}; font-size: 0.55rem; }
`;

const PortalOverlay = styled.div`position: fixed; inset: 0; z-index: 12050;`;
const PortalPanel = styled.div`
  position: fixed;
  z-index: 12051;
  max-width: 24rem;
  max-height: 15rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.6rem;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6), 0 0 22px rgba(${rgb.gold}, 0.16);
`;
const NeonItem = styled.button<{ $active: boolean }>`
  text-align: left;
  padding: 0.45rem 0.6rem;
  border: none;
  border-radius: 0.4rem;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: ${(p) => (p.$active ? 800 : 500)};
  color: ${(p) => (p.$active ? "#0b0b0b" : "#fff")};
  background: ${(p) => (p.$active ? colors.gold : "transparent")};
  [data-theme="light"] & { color: ${(p) => (p.$active ? "#0b0b0b" : "#14161a")}; }
  &:hover { background: ${(p) => (p.$active ? colors.gold : `rgba(${rgb.gold}, 0.16)`)}; }
`;

export type Option = { value: string; label: string };

export default function NeonSelect({
  value, options, placeholder = "Select…", disabled, maxWidth, onChange,
}: { value: string; options: Option[]; placeholder?: string; disabled?: boolean; maxWidth?: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top?: number; bottom?: number; left: number; width: number; maxH: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cur = options.find((o) => o.value === value);
  const width = maxWidth ?? "20rem";

  const openPanel = () => {
    const el = triggerRef.current;
    if (!el) { setOpen(true); return; }
    const r = el.getBoundingClientRect();
    const margin = 10;
    const spaceBelow = window.innerHeight - r.bottom - margin;
    const spaceAbove = r.top - margin;
    const desired = Math.min(320, options.length * 40 + 10);
    if (spaceBelow >= desired || spaceBelow >= spaceAbove) {
      setRect({ top: r.bottom + 6, left: r.left, width: r.width, maxH: Math.max(140, Math.min(desired, spaceBelow)) });
    } else {
      setRect({ bottom: window.innerHeight - r.top + 6, left: r.left, width: r.width, maxH: Math.max(140, Math.min(desired, spaceAbove)) });
    }
    setOpen(true);
  };

  return (
    <div style={{ display: "inline-flex", width, maxWidth: width, position: "relative" }}>
      <NeonTrigger
        ref={triggerRef}
        type="button"
        disabled={disabled}
        style={{ maxWidth: width }}
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <span>{cur ? cur.label : placeholder}</span>
        <span className="arr">▼</span>
      </NeonTrigger>
      {open && rect && typeof document !== "undefined" && createPortal(
        <>
          <PortalOverlay onClick={() => setOpen(false)} />
          <PortalPanel
            style={{ top: rect.top, bottom: rect.bottom, left: rect.left, minWidth: rect.width, maxHeight: rect.maxH }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((o) => (
              <NeonItem key={o.value} type="button" $active={o.value === value} onClick={() => { onChange(o.value); setOpen(false); }}>
                {o.label}
              </NeonItem>
            ))}
          </PortalPanel>
        </>,
        document.body
      )}
    </div>
  );
}
