"use client";

import { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import { colors, rgb, glowRgba } from "../../theme";
import { useModalLifecycle } from "../../lib/drawerKnobs";
import {
  ModalBackdrop, ModalContainer, ModalHeader, ModalHeaderLeft,
  ModalTitle, ModalSubtitle, ModalBody, GlowButton,
  SubtleButton, Input, TextArea, GlassCard, AccentLabel, PulseText,
  DrawerTitle,
} from "../../styled";
import NeonX from "../NeonX";
import Tooltip from "../ui/Tooltip";

const FsContainer = styled(ModalContainer)<{ $fs: boolean }>`
  ${(p) => p.$fs && `
    max-width: 100vw;
    max-height: 100vh;
    width: 100vw;
    height: 100vh;
    border-radius: 0;
  `}
`;

const CtrlBtn = styled.button<{ $active?: boolean }>`
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
  flex-shrink: 0;
  background: ${(p) => (p.$active ? glowRgba("pink", 0.28) : glowRgba("pink", 0.14))};
  border: 1px solid ${(p) => glowRgba("pink", p.$active ? 0.6 : 0.45)};
  color: ${colors.pink};
  text-shadow: 0 0 6px rgba(${rgb.pink}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover { background: ${glowRgba("pink", 0.28)}; box-shadow: 0 0 10px ${glowRgba("pink", 0.5)}; }
  &:active { transform: translateY(1px); }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.1875rem;
    border-radius: 0.625rem;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-left: auto;
`;

type Message = { role: "user" | "assistant"; content: string };
type Phase = "form" | "chat" | "sent";

const FeatureBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: flex-start;
  padding: 0.375rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${colors.pink};
  background: ${glowRgba("pink", 0.08)};
  border: 1px solid ${glowRgba("pink", 0.2)};
`;

const ResponseCard = styled(GlassCard).attrs({ $accent: "cyan" as const })`
  white-space: pre-wrap;
`;

const ResponseHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const ResponseBody = styled.div`
  font-size: 0.875rem;
  color: var(--t-textMuted);
  line-height: 1.6;
`;

const PageNav = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
`;

const PageCircle = styled.button`
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  background: var(--t-inputBg);
  border: 1px solid var(--t-borderStrong);
  color: var(--t-textMuted);
  cursor: pointer;
  transition: all 0.15s;

  &:disabled { opacity: 0.3; cursor: default; }
`;

const ChatRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;

const SendBtn = styled.button`
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${colors.pink};
  background: ${glowRgba("pink", 0.15)};
  border: 1px solid ${glowRgba("pink", 0.3)};
  cursor: pointer;
  transition: opacity 0.15s;

  &:disabled { opacity: 0.3; }
`;

const UserBubble = styled.div`
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: ${glowRgba("pink", 0.04)};
  border-left: 2px solid ${glowRgba("pink", 0.3)};

  [data-theme="light"] & {
    background: ${glowRgba("pink", 0.03)};
  }
`;

const ErrorBox = styled.div`
  margin-top: 0.75rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: ${colors.red};
  background: rgba(${rgb.red}, 0.1);
  border: 1px solid rgba(${rgb.red}, 0.2);
`;

const SentWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem 0;
`;

const FormStack = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const ChatStack = styled.div`display: flex; flex-direction: column; gap: 1rem;`;
const FormLabel = styled(AccentLabel).attrs({ $accent: "pink" as const })`
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.6875rem;
`;

export default function SuggestionBoxModal({ onClose }: { onClose: () => void }) {
  useModalLifecycle();
  const [phase, setPhase] = useState<Phase>("form");
  const [featureName, setFeatureName] = useState("");
  const [description, setDescription] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { if (phase === "chat" && !loading) inputRef.current?.focus(); }, [phase, loading]);

  async function handleSubmitForm() {
    if (!featureName.trim() || !description.trim()) return;
    setLoading(true); setError(""); setPhase("chat");
    const userMsg: Message = { role: "user", content: description };
    setMessages([userMsg]);
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", featureName, messages: [userMsg] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  }

  async function handleSendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput(""); setLoading(true); setError("");
    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "chat", featureName, messages: newMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setLoading(false); }
  }

  async function handleSendToAdmin() {
    setSending(true); setError("");
    try {
      const res = await fetch("/api/suggestion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", featureName, description, conversation: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setPhase("sent");
    } catch (err) { setError(err instanceof Error ? err.message : "Unknown error"); }
    finally { setSending(false); }
  }

  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const totalPages = assistantMessages.length;
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visibleAssistant = totalPages > 0 ? assistantMessages[totalPages - 1 - safePage] : null;

  return (
    <ModalBackdrop onClick={onClose}>
      <FsContainer $fs={fullscreen} $accent="pink" $maxWidth="42rem" onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <span style={{ fontSize: "1.5rem" }}>💡</span>
            <div>
              <DrawerTitle $accent="pink">SuggestionBox</DrawerTitle>
              <ModalSubtitle>
                {phase === "form" && "Describe your feature idea"}
                {phase === "chat" && "Refine your idea with Claude"}
                {phase === "sent" && "Suggestion sent!"}
              </ModalSubtitle>
            </div>
          </ModalHeaderLeft>
          <HeaderRight>
            <Tooltip accent={colors.pink} label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              <CtrlBtn
                $active={fullscreen}
                onClick={() => setFullscreen((v) => !v)}
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {fullscreen ? "⊡" : "⊞"}
              </CtrlBtn>
            </Tooltip>
            <Tooltip accent={colors.pink} label="Close (Esc)">
              <NeonX accent="pink" onClick={onClose} />
            </Tooltip>
          </HeaderRight>
        </ModalHeader>
        <ModalBody>
          {phase === "form" && (
            <FormStack>
              <div>
                <FormLabel>Proposed name of feature</FormLabel>
                <Input $accent="pink" value={featureName} onChange={(e) => setFeatureName(e.target.value)} placeholder="e.g. Client Dashboard Analytics" autoFocus />
              </div>
              <div>
                <FormLabel>Describe your feature</FormLabel>
                <TextArea $accent="pink" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What should this feature do? Who is it for?" rows={5} />
              </div>
              <GlowButton onClick={handleSubmitForm} disabled={!featureName.trim() || !description.trim()} style={{ alignSelf: "flex-end" }}>
                Generate Plan with Claude
              </GlowButton>
            </FormStack>
          )}

          {phase === "chat" && (
            <ChatStack>
              <FeatureBadge>💡 {featureName}</FeatureBadge>

              {visibleAssistant && (
                <ResponseCard>
                  <ResponseHeader>
                    <AccentLabel $accent="cyan">Claude AI</AccentLabel>
                    {totalPages > 1 && (
                      <span style={{ fontSize: "0.625rem", color: "var(--t-textGhost)", marginLeft: "auto" }}>
                        Response {totalPages - safePage} of {totalPages}
                      </span>
                    )}
                  </ResponseHeader>
                  <ResponseBody>{visibleAssistant.content}</ResponseBody>
                </ResponseCard>
              )}

              {totalPages > 1 && (
                <PageNav>
                  <PageCircle onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>‹</PageCircle>
                  <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-geist-mono)", color: "var(--t-textMuted)" }}>{safePage + 1} / {totalPages}</span>
                  <PageCircle onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={safePage === totalPages - 1}>›</PageCircle>
                </PageNav>
              )}

              {loading && <PulseText $color={colors.cyan}>● Claude is thinking…</PulseText>}

              {messages.filter((m) => m.role === "user").length > 1 && (
                <details style={{ fontSize: "0.75rem", color: "var(--t-textGhost)" }}>
                  <summary style={{ cursor: "pointer" }}>Your messages ({messages.filter((m) => m.role === "user").length})</summary>
                  <div style={{ marginTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {messages.filter((m) => m.role === "user").reverse().map((m, i) => (
                      <UserBubble key={i}><p style={{ fontSize: "0.75rem", color: "var(--t-textMuted)", margin: 0 }}>{m.content}</p></UserBubble>
                    ))}
                  </div>
                </details>
              )}

              {!loading && (
                <ChatRow>
                  <TextArea
                    ref={inputRef} $accent="pink" value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                    placeholder="Ask a follow-up or refine the plan…" rows={2}
                    style={{ flex: 1 }}
                  />
                  <SendBtn onClick={handleSendMessage} disabled={!input.trim()}>↑</SendBtn>
                </ChatRow>
              )}

              {assistantMessages.length > 0 && !loading && (
                <GlowButton onClick={handleSendToAdmin} disabled={sending} style={{ alignSelf: "center", marginTop: "0.5rem" }}>
                  {sending ? "Sending…" : "Send to admin team"}
                </GlowButton>
              )}
            </ChatStack>
          )}

          {phase === "sent" && (
            <SentWrap>
              <span style={{ fontSize: "3rem" }}>✅</span>
              <ModalTitle>Suggestion sent!</ModalTitle>
              <p style={{ fontSize: "0.875rem", color: "var(--t-textMuted)", textAlign: "center", maxWidth: "24rem" }}>
                Your feature suggestion for <strong style={{ color: colors.pink }}>{featureName}</strong> has been emailed to the admin team.
              </p>
              <SubtleButton onClick={onClose} style={{ marginTop: "1rem" }}>Close</SubtleButton>
            </SentWrap>
          )}

          {error && <ErrorBox>{error}</ErrorBox>}
          <div ref={chatEndRef} />
        </ModalBody>
      </FsContainer>
    </ModalBackdrop>
  );
}
