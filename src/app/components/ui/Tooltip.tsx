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

const TooltipArrow = styled.div<{ $accent: string; $flipped: boolean }>`
  position: absolute;
  ${(p) => p.$flipped ? "bottom: -5px;" : "top: -5px;"}
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  background: color-mix(in srgb, ${(p) => p.$accent} 18%, #0a0a12);
  ${(p) => p.$flipped
    ? `
        border-right: 1px solid color-mix(in srgb, ${p.$accent} 55%, transparent);
        border-bottom: 1px solid color-mix(in srgb, ${p.$accent} 55%, transparent);
      `
    : `
        border-left: 1px solid color-mix(in srgb, ${p.$accent} 55%, transparent);
        border-top: 1px solid color-mix(in srgb, ${p.$accent} 55%, transparent);
      `}
`;

const TooltipWrap = styled.span`
  display: contents;
`;

const FALLBACK_ACCENT = "#00e4fd";

const LOW_CONTRAST_COLORS = new Set([
  "rgb(0, 0, 0)",
  "rgba(0, 0, 0, 0)",
  "transparent",
  "rgb(255, 255, 255)",
]);

function readAccentFromTrigger(wrap: HTMLElement | null): string | null {
  if (!wrap) return null;
  let el: HTMLElement | null = wrap.firstElementChild as HTMLElement | null;
  let depth = 0;
  while (el && depth < 4) {
    const cs = getComputedStyle(el);
    const c = cs.color;
    if (c && !LOW_CONTRAST_COLORS.has(c.replace(/\s+/g, " "))) {
      return c;
    }
    el = el.firstElementChild as HTMLElement | null;
    depth++;
  }
  return null;
}

type Props = {
  label: string;
  accent?: string;
  disabled?: boolean;
  children: React.ReactNode;
};

export default function Tooltip({ label, accent, disabled, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number; flipped: boolean; maxWidth: number } | null>(null);
  const [autoAccent, setAutoAccent] = useState<string | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const effectiveAccent = accent ?? autoAccent ?? FALLBACK_ACCENT;

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
    const margin = 8;

    // Cap bubble width to viewport so it never renders off-screen. If the
    // natural width exceeds the cap, the bubble shrinks and its label wraps.
    const maxAllowed = Math.max(80, window.innerWidth - margin * 2);
    const measuredWidth = bubbleRef.current?.offsetWidth ?? Math.max(label.length * 7, 80);
    const bubbleWidth = Math.min(measuredWidth, maxAllowed);
    const bubbleHeight = bubbleRef.current?.offsetHeight ?? 32;

    // Flip above trigger when there isn't room below (e.g. composer icons
    // near the viewport bottom get clipped otherwise).
    const roomBelow = window.innerHeight - r.bottom;
    const needed = bubbleHeight + GAP + margin;
    const flipped = roomBelow < needed && r.top > needed;
    const top = flipped ? r.top - GAP - bubbleHeight : r.bottom + GAP;

    // Horizontal auto-anchor: prefer centering, but when the trigger sits
    // near an edge, bias the bubble toward the side with more room so it
    // stays on-screen without just clamping to a hard margin.
    const roomLeft = anchorX - margin;
    const roomRight = window.innerWidth - anchorX - margin;
    let left: number;
    if (bubbleWidth / 2 <= Math.min(roomLeft, roomRight)) {
      left = anchorX - bubbleWidth / 2;
    } else if (roomRight > roomLeft) {
      left = Math.max(margin, anchorX - bubbleWidth * 0.2);
    } else {
      left = Math.min(window.innerWidth - bubbleWidth - margin, anchorX - bubbleWidth * 0.8);
    }
    const maxLeft = window.innerWidth - bubbleWidth - margin;
    if (left < margin) left = margin;
    if (left > maxLeft) left = maxLeft;
    const arrowLeft = Math.max(6, Math.min(bubbleWidth - 16, anchorX - left - 5));
    setPos({ left, top, arrowLeft, flipped, maxWidth: maxAllowed });
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
    if (!accent) {
      const sniffed = readAccentFromTrigger(triggerRef.current);
      if (sniffed) setAutoAccent(sniffed);
    }
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
            $accent={effectiveAccent}
            style={{ left: pos.left, top: pos.top, maxWidth: pos.maxWidth, whiteSpace: "normal" }}
          >
            <TooltipArrow $accent={effectiveAccent} $flipped={pos.flipped} style={{ left: pos.arrowLeft }} />
            {label}
          </TooltipBubble>,
          portalTarget,
        )}
    </>
  );
}
