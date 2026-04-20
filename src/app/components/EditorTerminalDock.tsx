"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb, glowRgba } from "../theme";
import { DTogExpandIcon } from "./icons";
import NeonX from "./NeonX";

const STORAGE_HEIGHT = "tgv-editor-terminal-height";
const STORAGE_OPEN = "tgv-editor-terminal-open";
const DEFAULT_HEIGHT = 280;
const MIN_HEIGHT = 150;
const MAX_HEIGHT = 680;
const DTOG_CLICK_SLOP = 4;

const BC_NAME = "tgv-editor-terminal-popout";
const POPOUT_HEARTBEAT_MS = 1200;
const POPOUT_STALE_MS = 4000;

type Line = { type: "cmd" | "out" | "err" | "exit" | "info"; text: string };

const Dock = styled.div<{ $h: number }>`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${(p) => p.$h}px;
  z-index: 40;
  display: flex;
  flex-direction: column;
  background: rgba(4, 5, 8, 0.98);
  border-top: 1px solid rgba(${rgb.gold}, 0.25);
  box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.6);

  [data-theme="light"] & {
    background: var(--t-surface);
    box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.08);
  }
`;

// DTog horizontal variant — the 8px rail, 1px hairlines top + bottom,
// accent-tinted closed-rectangle that lights up on hover + drag.
const ResizeHandle = styled.div<{ $dragging?: boolean }>`
  position: absolute;
  top: -4px;
  left: 0;
  right: 0;
  height: 8px;
  cursor: row-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  color: ${colors.gold};
  background: ${(p) => (p.$dragging ? `rgba(${rgb.gold}, 0.2)` : "transparent")};
  transition: background 0.15s, box-shadow 0.15s;
  box-shadow: ${(p) =>
    p.$dragging
      ? `0 0 14px rgba(${rgb.gold}, 0.5), inset 0 0 8px rgba(${rgb.gold}, 0.25)`
      : "none"};

  &::before,
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 1px;
    background: ${(p) =>
      p.$dragging ? `rgba(${rgb.gold}, 0.6)` : "var(--t-border)"};
    transition: background 0.15s;
  }
  &::before { top: 0; }
  &::after  { bottom: 0; }

  &:hover {
    background: rgba(${rgb.gold}, 0.1);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.35),
      inset 0 0 6px rgba(${rgb.gold}, 0.18);
    &::before, &::after { background: rgba(${rgb.gold}, 0.4); }
    > svg { opacity: 1; filter: drop-shadow(0 0 3px rgba(${rgb.gold}, 0.55)); }
  }

  > svg {
    opacity: 0.85;
    pointer-events: none;
    transition: opacity 0.15s, filter 0.15s;
  }
`;

function DTogHorizontalGrip() {
  return (
    <svg
      width="30"
      height="14"
      viewBox="0 0 30 14"
      fill="currentColor"
      aria-hidden="true"
    >
      <polygon points="0.5,7 5,2.5 5,11.5" />
      <rect x="8.5" y="1" width="2" height="12" rx="1" />
      <rect x="13" y="1" width="2" height="12" rx="1" />
      <rect x="17.5" y="1" width="2" height="12" rx="1" />
      <polygon points="29.5,7 25,2.5 25,11.5" />
    </svg>
  );
}

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.625rem;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.12);
  min-height: 38px;
`;

const Title = styled.span`
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.5);
`;

const Spacer = styled.div`flex: 1;`;

const ActionBtn = styled.button`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  background: rgba(${rgb.gold}, 0.14);
  border: 1px solid ${glowRgba("gold", 0.45)};
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover {
    background: rgba(${rgb.gold}, 0.28);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.5);
  }

  &:active {
    transform: translateY(1px);
  }

  [data-theme="light"] & {
    text-shadow: none;
  }
`;

const LogScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0.75rem;
  font-family: var(--font-geist-mono), "JetBrains Mono", monospace;
  font-size: 11.5px;
  line-height: 1.55;
  scrollbar-width: thin;
`;

const LogLine = styled.pre<{ $kind: Line["type"] }>`
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${(p) =>
    p.$kind === "err"
      ? colors.red
      : p.$kind === "exit"
      ? "#00dc64"
      : p.$kind === "cmd"
      ? colors.gold
      : p.$kind === "info"
      ? colors.gold
      : "var(--t-text)"};
`;

const InputRow = styled.form`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  flex-shrink: 0;
  border-top: 1px solid rgba(${rgb.gold}, 0.12);
  background: rgba(${rgb.gold}, 0.03);
`;

const Prompt = styled.span`
  color: ${colors.gold};
  font-family: monospace;
  font-size: 12px;
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.5);
`;

const Input = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--t-text);
  font-family: var(--font-geist-mono), "JetBrains Mono", monospace;
  font-size: 12px;
  padding: 0.25rem 0;

  &::placeholder {
    color: var(--t-textGhost);
  }
`;

const RestoreTab = styled.button`
  position: fixed;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 6px 18px;
  border: 1px solid rgba(${rgb.gold}, 0.45);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  background: rgba(${rgb.gold}, 0.14);
  color: ${colors.gold};
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  backdrop-filter: blur(8px);
  box-shadow: 0 -4px 20px rgba(${rgb.gold}, 0.15);
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.5);

  &:hover {
    background: rgba(${rgb.gold}, 0.22);
  }

  /* Rotate the canonical ExpandIcon 90° CCW so the arrow points UP —
     the direction the dock will expand into. */
  > svg {
    transform: rotate(-90deg);
  }
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
  padding: 1.5rem;
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
  color: rgba(${rgb.gold}, 0.7);
  text-align: center;
  max-width: 32ch;
  line-height: 1.4;

  [data-theme="light"] & {
    color: rgba(${rgb.gold}, 0.85);
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
  background: rgba(${rgb.gold}, 0.12);
  border: 1px solid rgba(${rgb.gold}, 0.45);
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.5);
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(${rgb.gold}, 0.22);
    box-shadow: 0 0 12px rgba(${rgb.gold}, 0.4);
  }
`;

export default function EditorTerminalDock({ project }: { project?: string | null }) {
  const [open, setOpen] = useState<boolean>(true);
  const [height, setHeight] = useState<number>(DEFAULT_HEIGHT);
  const [lines, setLines] = useState<Line[]>([
    { type: "info", text: "TGV editor terminal — cwd: /srv/refusion-core" },
  ]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [running, setRunning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [popoutActive, setPopoutActive] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cwd = project ? `/srv/refusion-core/client/${project}` : "/srv/refusion-core";

  useEffect(() => {
    const savedH = localStorage.getItem(STORAGE_HEIGHT);
    const savedOpen = localStorage.getItem(STORAGE_OPEN);
    if (savedH) setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parseInt(savedH, 10))));
    if (savedOpen === "0") setOpen(false);
  }, []);

  useEffect(() => {
    document.body.setAttribute("data-editor-dock", open ? "open" : "closed");
    const offset = open ? height : 28;
    document.documentElement.style.setProperty("--editor-dock-h", `${offset}px`);
    return () => {
      document.body.removeAttribute("data-editor-dock");
      document.documentElement.style.removeProperty("--editor-dock-h");
    };
  }, [open, height]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  // POP: watch for a popout window and paint the Blackout placeholder here
  // while it's alive. Origin-window heartbeat coordination.
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BC_NAME);
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
  }, []);

  const requestPopoutClose = useCallback(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const bc = new BroadcastChannel(BC_NAME);
    bc.postMessage({ type: "close-request" });
    bc.close();
  }, []);

  const persistOpen = (v: boolean) => {
    setOpen(v);
    localStorage.setItem(STORAGE_OPEN, v ? "1" : "0");
  };

  const persistHeight = (h: number) => {
    setHeight(h);
    localStorage.setItem(STORAGE_HEIGHT, String(h));
  };

  const onDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = height;
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      if (Math.abs(delta) < DTOG_CLICK_SLOP) return;
      moved = true;
      setDragging(true);
      const next = startH + delta;
      if (next < MIN_HEIGHT - 30) {
        persistOpen(false);
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        return;
      }
      persistHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, next)));
    };
    const onUp = () => {
      if (!moved) {
        // click-to-collapse (DTog convention)
        persistOpen(false);
      }
      setDragging(false);
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "row-resize";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [height]);

  const runCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || running) return;
    setRunning(true);
    setLines((prev) => [...prev, { type: "cmd", text: `$ ${cmd}` }]);
    setHistory((prev) => [...prev, cmd].slice(-100));
    setHistIdx(-1);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/terminal/shell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, cwd }),
        signal: ctrl.signal,
      });
      if (!res.body) throw new Error("no stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const dataLine = p.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.replace("data: ", ""));
            setLines((prev) => [...prev, { type: payload.type, text: payload.data }]);
          } catch { /* ignore malformed */ }
        }
      }
    } catch (err: unknown) {
      if ((err as Error).name !== "AbortError") {
        setLines((prev) => [...prev, { type: "err", text: `stream error: ${(err as Error).message}` }]);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [cwd, running]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input;
    setInput("");
    if (cmd.trim() === "clear") {
      setLines([]);
      return;
    }
    runCommand(cmd);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      if (history.length === 0) return;
      const next = histIdx < 0 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setInput(history[next] ?? "");
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      if (histIdx < 0) return;
      const next = histIdx + 1;
      if (next >= history.length) { setHistIdx(-1); setInput(""); }
      else { setHistIdx(next); setInput(history[next] ?? ""); }
      e.preventDefault();
    } else if (e.key === "c" && e.ctrlKey) {
      if (abortRef.current) {
        abortRef.current.abort();
        setLines((prev) => [...prev, { type: "err", text: "^C" }]);
      }
    }
  };

  const openPopout = () => {
    window.open("/terminal-popout", "tgv-editor-terminal-popout", "width=900,height=600,noopener");
  };

  if (!open) {
    return (
      <RestoreTab onClick={() => persistOpen(true)} title="Open terminal">
        <DTogExpandIcon side="left" size={14} />
        Terminal
      </RestoreTab>
    );
  }

  return (
    <Dock $h={height}>
      <ResizeHandle
        onMouseDown={onDrag}
        $dragging={dragging}
        title="Drag to resize · click to collapse"
      >
        <DTogHorizontalGrip />
      </ResizeHandle>
      <Header>
        <Title>Terminal</Title>
        <Spacer />
        <ActionBtn onClick={openPopout} title="Pop out to new window">⧉</ActionBtn>
        <NeonX accent="gold" onClick={() => persistOpen(false)} title="Collapse terminal" />
      </Header>
      <LogScroll ref={logRef} onClick={() => inputRef.current?.focus()}>
        {lines.map((l, i) => (
          <LogLine key={i} $kind={l.type}>{l.text}</LogLine>
        ))}
      </LogScroll>
      <InputRow onSubmit={onSubmit}>
        <Prompt>$</Prompt>
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          placeholder={running ? "running…" : `type a command · cwd ${cwd}`}
          disabled={running}
          spellCheck={false}
          autoComplete="off"
        />
      </InputRow>

      {popoutActive && (
        <Blackout>
          <BlackoutMsg>Currently working in pop-out window</BlackoutMsg>
          <BlackoutSub>
            Your terminal session is live in the other window. Close the pop-out
            to continue here.
          </BlackoutSub>
          <BlackoutCloseBtn type="button" onClick={requestPopoutClose}>
            Close pop-out
          </BlackoutCloseBtn>
        </Blackout>
      )}
    </Dock>
  );
}
