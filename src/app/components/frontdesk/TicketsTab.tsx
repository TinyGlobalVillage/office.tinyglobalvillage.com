"use client";

// TicketsTab — the Front Desk "Tickets" tab (Pass 2, staff surface #2). An INLINE view of the same
// support queue the dashboard chat-bubble drives, over the Office→tgv.com proxy (/api/frontdesk/support).
// Claim / reply (emails the villager) / mark-complete are the SAME atomic ops on the SAME support_tickets
// rows, so a ticket claimed here OR in the dashboard 409s the other. Self-shows "off" when the desk flag
// is OFF (queue route 403s).

import { useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { rgb } from "../../theme";

const API = "/api/frontdesk/support";
const POLL = 6000;

type QueueTicket = {
  id: string;
  requesterName: string | null;
  requesterEmail: string;
  subject: string | null;
  status: "open" | "claimed";
  lastMessageAt: string;
  messageCount: number;
};
type StaffMessage = {
  id: string;
  authorKind: "villager" | "staff" | "bot";
  authorName: string | null;
  body: string;
  createdAt: string;
};
type StaffTicket = QueueTicket & { closedAt: string | null };

export default function TicketsTab() {
  const [disabled, setDisabled] = useState(false);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [active, setActive] = useState<{ ticket: StaffTicket; messages: StaffMessage[] } | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API}/queue`, { cache: "no-store" });
      if (res.status === 403) {
        setDisabled(true);
        return;
      }
      if (!res.ok) return;
      setDisabled(false);
      const j = await res.json().catch(() => ({}));
      setTickets(Array.isArray(j.tickets) ? j.tickets : []);
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    void loadQueue();
    const t = setInterval(loadQueue, POLL);
    return () => clearInterval(t);
  }, [loadQueue]);

  const loadActive = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API}/queue/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json().catch(() => ({}));
      if (j.ticket) setActive({ ticket: j.ticket, messages: j.messages ?? [] });
    } catch {
      /* transient */
    }
  }, []);

  useEffect(() => {
    if (!activeId) return;
    void loadActive(activeId);
    const t = setInterval(() => void loadActive(activeId), POLL);
    return () => clearInterval(t);
  }, [activeId, loadActive]);

  const msgCount = active?.messages.length ?? 0;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [msgCount]);

  const act = useCallback(
    async (path: string, body?: unknown) => {
      if (!activeId || busy) return;
      setBusy(true);
      try {
        await fetch(`${API}/queue/${activeId}/${path}`, {
          method: "POST",
          headers: body ? { "content-type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        await Promise.all([loadActive(activeId), loadQueue()]);
      } finally {
        setBusy(false);
      }
    },
    [activeId, busy, loadActive, loadQueue],
  );

  const reply = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    await act("reply", { body });
    setDraft("");
  }, [draft, act]);

  const complete = useCallback(async () => {
    await act("complete");
    setActiveId(null);
    setActive(null);
  }, [act]);

  if (disabled) {
    return (
      <Wrap>
        <Note>
          The support desk is currently OFF. Turn it on (or stage it admin-only) from Utils → Dashboard
          Config → <strong>Staff Support</strong>.
        </Note>
      </Wrap>
    );
  }

  if (active) {
    const t = active.ticket;
    return (
      <Wrap>
        <Bar>
          <Back type="button" onClick={() => { setActiveId(null); setActive(null); }}>← Queue</Back>
          <BarWho>
            {t.requesterName || t.requesterEmail} <StatusTag $open={t.status === "open"}>{t.status}</StatusTag>
          </BarWho>
        </Bar>
        <Scroll ref={scrollRef}>
          {active.messages.map((m) => {
            const staff = m.authorKind === "staff";
            return (
              <MsgRow key={m.id} $staff={staff}>
                <MsgWho>
                  {m.authorKind === "villager" ? t.requesterName || "Villager" : staff ? m.authorName || "Staff" : "Auto"}
                </MsgWho>
                <MsgBubble $staff={staff}>{m.body}</MsgBubble>
              </MsgRow>
            );
          })}
        </Scroll>
        <Actions>
          {t.status === "open" && (
            <ActBtn type="button" disabled={busy} onClick={() => void act("claim")}>Claim</ActBtn>
          )}
          <ActBtn type="button" $danger disabled={busy} onClick={() => void complete()}>Mark complete</ActBtn>
        </Actions>
        <Composer>
          <Field
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void reply();
              }
            }}
            placeholder="Reply as TGV Staff Member…"
            rows={2}
          />
          <SendBtn type="button" disabled={!draft.trim() || busy} onClick={() => void reply()}>Send</SendBtn>
        </Composer>
      </Wrap>
    );
  }

  return (
    <Wrap>
      {tickets.length === 0 ? (
        <Note>Queue is empty.</Note>
      ) : (
        <List>
          {tickets.map((t) => (
            <Item key={t.id} type="button" onClick={() => setActiveId(t.id)}>
              <ItemTop>
                <ItemWho>{t.requesterName || t.requesterEmail}</ItemWho>
                <StatusTag $open={t.status === "open"}>{t.status}</StatusTag>
              </ItemTop>
              <ItemSub>{t.messageCount} message{t.messageCount === 1 ? "" : "s"}</ItemSub>
            </Item>
          ))}
        </List>
      )}
    </Wrap>
  );
}

// ── styles (gold, Front Desk) ───────────────────────────────────────────────
const G = "#f7b700";
const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  overflow: hidden;
`;
const Note = styled.div`
  padding: 1.5rem 0.75rem;
  text-align: center;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--t-textGhost);
`;
const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  overflow-y: auto;
`;
const Item = styled.button`
  appearance: none;
  cursor: pointer;
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.6rem 0.7rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.04);
  border: 1px solid rgba(${rgb.gold}, 0.18);
  &:hover {
    background: rgba(${rgb.gold}, 0.1);
  }
`;
const ItemTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
`;
const ItemWho = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--t-text);
`;
const ItemSub = styled.span`
  font-size: 0.72rem;
  color: var(--t-textGhost);
`;
const StatusTag = styled.span<{ $open: boolean }>`
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  color: ${(p) => (p.$open ? G : "#34d399")};
  background: ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.14)` : "rgba(16,185,129,0.14)")};
  border: 1px solid ${(p) => (p.$open ? `rgba(${rgb.gold}, 0.4)` : "rgba(16,185,129,0.4)")};
`;
const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;
const Back = styled.button`
  appearance: none;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  color: ${G};
  background: transparent;
  border: none;
`;
const BarWho = styled.div`
  font-size: 0.8rem;
  color: var(--t-text);
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  padding: 0.25rem;
`;
const MsgRow = styled.div<{ $staff: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${(p) => (p.$staff ? "flex-end" : "flex-start")};
  gap: 0.15rem;
`;
const MsgWho = styled.span`
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--t-textGhost);
`;
const MsgBubble = styled.div<{ $staff: boolean }>`
  max-width: 84%;
  padding: 0.45rem 0.65rem;
  border-radius: 0.7rem;
  font-size: 0.82rem;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
  color: ${(p) => (p.$staff ? "#1a1304" : "var(--t-text)")};
  background: ${(p) => (p.$staff ? `rgba(${rgb.gold}, 0.9)` : "var(--t-inputBg)")};
  border: 1px solid ${(p) => (p.$staff ? "transparent" : "var(--t-border)")};
`;
const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;
const ActBtn = styled.button<{ $danger?: boolean }>`
  appearance: none;
  cursor: pointer;
  padding: 0.35rem 0.7rem;
  font-size: 0.72rem;
  font-weight: 700;
  border-radius: 0.4rem;
  color: ${(p) => (p.$danger ? "#ff9a9a" : G)};
  background: ${(p) => (p.$danger ? "rgba(255,120,120,0.08)" : `rgba(${rgb.gold}, 0.12)`)};
  border: 1px solid ${(p) => (p.$danger ? "rgba(255,120,120,0.35)" : `rgba(${rgb.gold}, 0.4)`)};
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
const Composer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;
const Field = styled.textarea`
  flex: 1;
  resize: none;
  appearance: none;
  padding: 0.5rem 0.6rem;
  font-size: 0.82rem;
  font-family: inherit;
  border-radius: 0.5rem;
  color: var(--t-text);
  background: var(--t-inputBg);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  &:focus {
    outline: none;
    border-color: rgba(${rgb.gold}, 0.55);
  }
`;
const SendBtn = styled.button`
  appearance: none;
  cursor: pointer;
  padding: 0.5rem 0.9rem;
  font-size: 0.82rem;
  font-weight: 700;
  border-radius: 0.5rem;
  color: #1a1304;
  background: ${G};
  border: 1px solid transparent;
  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;
