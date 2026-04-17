"use client";

import { useState, useRef, useEffect } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { PanelIconBtn } from "../../styled";

const ORANGE = colors.orange;
const ORANGE_RGB = rgb.orange;

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  componentKey: string;
  currentCode: string;
  onCodeUpdate: (code: string) => void;
  onDeploy: (targets: string[]) => void;
};

// ── Styled ───────────────────────────────────────────────────────

const OpenBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.75rem 0.75rem 0 0;
  border: 1px solid rgba(${ORANGE_RGB}, 0.25);
  border-bottom: none;
  background: rgba(${ORANGE_RGB}, 0.08);
  color: ${ORANGE};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgba(${ORANGE_RGB}, 0.14);
  }

  [data-theme="light"] & {
    background: rgba(${ORANGE_RGB}, 0.05);
    border-color: rgba(${ORANGE_RGB}, 0.2);

    &:hover {
      background: rgba(${ORANGE_RGB}, 0.1);
    }
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 320px;
  border-radius: 0.75rem 0.75rem 0 0;
  overflow: hidden;
  background: rgba(6, 8, 12, 0.98);
  border: 1px solid rgba(${ORANGE_RGB}, 0.3);
  border-bottom: none;
  box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5),
    0 0 24px rgba(${ORANGE_RGB}, 0.08);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${ORANGE_RGB}, 0.2);
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.06);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(${ORANGE_RGB}, 0.2);

  [data-theme="light"] & {
    border-bottom-color: rgba(${ORANGE_RGB}, 0.12);
  }
`;

const HeaderTitle = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: ${ORANGE};
`;

const HeaderTag = styled.span`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
`;

const ClearBtn = styled.button`
  font-size: 0.625rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: none;
  background: none;
  color: var(--t-textFaint);
  cursor: pointer;
  transition: color 0.15s;

  &:hover {
    color: var(--t-textMuted);
  }
`;

const MsgArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem 1rem;
  scrollbar-width: thin;
`;

const EmptyHint = styled.div`
  font-size: 0.75rem;
  color: var(--t-textGhost);
  text-align: center;
  padding: 1rem 0;
`;

const MsgWrap = styled.div`
  margin-bottom: 0.75rem;
`;

const MsgRole = styled.div<{ $isUser?: boolean }>`
  font-size: 0.5625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  margin-bottom: 0.25rem;
  color: ${(p) => (p.$isUser ? colors.pink : ORANGE)};
`;

const MsgBubble = styled.div<{ $isUser?: boolean }>`
  font-size: 0.75rem;
  line-height: 1.6;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  white-space: pre-wrap;
  color: var(--t-text);
  opacity: 0.75;
  background: ${(p) =>
    p.$isUser ? `rgba(${rgb.pink}, 0.04)` : `rgba(${ORANGE_RGB}, 0.04)`};
  border-left: 2px solid
    ${(p) =>
      p.$isUser ? `rgba(${rgb.pink}, 0.3)` : `rgba(${ORANGE_RGB}, 0.3)`};

  [data-theme="light"] & {
    background: ${(p) =>
      p.$isUser ? `rgba(${rgb.pink}, 0.03)` : `rgba(${ORANGE_RGB}, 0.03)`};
  }
`;

const ThinkRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: ${ORANGE};
`;

const ThinkDot = styled.span`
  animation: pulse 1.5s ease-in-out infinite;

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

const ErrorText = styled.div`
  font-size: 0.75rem;
  color: #f87171;
  margin-top: 0.5rem;
`;

const InputBar = styled.div`
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  border-top: 1px solid var(--t-border);
`;

const ChatInput = styled.textarea`
  flex: 1;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--t-text);
  outline: none;
  resize: none;
  background: var(--t-inputBg);
  border: 1px solid rgba(${ORANGE_RGB}, 0.2);

  &::placeholder {
    color: var(--t-textGhost);
  }

  &:focus {
    border-color: rgba(${ORANGE_RGB}, 0.4);
  }
`;

const SendBtn = styled.button`
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  background: rgba(${ORANGE_RGB}, 0.15);
  border: 1px solid rgba(${ORANGE_RGB}, 0.3);
  color: ${ORANGE};
  cursor: pointer;
  transition: all 0.15s;

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  &:not(:disabled):hover {
    background: rgba(${ORANGE_RGB}, 0.22);
  }

  [data-theme="light"] & {
    background: rgba(${ORANGE_RGB}, 0.08);
    border-color: rgba(${ORANGE_RGB}, 0.2);
  }
`;

// ── Component ────────────────────────────────────────────────────

export default function SandboxClaudeDrawer({ componentKey, currentCode, onCodeUpdate, onDeploy }: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open && !loading) inputRef.current?.focus();
  }, [open, loading]);

  useEffect(() => {
    setMessages([]);
    setError("");
  }, [componentKey]);

  function parseActions(text: string) {
    const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
    if (!jsonMatch) return;
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.action === "updateCode" && parsed.code) {
        onCodeUpdate(parsed.code);
      } else if (parsed.action === "deploy") {
        onDeploy(parsed.targets || ["all"]);
      }
    } catch { /* not valid JSON, ignore */ }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);
    setError("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);

    try {
      const res = await fetch("/api/sandbox/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          componentKey,
          currentCode,
          messages: newMessages,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      const reply: Message = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, reply]);
      parseActions(data.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <OpenBtn onClick={() => setOpen(true)}>
        <span style={{ fontSize: 14 }}>🤖</span> Claude
      </OpenBtn>
    );
  }

  return (
    <Container>
      <Header>
        <span style={{ fontSize: 14 }}>🤖</span>
        <HeaderTitle>Sandbox Claude</HeaderTitle>
        <HeaderTag>{componentKey}</HeaderTag>
        <div style={{ flex: 1 }} />
        <ClearBtn onClick={() => { setMessages([]); setError(""); }} title="Clear chat">
          Clear
        </ClearBtn>
        <PanelIconBtn onClick={() => setOpen(false)} title="Minimize" style={{ width: 24, height: 24 }}>
          ▾
        </PanelIconBtn>
      </Header>

      <MsgArea>
        {messages.length === 0 && !loading && (
          <EmptyHint>
            Ask me to change colors, adjust spacing, add features, or deploy this component.
          </EmptyHint>
        )}
        {messages.map((m, i) => (
          <MsgWrap key={i}>
            <MsgRole $isUser={m.role === "user"}>
              {m.role === "user" ? "You" : "Claude"}
            </MsgRole>
            <MsgBubble $isUser={m.role === "user"}>
              {m.content}
            </MsgBubble>
          </MsgWrap>
        ))}
        {loading && (
          <ThinkRow>
            <ThinkDot>●</ThinkDot> Thinking…
          </ThinkRow>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        <div ref={chatEndRef} />
      </MsgArea>

      <InputBar>
        <ChatInput
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.stopPropagation();
              handleSend();
            }
          }}
          placeholder="Change the border to cyan, make the text bigger…"
          rows={1}
        />
        <SendBtn onClick={handleSend} disabled={!input.trim() || loading}>
          ↑
        </SendBtn>
      </InputBar>
    </Container>
  );
}
