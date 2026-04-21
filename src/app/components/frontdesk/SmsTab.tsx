"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { SmsMessage } from "@/lib/frontdesk/types";
import { SendIcon, PhoneIcon } from "../icons";

// ── Types ────────────────────────────────────────────────────────

type ThreadSummary = {
  peerE164: string;
  peerName: string | null;
  count: number;
  unread: number;
  lastMessage: SmsMessage | null;
};

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const Empty = styled.div`
  text-align: center;
  padding: 2rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

const ThreadList = styled.ul`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  list-style: none;
  margin: 0;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const ThreadRow = styled.li<{ $unread: boolean }>`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.25rem 0.5rem;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.08)` : "rgba(255,255,255,0.02)")};
  border: 1px solid ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.3)` : "transparent")};
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: rgba(${rgb.gold}, 0.12);
  }
`;

const PeerName = styled.div`
  font-weight: 600;
  color: var(--t-textBase);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Preview = styled.div`
  grid-column: 1 / -1;
  font-size: 0.8125rem;
  color: var(--t-textGhost);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Time = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
`;

const UnreadPill = styled.span`
  background: ${colors.gold};
  color: #0a0a0a;
  font-size: 0.625rem;
  font-weight: 800;
  border-radius: 999px;
  padding: 2px 7px;
  margin-left: 0.5rem;
`;

// Conversation pane
const ConvWrap = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
`;

const ConvHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.03);
`;

const BackBtn = styled.button`
  padding: 0.35rem 0.6rem;
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.375rem;
  color: ${colors.gold};
  font-size: 0.75rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.12); }
`;

const ConvTitle = styled.div`
  flex: 1;
  font-weight: 600;
  color: var(--t-textBase);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const CallLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.6rem;
  background: transparent;
  border: 1px solid rgba(${rgb.green}, 0.45);
  border-radius: 0.375rem;
  color: ${colors.green};
  font-size: 0.75rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.green}, 0.14); }
  svg { width: 12px; height: 12px; }
`;

const Messages = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const Bubble = styled.div<{ $dir: "inbound" | "outbound" }>`
  max-width: 80%;
  align-self: ${(p) => (p.$dir === "outbound" ? "flex-end" : "flex-start")};
  padding: 0.5rem 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.35;
  white-space: pre-wrap;
  word-break: break-word;
  background: ${(p) =>
    p.$dir === "outbound"
      ? `rgba(${rgb.gold}, 0.18)`
      : `rgba(255, 255, 255, 0.06)`};
  border: 1px solid ${(p) =>
    p.$dir === "outbound"
      ? `rgba(${rgb.gold}, 0.35)`
      : `rgba(255, 255, 255, 0.1)`};
  color: var(--t-textBase);
`;

const BubbleMeta = styled.div<{ $dir: "inbound" | "outbound" }>`
  font-size: 0.625rem;
  color: var(--t-textGhost);
  align-self: ${(p) => (p.$dir === "outbound" ? "flex-end" : "flex-start")};
  font-family: var(--font-geist-mono), monospace;
  margin: -0.125rem 0.25rem 0.25rem;
`;

const Composer = styled.form`
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-top: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.04);
`;

const ComposerInput = styled.input`
  flex: 1;
  padding: 0.55rem 0.75rem;
  font-size: 0.875rem;
  color: var(--t-textBase);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.5rem;
  outline: none;

  &:focus { border-color: rgba(${rgb.gold}, 0.6); }

  [data-theme="light"] & { background: rgba(255, 255, 255, 0.7); }
`;

const SendBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 0.85rem;
  background: rgba(${rgb.gold}, 0.2);
  border: 1px solid rgba(${rgb.gold}, 0.45);
  border-radius: 0.5rem;
  color: ${colors.gold};
  cursor: pointer;

  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.32); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  svg { width: 14px; height: 14px; }
`;

const NewBtn = styled.button`
  margin: 0.5rem 0.5rem 0;
  padding: 0.45rem 0.75rem;
  background: rgba(${rgb.gold}, 0.12);
  border: 1px dashed rgba(${rgb.gold}, 0.45);
  border-radius: 0.375rem;
  color: ${colors.gold};
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: rgba(${rgb.gold}, 0.22); }
`;

// ── Helpers ──────────────────────────────────────────────────────

function formatRelTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diffSec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (diffSec < 60) return "now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  return new Date(iso).toLocaleDateString();
}

// ── Component ────────────────────────────────────────────────────

export default function SmsTab() {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [activePeerName, setActivePeerName] = useState<string | null>(null);
  const [messages, setMessages] = useState<SmsMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/sms/threads");
      if (!res.ok) return;
      const j = await res.json();
      setThreads(j.threads ?? []);
    } catch { /* ignore */ }
  }, []);

  const loadMessages = useCallback(async (peer: string) => {
    try {
      const res = await fetch(`/api/frontdesk/sms/threads/${encodeURIComponent(peer)}`);
      if (!res.ok) return;
      const j = await res.json();
      setMessages(j.messages ?? []);
      setActivePeerName(j.peerName ?? null);
      await fetch(`/api/frontdesk/sms/threads/${encodeURIComponent(peer)}`, { method: "PATCH" });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadThreads();
    const id = setInterval(loadThreads, 15_000);
    return () => clearInterval(id);
  }, [loadThreads]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { peer?: string } | undefined;
      if (!detail?.peer) return;
      setActivePeer(detail.peer);
      setActivePeerName(null);
      setMessages([]);
    };
    window.addEventListener("frontdesk-sms-open", handler);
    return () => window.removeEventListener("frontdesk-sms-open", handler);
  }, []);

  useEffect(() => {
    if (!activePeer) return;
    loadMessages(activePeer);
    const id = setInterval(() => loadMessages(activePeer), 10_000);
    return () => clearInterval(id);
  }, [activePeer, loadMessages]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages.length, activePeer]);

  const openThread = (peer: string, peerName: string | null) => {
    setActivePeer(peer);
    setActivePeerName(peerName);
    setMessages([]);
  };

  const sendNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePeer || !draft.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/frontdesk/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activePeer, body: draft }),
      });
      if (res.ok) {
        setDraft("");
        await loadMessages(activePeer);
        await loadThreads();
      }
    } finally {
      setSending(false);
    }
  };

  const callPeer = () => {
    if (!activePeer) return;
    window.dispatchEvent(new CustomEvent("frontdesk-dial-prefill", {
      detail: { to: activePeer, autoDial: false },
    }));
  };

  const promptNewThread = () => {
    const entry = window.prompt("Start a new SMS thread to (E.164, e.g. +15551234567):");
    if (entry && entry.trim()) {
      openThread(entry.trim(), null);
    }
  };

  if (!activePeer) {
    return (
      <Wrap>
        <NewBtn type="button" onClick={promptNewThread}>+ New thread</NewBtn>
        {threads.length === 0 ? (
          <Empty>No SMS threads yet.</Empty>
        ) : (
          <ThreadList>
            {threads.map(t => (
              <ThreadRow key={t.peerE164} $unread={t.unread > 0} onClick={() => openThread(t.peerE164, t.peerName)}>
                <PeerName>
                  {t.peerName ?? t.peerE164}
                  {t.unread > 0 && <UnreadPill>{t.unread}</UnreadPill>}
                </PeerName>
                <Time>{t.lastMessage ? formatRelTime(t.lastMessage.createdAt) : ""}</Time>
                <Preview>{t.lastMessage?.body ?? ""}</Preview>
              </ThreadRow>
            ))}
          </ThreadList>
        )}
      </Wrap>
    );
  }

  return (
    <ConvWrap>
      <ConvHead>
        <BackBtn onClick={() => setActivePeer(null)}>← Threads</BackBtn>
        <ConvTitle>{activePeerName ?? activePeer}</ConvTitle>
        <CallLink type="button" onClick={callPeer} title={`Call ${activePeer}`}>
          <PhoneIcon size={12} /> Call
        </CallLink>
      </ConvHead>

      <Messages ref={messagesRef}>
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          messages.map(m => (
            <Fragment key={m.id}>
              <Bubble $dir={m.direction}>{m.body}</Bubble>
              <BubbleMeta $dir={m.direction}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </BubbleMeta>
            </Fragment>
          ))
        )}
      </Messages>

      <Composer onSubmit={sendNew}>
        <ComposerInput
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          disabled={sending}
        />
        <SendBtn type="submit" disabled={!draft.trim() || sending} title="Send">
          <SendIcon size={14} />
        </SendBtn>
      </Composer>
    </ConvWrap>
  );
}
