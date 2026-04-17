"use client";

import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import ClaudeIcon from "./ClaudeIcon";
import { renderMarkdown } from "@/lib/markdown";
import { colors, rgb } from "@/app/theme";
import {
  PanelBackdrop,
  Panel,
  PanelHeader,
  PanelIconBtn,
  PanelActionBtn,
  PanelError,
  PanelTitle,
  PanelTag,
  Spacer,
} from "@/app/styled";

type Msg = { role: "user" | "assistant"; content: string };

/* ── Local styled ──────────────────────────────────────────────── */

const MsgArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scrollbar-width: thin;
`;

const MsgRole = styled.span<{ $user?: boolean }>`
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${(p) => (p.$user ? colors.cyan : colors.orange)};
`;

const MsgText = styled.div`
  font-size: 0.875rem;
  color: var(--t-text);
  opacity: 0.85;
  line-height: 1.625;
  white-space: pre-wrap;
`;

const ThinkDot = styled.span`
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${colors.orange};
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

const ThinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const InputBar = styled.div`
  flex-shrink: 0;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--t-border);
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
`;

const ChatInput = styled.textarea`
  flex: 1;
  background: transparent;
  outline: none;
  font-size: 0.875rem;
  color: var(--t-text);
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  resize: none;
  border: 1px solid var(--t-borderStrong);

  &::placeholder {
    color: var(--t-textGhost);
  }

  &:focus {
    border-color: rgba(${rgb.orange}, 0.45);
  }
`;

const SendBtn = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(${rgb.orange}, 0.18);
  border: 1px solid rgba(${rgb.orange}, 0.45);
  color: ${colors.orange};

  &:hover {
    background: rgba(${rgb.orange}, 0.28);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;

const Hint = styled.div`
  color: var(--t-textFaint);
  font-size: 0.875rem;
  padding-top: 3rem;
  text-align: center;
`;

const Kbd = styled.kbd`
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  font-size: 0.625rem;
`;

/* ── Component ─────────────────────────────────────────────────── */

export default function ClaudeChatModal({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (fullscreen) { setFullscreen(false); return; }
        onClose();
      }
    };
    document.addEventListener("keydown", handler, { capture: true });
    return () => document.removeEventListener("keydown", handler, { capture: true });
  }, [onClose, fullscreen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => { taRef.current?.focus(); }, []);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/claude/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `HTTP ${res.status}`);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply ?? "" }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setSending(false);
      setTimeout(() => taRef.current?.focus(), 50);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      <PanelBackdrop onClick={onClose} />
      <Panel $fs={fullscreen} $accent="orange">
        <PanelHeader $accent="orange">
          <ClaudeIcon size={20} color={colors.orange} />
          <PanelTitle>Chat with Claude</PanelTitle>
          <PanelTag>claude-opus-4-6</PanelTag>
          <Spacer />
          <PanelActionBtn
            $variant="ghost"
            onClick={() => setMessages([])}
            disabled={messages.length === 0}
          >
            Clear
          </PanelActionBtn>
          <PanelIconBtn
            onClick={() => setFullscreen((p) => !p)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? "⊑" : "⊞"}
          </PanelIconBtn>
          <PanelIconBtn onClick={onClose} title="Close (Esc)">
            ✕
          </PanelIconBtn>
        </PanelHeader>

        <MsgArea ref={scrollRef}>
          {messages.length === 0 && (
            <Hint>
              Start a conversation. Press <Kbd>Enter</Kbd> to send, <Kbd>Shift+Enter</Kbd> for newline.
            </Hint>
          )}
          {messages.map((m, i) => (
            <div key={i}>
              <MsgRole $user={m.role === "user"}>
                {m.role === "user" ? "You" : "Claude"}
              </MsgRole>
              {m.role === "assistant" ? (
                <MsgText
                  className="md-content"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                />
              ) : (
                <MsgText>{m.content}</MsgText>
              )}
            </div>
          ))}
          {sending && (
            <ThinkRow>
              <ThinkDot />
              Claude is thinking…
            </ThinkRow>
          )}
          {error && <PanelError>{error}</PanelError>}
        </MsgArea>

        <InputBar>
          <ChatInput
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Ask Claude anything…"
            rows={2}
          />
          <SendBtn onClick={send} disabled={!input.trim() || sending}>
            Send
          </SendBtn>
        </InputBar>
      </Panel>
    </>
  );
}
