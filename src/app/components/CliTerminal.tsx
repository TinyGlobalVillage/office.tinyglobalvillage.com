"use client";

import {
  useEffect, useRef, useState, KeyboardEvent, FormEvent, useCallback
} from "react";
import styled, { css, keyframes } from "styled-components";
import { useTerminal, TerminalLine } from "./TerminalProvider";
import { colors, rgb } from "../theme";

// ── Colour map ────────────────────────────────────────────────────────────────
const LINE_COLOR: Record<string, string> = {
  out:  "#d4d4d4",
  err:  "#ff6b6b",
  info: "#00bfff",
  exit: "#4ade80",
  log:  "#888",
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type PanelPos = "bottom" | "right" | "left" | "float";
type PanelMode = "shell" | "stream" | "logs" | "claude";

type ClaudeMessage = { role: "user" | "assistant"; content: string };
type ClaudeLine    = { role: "user" | "assistant"; text: string; streaming?: boolean };

// ── Animations ────────────────────────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

// ── Styled components ─────────────────────────────────────────────────────────

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
`;

const ToggleButton = styled.button<{ $running: boolean }>`
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  box-shadow: ${({ $running }) =>
    $running
      ? `0 0 16px rgba(${rgb.gold}, 0.6)`
      : `0 0 16px rgba(${rgb.pink}, 0.5)`};
  background: ${({ $running }) =>
    $running
      ? `linear-gradient(135deg, ${colors.gold}, #ff9900)`
      : `linear-gradient(135deg, ${colors.pink}, #7b2ff7)`};
  color: #fff;
  border: none;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
  }

  [data-theme="light"] & {
    box-shadow: ${({ $running }) =>
      $running
        ? `0 0 16px rgba(${rgb.gold}, 0.4)`
        : `0 0 16px rgba(${rgb.pink}, 0.35)`};
  }

  body[data-dashboard-modal="open"][data-dashboard-sidebar="hidden"] & {
    display: none;
  }

  body[data-editor-dock="open"] &,
  body[data-editor-dock="closed"] & {
    display: none;
  }
`;

const ToggleIcon = styled.span`
  font-family: monospace;
  font-size: 14px;
`;

const LineBadge = styled.span`
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  padding: 2px 6px;
  font-size: 10px;
`;

const PanelContainer = styled.div`
  position: relative;
  background: rgba(4, 5, 8, 0.98);

  [data-theme="light"] & {
    background: var(--t-bg);
  }
`;

const ResizeHandleBottom = styled.div`
  flex-shrink: 0;
  height: 6px;
  width: 100%;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ResizeBar = styled.div<{ $orientation: "h" | "v" }>`
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.15);
  transition: background 0.15s;

  ${({ $orientation }) =>
    $orientation === "h"
      ? css`width: 48px; height: 2px;`
      : css`height: 48px; width: 2px;`}

  ${ResizeHandleBottom}:hover &,
  *:hover > & {
    background: rgba(${rgb.pink}, 0.6);
  }

  [data-theme="light"] & {
    background: var(--t-border);
  }
`;

const ResizeHandleSide = styled.div<{ $side: "left" | "right" }>`
  position: absolute;
  ${({ $side }) => ($side === "left" ? "left: 0;" : "right: 0;")}
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FloatEdge = styled.div<{ $cursor: string; $inset: string }>`
  position: absolute;
  ${({ $inset }) => $inset}
  cursor: ${({ $cursor }) => $cursor};
  z-index: 10;
`;

const FloatCorner = styled.div<{ $cursor: string; $pos: string }>`
  position: absolute;
  ${({ $pos }) => $pos}
  width: 12px;
  height: 12px;
  cursor: ${({ $cursor }) => $cursor};
  z-index: 20;
`;

const FloatTitleBar = styled.div`
  flex-shrink: 0;
  height: 24px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  gap: 8px;
  cursor: move;
  user-select: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const FloatTitleText = styled.span`
  font-size: 9px;
  font-family: monospace;
  letter-spacing: 0.1em;
  color: rgba(${rgb.pink}, 0.35);

  [data-theme="light"] & {
    color: ${colors.pink};
  }
`;

const FloatTitleHint = styled.span`
  font-size: 9px;
  color: rgba(255, 255, 255, 0.1);

  [data-theme="light"] & {
    color: var(--t-textGhost);
  }
`;

const TabBar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  flex-shrink: 0;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const TabBarPrefix = styled.span`
  font-size: 10px;
  font-family: monospace;
  color: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  margin-right: 4px;

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const TabPill = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  background: ${({ $active }) =>
    $active ? `rgba(${rgb.pink}, 0.15)` : "transparent"};
  border: 1px solid
    ${({ $active }) =>
      $active ? `rgba(${rgb.pink}, 0.35)` : "rgba(255, 255, 255, 0.07)"};
  border-radius: 6px;
  padding: 2px 6px;

  [data-theme="light"] & {
    background: ${({ $active }) =>
      $active ? `rgba(${rgb.pink}, 0.1)` : "transparent"};
    border-color: ${({ $active }) =>
      $active ? colors.pink : "var(--t-border)"};
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  font-size: 10px;
  font-weight: 700;
  white-space: nowrap;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: ${({ $active }) =>
    $active ? colors.pink : "rgba(255, 255, 255, 0.3)"};

  [data-theme="light"] & {
    color: ${({ $active }) =>
      $active ? colors.pink : "var(--t-textMuted)"};
  }
`;

const TabLineCount = styled.span`
  margin-left: 4px;
  opacity: 0.5;
`;

const TabCloseBtn = styled.button`
  font-size: 9px;
  color: rgba(255, 255, 255, 0.2);
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 2px;
  transition: color 0.15s;

  &:hover {
    color: ${colors.red};
  }

  [data-theme="light"] & {
    color: var(--t-textGhost);
    &:hover {
      color: ${colors.red};
    }
  }
`;

const AddTabBtn = styled.button`
  flex-shrink: 0;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.25);
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 4px;
  padding: 2px 6px;
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: ${colors.cyan};
  }

  [data-theme="light"] & {
    color: var(--t-textGhost);
    border-color: var(--t-border);
    &:hover {
      color: ${colors.cyan};
    }
  }
`;

const Divider = styled.div<{ $h?: number }>`
  width: 1px;
  height: ${({ $h }) => $h ?? 16}px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
  flex-shrink: 0;

  [data-theme="light"] & {
    background: var(--t-border);
  }
`;

const ModeButton = styled.button<{ $active: boolean; $claude?: boolean }>`
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $active, $claude }) =>
    $active
      ? $claude
        ? "rgba(139, 92, 246, 0.2)"
        : "rgba(0, 191, 255, 0.15)"
      : "transparent"};
  border: 1px solid
    ${({ $active, $claude }) =>
      $active
        ? $claude
          ? "rgba(139, 92, 246, 0.5)"
          : "rgba(0, 191, 255, 0.3)"
        : "rgba(255, 255, 255, 0.07)"};
  color: ${({ $active, $claude }) =>
    $active
      ? $claude
        ? "#a78bfa"
        : "#00bfff"
      : "rgba(255, 255, 255, 0.25)"};

  [data-theme="light"] & {
    color: ${({ $active, $claude }) =>
      $active
        ? $claude
          ? "#7c3aed"
          : colors.cyan
        : "var(--t-textMuted)"};
    border-color: ${({ $active, $claude }) =>
      $active
        ? $claude
          ? "#7c3aed"
          : colors.cyan
        : "var(--t-border)"};
    background: ${({ $active, $claude }) =>
      $active
        ? $claude
          ? "rgba(139, 92, 246, 0.08)"
          : "rgba(0, 212, 255, 0.08)"
        : "transparent"};
  }
`;

const KillButton = styled.button`
  font-size: 12px;
  font-family: monospace;
  color: ${colors.red};
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  margin-right: 4px;

  &:hover {
    color: #ff6b6b;
  }
`;

const ClearButton = styled.button`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  margin-right: 4px;
  transition: color 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  [data-theme="light"] & {
    color: var(--t-textMuted);
    &:hover {
      color: var(--t-text);
    }
  }
`;

const PosButton = styled.button<{ $active: boolean }>`
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
  background: ${({ $active }) =>
    $active ? `rgba(${rgb.pink}, 0.12)` : "transparent"};
  color: ${({ $active }) =>
    $active ? colors.pink : "rgba(255, 255, 255, 0.2)"};
  border: none;
  cursor: pointer;
  transition: all 0.15s;

  [data-theme="light"] & {
    color: ${({ $active }) =>
      $active ? colors.pink : "var(--t-textMuted)"};
  }
`;

const PopoutButton = styled.button`
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 4px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.2);
  background: none;
  border: none;
  cursor: pointer;
  margin-left: 2px;
  transition: color 0.15s;

  &:hover {
    color: ${colors.cyan};
  }

  [data-theme="light"] & {
    color: var(--t-textMuted);
    &:hover {
      color: ${colors.cyan};
    }
  }
`;

const MinimizeButton = styled.button`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
  background: none;
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.6);
  }

  [data-theme="light"] & {
    color: var(--t-textMuted);
    &:hover {
      color: var(--t-text);
    }
  }
`;

const LogControls = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  flex-shrink: 0;
  flex-wrap: wrap;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);

  [data-theme="light"] & {
    border-bottom-color: var(--t-border);
  }
`;

const LogLabel = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const LogSelect = styled.select`
  font-size: 12px;
  font-family: monospace;
  border-radius: 4px;
  padding: 4px 8px;
  outline: none;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(0, 191, 255, 0.2);
  color: #d4d4d4;

  [data-theme="light"] & {
    background: var(--t-inputBg);
    border-color: var(--t-border);
    color: var(--t-text);
  }
`;

const LogInfo = styled.span`
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const LogLoading = styled.span`
  font-size: 10px;
  color: rgba(${rgb.gold}, 0.7);
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
`;

const LogPageBtn = styled.button`
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.4);
  background: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: ${colors.cyan};
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  [data-theme="light"] & {
    color: var(--t-textMuted);
    border-color: var(--t-border);
    &:hover:not(:disabled) {
      color: ${colors.cyan};
    }
  }
`;

const OutputArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.65;
  scrollbar-width: thin;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const EmptyHint = styled.span`
  color: rgba(255, 255, 255, 0.2);

  [data-theme="light"] & {
    color: var(--t-textGhost);
  }
`;

const ClaudeEmptyWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: rgba(255, 255, 255, 0.2);

  [data-theme="light"] & {
    color: var(--t-textGhost);
  }
`;

const ClaudeEmptyIcon = styled.span`
  font-size: 16px;
`;

const ClaudeEmptyContext = styled.p`
  font-size: 10px;
`;

const ClaudeRow = styled.div<{ $user: boolean }>`
  margin-bottom: 12px;
  ${({ $user }) => $user && "display: flex; justify-content: flex-end;"}
`;

const ClaudeUserBubble = styled.div`
  max-width: 85%;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  background: rgba(139, 92, 246, 0.2);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: #e2d9f3;

  [data-theme="light"] & {
    background: rgba(139, 92, 246, 0.08);
    border-color: rgba(139, 92, 246, 0.25);
    color: #4c1d95;
  }
`;

const ClaudeAssistantWrap = styled.div`
  font-size: 11px;
  line-height: 1.625;
  color: #d4d4d4;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const ClaudeLabel = styled.span`
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-right: 8px;
  color: #a78bfa;

  [data-theme="light"] & {
    color: #7c3aed;
  }
`;

const ClaudeCursor = styled.span`
  display: inline-block;
  margin-left: 2px;
  animation: ${pulse} 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  color: #a78bfa;

  [data-theme="light"] & {
    color: #7c3aed;
  }
`;

const ClearConvoBtn = styled.button`
  font-size: 9px;
  color: rgba(255, 255, 255, 0.15);
  background: none;
  border: none;
  cursor: pointer;
  margin-top: 4px;
  transition: color 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.4);
  }

  [data-theme="light"] & {
    color: var(--t-textGhost);
    &:hover {
      color: var(--t-textMuted);
    }
  }
`;

const LogLine = styled.div`
  color: rgba(255, 255, 255, 0.5);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.375;

  [data-theme="light"] & {
    color: var(--t-textMuted);
  }
`;

const RunningCursor = styled.span`
  display: inline-block;
  margin-top: 4px;
  color: ${colors.gold};
`;

const InputBar = styled.form<{ $claude: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  flex-shrink: 0;
  border-top: 1px solid
    ${({ $claude }) =>
      $claude ? "rgba(139, 92, 246, 0.15)" : "rgba(255, 255, 255, 0.06)"};

  [data-theme="light"] & {
    border-top-color: var(--t-border);
  }
`;

const ShellPrompt = styled.span`
  font-family: monospace;
  font-size: 12px;
  flex-shrink: 0;
  color: #4ade80;

  [data-theme="light"] & {
    color: ${colors.green};
  }
`;

const ClaudePrompt = styled.span`
  font-family: monospace;
  font-size: 12px;
  flex-shrink: 0;
  color: #a78bfa;

  [data-theme="light"] & {
    color: #7c3aed;
  }
`;

const CommandInput = styled.input`
  flex: 1;
  background: transparent;
  outline: none;
  font-family: monospace;
  font-size: 12px;
  color: #fff;
  border: none;

  &::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  &:disabled {
    opacity: 0.4;
  }

  [data-theme="light"] & {
    color: var(--t-text);
    &::placeholder {
      color: var(--t-textGhost);
    }
  }
`;

const SubmitBtn = styled.button<{ $claude: boolean }>`
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  background: ${({ $claude }) =>
    $claude ? "rgba(139, 92, 246, 0.15)" : "rgba(74, 222, 128, 0.12)"};
  border: 1px solid
    ${({ $claude }) =>
      $claude ? "rgba(139, 92, 246, 0.4)" : "rgba(74, 222, 128, 0.3)"};
  color: ${({ $claude }) => ($claude ? "#a78bfa" : "#4ade80")};

  &:disabled {
    opacity: 0.2;
    cursor: default;
  }

  [data-theme="light"] & {
    color: ${({ $claude }) => ($claude ? "#7c3aed" : colors.green)};
    border-color: ${({ $claude }) =>
      $claude ? "#7c3aed" : colors.green};
    background: ${({ $claude }) =>
      $claude ? "rgba(139, 92, 246, 0.08)" : `rgba(${rgb.green}, 0.08)`};
  }
`;

// ── Markdown sub-components ───────────────────────────────────────────────────

const MdCodeBlock = styled.pre`
  margin: 8px 0;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 10px;
  overflow-x: auto;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #d4d4d4;

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: var(--t-border);
    color: var(--t-text);
  }
`;

const MdCodeLang = styled.div`
  font-size: 9px;
  color: rgba(255, 255, 255, 0.3);
  margin-bottom: 4px;
  font-weight: 700;
  text-transform: uppercase;

  [data-theme="light"] & {
    color: var(--t-textFaint);
  }
`;

const MdInlineCode = styled.code`
  padding: 0 4px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.35);
  color: #f7b700;

  [data-theme="light"] & {
    background: var(--t-surface);
    color: #b45309;
  }
`;

const MdBold = styled.strong`
  color: #fff;

  [data-theme="light"] & {
    color: var(--t-text);
  }
`;

const Spacer = styled.div`
  flex: 1;
`;

// ── Minimal markdown renderer for Claude responses ────────────────────────────
function ClaudeMarkdown({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const nl = part.indexOf("\n");
          const lang = nl > 3 ? part.slice(3, nl).trim() : "";
          const code = nl > 0 ? part.slice(nl + 1, -3) : part.slice(3, -3);
          return (
            <MdCodeBlock key={i}>
              {lang && <MdCodeLang>{lang}</MdCodeLang>}
              {code}
            </MdCodeBlock>
          );
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <MdInlineCode key={i}>{part.slice(1, -1)}</MdInlineCode>;
        }
        return (
          <span key={i}>
            {part.split("\n").map((line, j, arr) => {
              const bold = line.split(/(\*\*[^*]+\*\*)/g).map((seg, k) =>
                seg.startsWith("**") && seg.endsWith("**")
                  ? <MdBold key={k}>{seg.slice(2, -2)}</MdBold>
                  : seg
              );
              return (
                <span key={j}>
                  {bold}
                  {j < arr.length - 1 && <br />}
                </span>
              );
            })}
          </span>
        );
      })}
    </>
  );
}

const POS_META: Record<PanelPos, { icon: string; title: string }> = {
  bottom: { icon: "⬇", title: "Dock bottom" },
  right:  { icon: "▶", title: "Dock right"  },
  left:   { icon: "◀", title: "Dock left"   },
  float:  { icon: "⧉", title: "Float"       },
};

// ── Live server-stream hook ───────────────────────────────────────────────────
function useServerStream(active: boolean) {
  const [streamLines, setStreamLines] = useState<TerminalLine[]>([]);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!active) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch("/api/terminal/stream", { signal: ctrl.signal });
        if (!res.ok) return;
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (chunk.startsWith(":")) continue;
            const raw = chunk.replace(/^data: /, "").trim();
            if (!raw) continue;
            try {
              const { text } = JSON.parse(raw) as { ts: number; text: string };
              setStreamLines((p) => {
                const next = [...p, { type: "log" as const, text, ts: Date.now() }];
                return next.length > 2000 ? next.slice(-2000) : next;
              });
            } catch { /* skip */ }
          }
        }
      } catch { /* aborted */ }
    })();

    return () => ctrl.abort();
  }, [active]);

  return streamLines;
}

// ── Log browser hook ──────────────────────────────────────────────────────────
type LogMeta = { date: string; bytes: number };

function useLogBrowser() {
  const [dates, setDates]               = useState<LogMeta[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [lines, setLines]               = useState<string[]>([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);

  useEffect(() => {
    fetch("/api/logs")
      .then((r) => r.json())
      .then((d: { dates: LogMeta[] }) => {
        setDates(d.dates ?? []);
        if (d.dates?.length) setSelectedDate(d.dates[0].date);
      })
      .catch(() => {});
  }, []);

  const load = useCallback((date: string, p: number) => {
    setLoading(true);
    fetch(`/api/logs?date=${date}&page=${p}&limit=200`)
      .then((r) => r.json())
      .then((d: { lines: string[]; totalPages: number; total: number; page: number }) => {
        setLines(d.lines ?? []);
        setTotalPages(d.totalPages ?? 1);
        setTotal(d.total ?? 0);
        setPage(d.page ?? 1);
      })
      .catch(() => { setLines([]); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedDate) { setPage(1); load(selectedDate, 1); }
  }, [selectedDate, load]);

  return {
    dates, selectedDate, setSelectedDate,
    lines, page, totalPages, total, loading,
    goPage: (p: number) => { if (selectedDate) load(selectedDate, p); },
  };
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CliTerminal({ standalone = false }: { standalone?: boolean }) {
  const {
    tabs, activeTabId, setActiveTabId, addTab, closeTab,
    lines, isOpen, isRunning, currentScript,
    toggleTerminal, clearTerminal, killCommand, runShell,
  } = useTerminal();

  const [mode,       setMode]       = useState<PanelMode>("shell");
  const [inputValue, setInputValue] = useState("");
  const [histIdx,    setHistIdx]    = useState(-1);
  const [pos,        setPos]        = useState<PanelPos>("bottom");
  const [height,     setHeight]     = useState(380);
  const [width,      setWidth]      = useState(520);
  const [floatRect,  setFloatRect]  = useState({ x: 80, y: 80, w: 740, h: 500 });

  const [claudeLines,    setClaudeLines]    = useState<ClaudeLine[]>([]);
  const [claudeHistory,  setClaudeHistory]  = useState<ClaudeMessage[]>([]);
  const [claudeStreaming, setClaudeStreaming] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const open = standalone || isOpen;

  const streamLines = useServerStream(open);
  const logBrowser  = useLogBrowser();

  const displayLines = mode === "stream" ? streamLines : lines;

  // Persist position preference
  useEffect(() => {
    const saved = localStorage.getItem("tgv-terminal-pos") as PanelPos | null;
    if (saved && saved in POS_META) setPos(saved);
    const savedFloat = localStorage.getItem("tgv-terminal-float");
    if (savedFloat) { try { setFloatRect(JSON.parse(savedFloat)); } catch { /* ignore */ } }
  }, []);
  useEffect(() => { localStorage.setItem("tgv-terminal-pos", pos); }, [pos]);
  useEffect(() => { localStorage.setItem("tgv-terminal-float", JSON.stringify(floatRect)); }, [floatRect]);

  // Auto-scroll
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [displayLines, open, mode]);

  // Focus input on open
  useEffect(() => {
    if (open && mode === "shell") setTimeout(() => inputRef.current?.focus(), 80);
  }, [open, mode]);

  // ESC to close
  useEffect(() => {
    if (standalone) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) toggleTerminal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, standalone, toggleTerminal]);

  // ── Resize: bottom edge ──────────────────────────────────────────────────
  const onBottomDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const start = { y: e.clientY, h: height };
    const onMove = (ev: MouseEvent) => {
      const delta = start.y - ev.clientY;
      setHeight(Math.max(220, Math.min(window.innerHeight * 0.85, start.h + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Resize: side panels ──────────────────────────────────────────────────
  const onSideDrag = (e: React.MouseEvent, edge: "left" | "right") => {
    e.preventDefault();
    const start = { x: e.clientX, w: width };
    const onMove = (ev: MouseEvent) => {
      const delta = edge === "right" ? ev.clientX - start.x : start.x - ev.clientX;
      setWidth(Math.max(300, Math.min(window.innerWidth * 0.75, start.w + delta)));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Drag: float window ──────────────────────────────────────────────────
  const onFloatDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select")) return;
    e.preventDefault();
    const start = { mx: e.clientX, my: e.clientY, fx: floatRect.x, fy: floatRect.y };
    const onMove = (ev: MouseEvent) => {
      setFloatRect((r) => ({
        ...r,
        x: Math.max(0, Math.min(window.innerWidth  - r.w, start.fx + ev.clientX - start.mx)),
        y: Math.max(0, Math.min(window.innerHeight - r.h, start.fy + ev.clientY - start.my)),
      }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Resize: float window (8-direction) ──────────────────────────────────
  type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
  const onFloatResize = (e: React.MouseEvent, dir: ResizeDir) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { mx: e.clientX, my: e.clientY, ...floatRect };
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - start.mx;
      const dy = ev.clientY - start.my;
      setFloatRect(() => {
        let { x, y, w, h } = start;
        if (dir.includes("e")) w = Math.max(400, start.w + dx);
        if (dir.includes("s")) h = Math.max(220, start.h + dy);
        if (dir.includes("w")) { w = Math.max(400, start.w - dx); x = start.x + (start.w - w); }
        if (dir.includes("n")) { h = Math.max(220, start.h - dy); y = start.y + (start.h - h); }
        return { x, y, w, h };
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ── Pop out ──────────────────────────────────────────────────────────────
  const handlePopout = () => {
    window.open(
      "/terminal-popout",
      "tgv-terminal",
      "width=960,height=640,menubar=no,toolbar=no,location=no,status=no,resizable=yes"
    );
  };

  // ── Panel container style (dynamic positioning) ──────────────────────────
  const panelStyle: React.CSSProperties = standalone
    ? { position: "fixed", inset: 0, zIndex: 40, display: "flex", flexDirection: "column" }
    : pos === "bottom"
    ? {
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
        height: `${height}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderTop: `1px solid rgba(${rgb.pink}, 0.2)`,
      }
    : pos === "right"
    ? {
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 40,
        width: `${width}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderLeft: `1px solid rgba(${rgb.pink}, 0.2)`,
      }
    : pos === "left"
    ? {
        position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 40,
        width: `${width}px`, display: "flex", flexDirection: "column",
        transform: open ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        borderRight: `1px solid rgba(${rgb.pink}, 0.2)`,
      }
    : {
        position: "fixed",
        top:    `${floatRect.y}px`,
        left:   `${floatRect.x}px`,
        width:  `${floatRect.w}px`,
        height: `${floatRect.h}px`,
        zIndex: 40,
        display: open ? "flex" : "none",
        flexDirection: "column",
        borderRadius: 10,
        border: `1px solid rgba(${rgb.pink}, 0.3)`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.85)",
      };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.trim();
    if (!cmd) return;
    setInputValue("");
    if (mode === "claude") {
      await sendToClaude(cmd);
    } else {
      if (isRunning) return;
      setHistIdx(-1);
      await runShell(cmd);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hist = activeTab?.history ?? [];
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(histIdx + 1, hist.length - 1);
      setHistIdx(next);
      setInputValue(hist[next] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) { setHistIdx(-1); setInputValue(""); }
      else { setHistIdx(next); setInputValue(hist[next] ?? ""); }
    }
  };

  // ── Claude chat ──────────────────────────────────────────────────────────
  const sendToClaude = useCallback(async (userText: string) => {
    if (!userText.trim() || claudeStreaming) return;

    const newHistory: ClaudeMessage[] = [...claudeHistory, { role: "user", content: userText }];
    setClaudeHistory(newHistory);
    setClaudeLines((prev) => [...prev, { role: "user", text: userText }]);
    setClaudeStreaming(true);

    setClaudeLines((prev) => [...prev, { role: "assistant", text: "", streaming: true }]);

    try {
      const res = await fetch("/api/terminal/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newHistory }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        setClaudeLines((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", text: err.error ?? "Error", streaming: false };
          return next;
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const chunks = buf.split("\n\n");
        buf = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const raw = chunk.replace(/^data: /, "").trim();
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw) as { text?: string; error?: string };
            if (parsed.error) {
              fullText += `\n[Error: ${parsed.error}]`;
            } else if (parsed.text) {
              fullText += parsed.text;
            }
            setClaudeLines((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", text: fullText, streaming: true };
              return next;
            });
          } catch { /* skip */ }
        }
      }

      setClaudeLines((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: fullText, streaming: false };
        return next;
      });
      setClaudeHistory((prev) => [...prev, { role: "assistant", content: fullText }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setClaudeLines((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", text: `[Error: ${msg}]`, streaming: false };
        return next;
      });
    } finally {
      setClaudeStreaming(false);
    }
  }, [claudeHistory, claudeStreaming]);

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Click-outside backdrop */}
      {!standalone && isOpen && (
        <Backdrop onClick={toggleTerminal} aria-hidden="true" />
      )}

      {/* Floating toggle button */}
      {!standalone && (
        <ToggleButton onClick={toggleTerminal} title="Toggle Terminal" $running={isRunning}>
          <ToggleIcon>{isRunning ? "●" : ">_"}</ToggleIcon>
          {isRunning ? `${currentScript?.slice(0, 18) ?? "running"}…` : isOpen ? "Hide" : "Terminal"}
          {!isOpen && lines.length > 0 && !isRunning && (
            <LineBadge>{lines.length}</LineBadge>
          )}
        </ToggleButton>
      )}

      {/* ── Terminal panel ────────────────────────────────────────────── */}
      <PanelContainer
        style={{
          ...panelStyle,
          boxShadow: pos !== "float" && !standalone
            ? "0 -8px 40px rgba(0,0,0,0.7)"
            : panelStyle.boxShadow,
        }}
      >

        {/* ── Resize handles ───────────────────────────────────────── */}
        {!standalone && pos === "bottom" && (
          <ResizeHandleBottom onMouseDown={onBottomDrag}>
            <ResizeBar $orientation="h" />
          </ResizeHandleBottom>
        )}
        {!standalone && pos === "right" && (
          <ResizeHandleSide $side="left" onMouseDown={(e) => onSideDrag(e, "right")}>
            <ResizeBar $orientation="v" />
          </ResizeHandleSide>
        )}
        {!standalone && pos === "left" && (
          <ResizeHandleSide $side="right" onMouseDown={(e) => onSideDrag(e, "left")}>
            <ResizeBar $orientation="v" />
          </ResizeHandleSide>
        )}
        {!standalone && pos === "float" && (
          <>
            <FloatEdge $cursor="n-resize" $inset="inset: 0 8px auto 8px; height: 6px;" onMouseDown={(e) => onFloatResize(e, "n")} />
            <FloatEdge $cursor="s-resize" $inset="inset: auto 8px 0 8px; height: 6px;" onMouseDown={(e) => onFloatResize(e, "s")} />
            <FloatEdge $cursor="w-resize" $inset="inset: 8px auto 8px 0; width: 6px;" onMouseDown={(e) => onFloatResize(e, "w")} />
            <FloatEdge $cursor="e-resize" $inset="inset: 8px 0 8px auto; width: 6px;" onMouseDown={(e) => onFloatResize(e, "e")} />
            <FloatCorner $cursor="nw-resize" $pos="top: 0; left: 0;" onMouseDown={(e) => onFloatResize(e, "nw")} />
            <FloatCorner $cursor="ne-resize" $pos="top: 0; right: 0;" onMouseDown={(e) => onFloatResize(e, "ne")} />
            <FloatCorner $cursor="sw-resize" $pos="bottom: 0; left: 0;" onMouseDown={(e) => onFloatResize(e, "sw")} />
            <FloatCorner $cursor="se-resize" $pos="bottom: 0; right: 0;" onMouseDown={(e) => onFloatResize(e, "se")} />
          </>
        )}

        {/* ── Float drag-move title bar ────────────────────────────── */}
        {!standalone && pos === "float" && (
          <FloatTitleBar onMouseDown={onFloatDrag}>
            <FloatTitleText>&#x2807; TGV TERMINAL</FloatTitleText>
            <Spacer />
            <FloatTitleHint>drag to move</FloatTitleHint>
          </FloatTitleBar>
        )}

        {/* ── Tab / mode bar ───────────────────────────────────────── */}
        <TabBar>
          <TabBarPrefix>&#x25B8;</TabBarPrefix>

          {/* Shell tabs */}
          {tabs.map((tab) => (
            <TabPill key={tab.id} $active={tab.id === activeTabId}>
              <TabButton
                onClick={() => { setActiveTabId(tab.id); setMode("shell"); }}
                title={`Switch to ${tab.label}`}
                $active={tab.id === activeTabId}
              >
                {tab.label}
                {tab.lines.length > 0 && (
                  <TabLineCount>{tab.lines.length}</TabLineCount>
                )}
              </TabButton>
              {tabs.length > 1 && (
                <TabCloseBtn onClick={() => closeTab(tab.id)} title="Close tab">
                  &#x2715;
                </TabCloseBtn>
              )}
            </TabPill>
          ))}

          <AddTabBtn onClick={addTab} title="New terminal tab">+</AddTabBtn>

          <Divider />

          {/* Mode buttons */}
          {([
            { id: "shell",  label: ">_ shell",   title: "Interactive shell" },
            { id: "stream", label: "📡 stream",  title: "Live server feed"  },
            { id: "logs",   label: "📋 logs",    title: "Browse saved logs" },
            { id: "claude", label: "✦ claude",   title: "Chat with Claude"  },
          ] as { id: PanelMode; label: string; title: string }[]).map(({ id, label, title }) => (
            <ModeButton
              key={id}
              onClick={() => setMode(id)}
              title={title}
              $active={mode === id}
              $claude={id === "claude"}
            >
              {label}
            </ModeButton>
          ))}

          <Spacer />

          {/* Running indicator */}
          {isRunning && (
            <KillButton onClick={killCommand} title="Kill running command">
              &#x2298; Kill
            </KillButton>
          )}
          <ClearButton onClick={clearTerminal} title="Clear">
            Clear
          </ClearButton>

          {/* Position picker */}
          {!standalone && (
            <>
              <Divider $h={12} />
              {(["bottom", "left", "right", "float"] as PanelPos[]).map((p) => (
                <PosButton
                  key={p}
                  onClick={() => setPos(p)}
                  title={POS_META[p].title}
                  $active={pos === p}
                >
                  {POS_META[p].icon}
                </PosButton>
              ))}
              <PopoutButton onClick={handlePopout} title="Pop out as new window">
                &#x2197;
              </PopoutButton>
              <Divider $h={12} />
              <MinimizeButton onClick={toggleTerminal} title="Minimize">
                &#x254C;
              </MinimizeButton>
            </>
          )}
        </TabBar>

        {/* ── Log browser controls ─────────────────────────────────── */}
        {mode === "logs" && (
          <LogControls>
            <LogLabel>Date (LA)</LogLabel>
            <LogSelect
              value={logBrowser.selectedDate ?? ""}
              onChange={(e) => logBrowser.setSelectedDate(e.target.value || null)}
            >
              {logBrowser.dates.length === 0 && <option value="">No logs yet</option>}
              {logBrowser.dates.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.date} ({(d.bytes / 1024).toFixed(0)} KB)
                </option>
              ))}
            </LogSelect>
            {logBrowser.selectedDate && (
              <LogInfo>
                {logBrowser.total.toLocaleString()} lines &middot; page {logBrowser.page}/{logBrowser.totalPages}
              </LogInfo>
            )}
            {logBrowser.loading && (
              <LogLoading>Loading&hellip;</LogLoading>
            )}
            {logBrowser.totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                <LogPageBtn
                  disabled={logBrowser.page >= logBrowser.totalPages}
                  onClick={() => logBrowser.goPage(logBrowser.page + 1)}
                >
                  &larr; Older
                </LogPageBtn>
                <LogPageBtn
                  disabled={logBrowser.page <= 1}
                  onClick={() => logBrowser.goPage(logBrowser.page - 1)}
                >
                  Newer &rarr;
                </LogPageBtn>
              </div>
            )}
          </LogControls>
        )}

        {/* ── Output area ──────────────────────────────────────────── */}
        <OutputArea onClick={() => (mode === "shell" || mode === "claude") && inputRef.current?.focus()}>
          {mode === "claude" ? (
            claudeLines.length === 0 ? (
              <ClaudeEmptyWrap>
                <ClaudeEmptyIcon>&#x2726;</ClaudeEmptyIcon>
                <p>Claude is ready. Ask anything about your server, code, or projects.</p>
                <ClaudeEmptyContext>Context: TGV Office &middot; Next.js &middot; PostgreSQL &middot; PM2 &middot; Ubuntu</ClaudeEmptyContext>
              </ClaudeEmptyWrap>
            ) : (
              <>
                {claudeLines.map((line, i) => (
                  <ClaudeRow key={i} $user={line.role === "user"}>
                    {line.role === "user" ? (
                      <ClaudeUserBubble>{line.text}</ClaudeUserBubble>
                    ) : (
                      <ClaudeAssistantWrap>
                        <ClaudeLabel>&#x2726; CLAUDE</ClaudeLabel>
                        <ClaudeMarkdown text={line.text} />
                        {line.streaming && <ClaudeCursor>&#x258C;</ClaudeCursor>}
                      </ClaudeAssistantWrap>
                    )}
                  </ClaudeRow>
                ))}
                {claudeLines.length > 0 && (
                  <ClearConvoBtn onClick={() => { setClaudeLines([]); setClaudeHistory([]); }}>
                    clear conversation
                  </ClearConvoBtn>
                )}
              </>
            )
          ) : mode === "logs" ? (
            logBrowser.loading ? (
              <EmptyHint>Loading&hellip;</EmptyHint>
            ) : logBrowser.lines.length === 0 ? (
              <EmptyHint>
                {logBrowser.dates.length === 0
                  ? "No logs captured yet."
                  : "No lines for this date."}
              </EmptyHint>
            ) : (
              logBrowser.lines.map((line, i) => (
                <LogLine key={i}>{line}</LogLine>
              ))
            )
          ) : (
            <>
              {displayLines.length === 0 && (
                <EmptyHint>
                  {mode === "stream" ? "Waiting for server events…" : "Type a command. ↑↓ for history."}
                </EmptyHint>
              )}
              {displayLines.map((line, i) => (
                <div
                  key={i}
                  style={{ color: LINE_COLOR[line.type] ?? "#d4d4d4", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
                >
                  {line.text}
                </div>
              ))}
              {isRunning && mode === "shell" && (
                <RunningCursor>&#x258C;</RunningCursor>
              )}
            </>
          )}
          <div ref={bottomRef} />
        </OutputArea>

        {/* ── Input bar (shell + claude) ────────────────────────────── */}
        {(mode === "shell" || mode === "claude") && (
          <InputBar onSubmit={handleSubmit} $claude={mode === "claude"}>
            {mode === "shell" ? (
              <ShellPrompt>
                {(activeTab?.label ?? "shell").toLowerCase().replace(/\s+/, "")}@tgv:~$
              </ShellPrompt>
            ) : (
              <ClaudePrompt>&#x2726;</ClaudePrompt>
            )}
            <CommandInput
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); setHistIdx(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "claude"
                  ? claudeStreaming ? "Claude is thinking…" : "Ask Claude anything…"
                  : isRunning ? "running…" : "type a command…"
              }
              disabled={mode === "shell" ? isRunning : claudeStreaming}
              autoComplete="off"
              spellCheck={false}
            />
            <SubmitBtn
              type="submit"
              disabled={mode === "shell" ? (isRunning || !inputValue.trim()) : (claudeStreaming || !inputValue.trim())}
              title={mode === "claude" ? "Send to Claude (Enter)" : "Run command (Enter)"}
              $claude={mode === "claude"}
            >
              &#x21B5;
            </SubmitBtn>
          </InputBar>
        )}
      </PanelContainer>
    </>
  );
}
