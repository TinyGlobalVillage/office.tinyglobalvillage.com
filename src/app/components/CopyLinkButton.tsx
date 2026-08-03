"use client";

/**
 * Copy a link to whatever you are looking at.
 *
 * The address bar now describes the open tile (see lib/tileUrl), so this is
 * mostly a shortcut — but the tile grid is where you want it: hovering a tile
 * and copying its link is how you send someone to a room you are not currently
 * standing in.
 *
 * Not a <button> by default, because its most common home is INSIDE a tile that
 * is itself a button, and nesting buttons is invalid HTML that browsers resolve
 * by dropping one of them. A span with a button role and a keyboard handler
 * behaves the same for a user and survives being nested.
 */

import { useCallback, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "@/app/theme";
import LinkIcon from "./icons/LinkIcon";

export default function CopyLinkButton({
  url,
  label = "Copy link",
  size = 13,
  className,
}: {
  /** Resolved lazily — the caller passes a getter when the URL depends on state. */
  url: string | (() => string);
  label?: string;
  size?: number;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (e: React.SyntheticEvent) => {
      // The tile underneath would otherwise open — copying a link is not asking
      // to go there.
      e.preventDefault();
      e.stopPropagation();
      const value = typeof url === "function" ? url() : url;
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        // Clipboard is permission-gated and refuses outright in some contexts;
        // the old textarea trick still works where it does.
        const el = document.createElement("textarea");
        el.value = value;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(el);
        }
      }
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    },
    [url],
  );

  return (
    <Btn
      role="button"
      tabIndex={0}
      className={className}
      $copied={copied}
      aria-label={label}
      title={copied ? "Copied" : label}
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") copy(e);
      }}
    >
      {copied ? <Tick>✓</Tick> : <LinkIcon size={size} />}
    </Btn>
  );
}

const Btn = styled.span<{ $copied: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 0.35rem;
  cursor: pointer;
  color: ${(p) => (p.$copied ? colors.green : "var(--t-textFaint)")};
  border: 1px solid ${(p) => (p.$copied ? colors.green : "transparent")};
  background: ${(p) => (p.$copied ? `rgba(${rgb.green}, 0.12)` : "transparent")};
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: ${colors.cyan};
    border-color: rgba(${rgb.cyan}, 0.5);
  }
  &:focus-visible {
    outline: 2px solid rgba(${rgb.cyan}, 0.6);
    outline-offset: 1px;
  }
`;

const Tick = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
`;
