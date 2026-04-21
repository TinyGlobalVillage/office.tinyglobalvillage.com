"use client";

import { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";

export type NeonLineDDMOption = {
  id: string;
  label: string;
  sublabel?: string;
  meta?: string;
};

const Wrap = styled.div`
  position: relative;
  width: 100%;
`;

const Trigger = styled.button<{ $open: boolean; $disabled?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.55rem 0.85rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.5);
  background: ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.14)` : `rgba(${rgb.gold}, 0.06)`)};
  border: 1px solid rgba(${rgb.gold}, ${(p) => (p.$open ? 0.6 : 0.3)});
  border-radius: 0.5rem;
  cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
  opacity: ${(p) => (p.$disabled ? 0.5 : 1)};
  outline: none;
  transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;

  &:hover:not(:disabled) {
    background: rgba(${rgb.gold}, 0.14);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.3);
  }
  &:focus-visible {
    border-color: rgba(${rgb.gold}, 0.65);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.3);
  }

  [data-theme="light"] & {
    text-shadow: none;
    color: #a87a00;
  }
`;

const TriggerLabel = styled.span`
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const TriggerArrow = styled.span<{ $open: boolean }>`
  font-size: 10px;
  transition: transform 0.18s;
  transform: ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
  opacity: 0.85;
`;

const Panel = styled.ul`
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 90;
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  border-radius: 0.55rem;
  max-height: 18rem;
  overflow-y: auto;
  background: #1a1408;
  border: 1px solid rgba(${rgb.gold}, 0.45);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.65), 0 0 18px rgba(${rgb.gold}, 0.25);

  [data-theme="light"] & {
    background: #fff6dd;
    border-color: rgba(${rgb.gold}, 0.35);
  }
`;

const Item = styled.li<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.5);
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.22)` : "transparent")};
  border: 1px solid ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.5)` : "transparent")};
  transition: background 0.1s, border-color 0.1s;

  &:hover {
    background: rgba(${rgb.gold}, 0.18);
    border-color: rgba(${rgb.gold}, 0.4);
  }

  & + & {
    margin-top: 2px;
  }

  [data-theme="light"] & {
    text-shadow: none;
    color: #a87a00;
  }
`;

const ItemLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const ItemMeta = styled.span`
  font-size: 0.6875rem;
  opacity: 0.8;
  letter-spacing: 0.03em;
  white-space: nowrap;
`;

const Check = styled.span`
  color: ${colors.gold};
  font-weight: 900;
`;

export default function NeonLineDDM(props: {
  options: NeonLineDDMOption[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  title?: string;
}) {
  const { options, value, onChange, disabled, placeholder = "Select…", title } = props;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <Wrap ref={ref}>
      <Trigger
        type="button"
        $open={open}
        $disabled={disabled}
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <TriggerLabel>
          {selected ? (
            <>
              {selected.label}
              {selected.sublabel && <> — {selected.sublabel}</>}
            </>
          ) : (
            placeholder
          )}
        </TriggerLabel>
        <TriggerArrow $open={open}>▾</TriggerArrow>
      </Trigger>
      {open && (
        <Panel role="listbox">
          {options.map(o => (
            <Item
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              $active={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
            >
              <ItemLabel>
                {o.label}
                {o.sublabel && <> — {o.sublabel}</>}
              </ItemLabel>
              {o.meta && <ItemMeta>{o.meta}</ItemMeta>}
              {o.id === value && <Check>✓</Check>}
            </Item>
          ))}
        </Panel>
      )}
    </Wrap>
  );
}
