"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";

const GAP = 10;

const TooltipBubble = styled.div<{ $accent: string }>`
  --acc: ${(p) => p.$accent};
  --acc-text: color-mix(in srgb, var(--acc) 55%, white 45%);
  --acc-border: color-mix(in srgb, var(--acc) 55%, transparent);
  --acc-glow: color-mix(in srgb, var(--acc) 30%, transparent);
  --bg-top: color-mix(in srgb, var(--acc) 18%, #0a0a12);
  --bg-bottom: color-mix(in srgb, var(--acc) 6%, #05050a);
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  line-height: 1.3;
  white-space: nowrap;
  background: linear-gradient(160deg, var(--bg-top), var(--bg-bottom));
  border: 1px solid var(--acc-border);
  color: var(--acc-text);
  box-shadow:
    0 10px 30px -8px rgba(0, 0, 0, 0.6),
    0 0 24px -6px var(--acc-glow);
  animation: tt-in 0.14s ease-out;

  @keyframes tt-in {
    from { opacity: 0; transform: translateY(-3px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const TooltipArrow = styled.div<{ $accent: string }>`
  position: absolute;
  top: -5px;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  background: color-mix(in srgb, ${(p) => p.$accent} 18%, #0a0a12);
  border-left: 1px solid color-mix(in srgb, ${(p) => p.$accent} 55%, transparent);
  border-top: 1px solid color-mix(in srgb, ${(p) => p.$accent} 55%, transparent);
`;

const TooltipWrap = styled.span`
  display: contents;
`;

type Props = {
  label: string;
  accent?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function Tooltip({ label, accent = "#00e4fd", disabled, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoHide(), [clearAutoHide]);

  const computePosition = useCallback(() => {
    const wrap = triggerRef.current;
    if (!wrap) return;
    // TooltipWrap is display:contents, so its own rect is empty. Measure the
    // rendered child instead — the actual trigger element (button, icon, etc.)
    const child = wrap.firstElementChild as HTMLElement | null;
    const el: HTMLElement | null = child ?? wrap;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return; // trigger not laid out yet
    const anchorX = r.left + r.width / 2;
    const top = r.bottom + GAP;
    const bubbleWidth = bubbleRef.current?.offsetWidth ?? Math.max(label.length * 7, 80);
    let left = anchorX - bubbleWidth / 2;
    const margin = 8;
    const maxLeft = window.innerWidth - bubbleWidth - margin;
    if (left < margin) left = margin;
    if (left > maxLeft) left = maxLeft;
    const arrowLeft = Math.max(6, Math.min(bubbleWidth - 16, anchorX - left - 5));
    setPos({ left, top, arrowLeft });
  }, [label]);

  useEffect(() => {
    if (!open) return;
    computePosition();
    const handler = () => computePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (open) computePosition();
  }, [open, label, computePosition]);

  const show = () => {
    if (disabled) return;
    setOpen(true);
    clearAutoHide();
    autoHideTimerRef.current = setTimeout(() => setOpen(false), 2000);
  };
  const hide = () => {
    clearAutoHide();
    setOpen(false);
  };

  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <TooltipWrap
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={hide}
        onTouchEnd={hide}
      >
        {children}
      </TooltipWrap>
      {open && pos && portalTarget &&
        createPortal(
          <TooltipBubble
            ref={bubbleRef}
            role="tooltip"
            $accent={accent}
            style={{ left: pos.left, top: pos.top }}
          >
            <TooltipArrow $accent={accent} style={{ left: pos.arrowLeft }} />
            {label}
          </TooltipBubble>,
          portalTarget,
        )}
    </>
  );
}
