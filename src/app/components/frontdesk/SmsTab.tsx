"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import styled from "styled-components";
import { ChatBar, type ChatBarHandle } from "@tgv/module-component-library/components/chat";
import { colors, rgb } from "../../theme";
import type { SmsMessage } from "@/lib/frontdesk/types";
import { SendIcon, PhoneIcon } from "../icons";
import ConfirmModal from "./ConfirmModal";

// Client-side phone normalizer (mirror of server's toE164 in lib/frontdesk/store.ts).
// Loose by design — accepts US 10/11 digit, +<digits>, or short codes.
function clientToE164(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const digitsOnly = trimmed.replace(/[^\d+]/g, "");
  if (!digitsOnly) return null;
  if (digitsOnly.startsWith("+")) {
    const clean = "+" + digitsOnly.slice(1).replace(/\D/g, "");
    return clean.length >= 5 ? clean : null;
  }
  const digits = digitsOnly.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 3 && digits.length <= 6) return digits;
  if (digits.length >= 7) return `+${digits}`;
  return null;
}

// ── Types ────────────────────────────────────────────────────────

type ThreadSummary = {
  peerE164: string;
  peerName: string | null;
  count: number;
  unread: number;
  lastMessage: SmsMessage | null;
  /** Front-Desk DID the thread is currently associated with (E.164). */
  ourDid: string | null;
};

type DidOption = { id: string; e164: string; label: string };

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
  grid-template-columns: 1fr auto auto;
  gap: 0.25rem 0.5rem;
  align-items: center;
  padding: 0.625rem 0.75rem;
  border-radius: 0.5rem;
  background: ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.08)` : "rgba(255,255,255,0.02)")};
  border: 1px solid ${(p) => (p.$unread ? `rgba(${rgb.gold}, 0.3)` : "transparent")};
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: rgba(${rgb.gold}, 0.12);
  }
  &:hover .row-trash { opacity: 1; }
`;

const RowTrashBtn = styled.button`
  appearance: none;
  border: 1px solid rgba(${rgb.pink}, 0.4);
  background: rgba(${rgb.pink}, 0.08);
  color: ${colors.pink};
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 0.85rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  &:hover { background: rgba(${rgb.pink}, 0.18); opacity: 1 !important; }
  &:focus-visible { opacity: 1; outline: 2px solid rgba(${rgb.pink}, 0.5); }
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

const BubbleRow = styled.div<{ $dir: "inbound" | "outbound" }>`
  position: relative;
  display: flex;
  flex-direction: ${(p) => (p.$dir === "outbound" ? "row-reverse" : "row")};
  align-items: center;
  gap: 0.4rem;
  &:hover button { opacity: 0.85; }
`;

const DeleteMsgBtn = styled.button`
  appearance: none;
  border: 1px solid rgba(${rgb.pink}, 0.35);
  background: rgba(${rgb.pink}, 0.06);
  color: ${colors.pink};
  width: 22px;
  height: 22px;
  border-radius: 50%;
  font-size: 0.75rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
  &:hover { background: rgba(${rgb.pink}, 0.18); opacity: 1 !important; }
  &:focus-visible { opacity: 1; outline: 2px solid rgba(${rgb.pink}, 0.5); }
`;

// Wrapper around ChatBar that pads + tints the bottom strip (gold accent).
const ComposerWrap = styled.div`
  padding: 0.5rem 0.75rem;
  border-top: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.04);
`;

// New-thread "To: <phone input>" header row.
const ToRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(${rgb.gold}, 0.15);
  background: rgba(${rgb.gold}, 0.05);
`;

const ToLabel = styled.span`
  color: ${colors.gold};
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
`;

const ToInput = styled.input`
  flex: 1;
  padding: 0.45rem 0.65rem;
  font-size: 0.875rem;
  color: var(--t-textBase);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.4rem;
  outline: none;
  font-family: var(--font-geist-mono), monospace;

  &:focus { border-color: rgba(${rgb.gold}, 0.65); box-shadow: 0 0 0 3px rgba(${rgb.gold}, 0.12); }
  &::placeholder { color: var(--t-textGhost); }

  [data-theme="light"] & { background: rgba(255, 255, 255, 0.7); }
`;

const ToValidity = styled.span<{ $ok: boolean }>`
  font-size: 0.6875rem;
  font-family: var(--font-geist-mono), monospace;
  color: ${(p) => (p.$ok ? colors.green : "var(--t-textGhost)")};
  white-space: nowrap;
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

// DID toggle — sits above the thread list. Two buttons today; will become a
// dropdown when a third DID is added.
const DidToggleRow = styled.div`
  display: flex;
  gap: 0.35rem;
  padding: 0.5rem 0.5rem 0;
`;

const DidToggleBtn = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.4rem 0.6rem;
  border-radius: 0.4rem;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  border: 1px solid
    ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.55)` : "rgba(255,255,255,0.1)")};
  background: ${(p) =>
    p.$active ? `rgba(${rgb.gold}, 0.18)` : "rgba(255,255,255,0.02)"};
  color: ${(p) => (p.$active ? colors.gold : "var(--t-textFaint)")};
  &:hover { background: ${(p) => (p.$active ? `rgba(${rgb.gold}, 0.28)` : "rgba(${rgb.gold}, 0.08)")}; }
`;

const DidPill = styled.span<{ $variant: "ours" | "ghost" }>`
  display: inline-block;
  padding: 0.1rem 0.4rem;
  margin-right: 0.3rem;
  border-radius: 0.3rem;
  font-size: 0.6rem;
  letter-spacing: 0.05em;
  font-family: var(--font-geist-mono), monospace;
  background: ${(p) => (p.$variant === "ours" ? `rgba(${rgb.gold}, 0.15)` : "rgba(255,255,255,0.05)")};
  color: ${(p) => (p.$variant === "ours" ? colors.gold : "var(--t-textGhost)")};
  border: 1px solid ${(p) => (p.$variant === "ours" ? `rgba(${rgb.gold}, 0.3)` : "transparent")};
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

/**
 * Compact DID label: prefer the human label's distinguishing token (e.g. "707"
 * vs "877"), falling back to the last 4 digits of the E.164.
 */
function shortDid(e164: string, dids: DidOption[]): string {
  const did = dids.find((d) => d.e164 === e164);
  if (did) {
    const m = did.label.match(/(\d{3,})/g);
    if (m) return m[0];
  }
  return e164.slice(-4);
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
  // DID toggle state — selected E.164 of one of our Front-Desk DIDs.
  const [dids, setDids] = useState<DidOption[]>([]);
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  // Compose-new-thread state. When `composing` is true, the SmsTab swaps to a
  // full-height compose view (editable phone input + ChatBar) instead of the
  // threads list. Replaces the old window.prompt() flow.
  const [composing, setComposing] = useState(false);
  const [composingTo, setComposingTo] = useState("");
  const composingToRef = useRef<HTMLInputElement>(null);
  const chatBarRef = useRef<ChatBarHandle>(null);

  // Refs mirror state so the SSE effect (which mounts once) can read the
  // latest values without re-subscribing every keystroke.
  const activePeerRef = useRef<string | null>(null);
  const loadMessagesRef = useRef<((peer: string) => void) | null>(null);

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

  // Keep refs in sync with the latest values.
  useEffect(() => { activePeerRef.current = activePeer; }, [activePeer]);
  useEffect(() => { loadMessagesRef.current = loadMessages; }, [loadMessages]);

  // Load active Front-Desk DIDs once (for the toggle row).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/frontdesk/dids");
        if (!res.ok) return;
        const j = await res.json();
        const activeFrontdesk: DidOption[] = (j.dids ?? [])
          .filter((d: { releasedAt: string | null; assignment: { kind: string } }) =>
            !d.releasedAt && d.assignment?.kind === "frontdesk"
          )
          .map((d: { id: string; e164: string; label: string }) => ({
            id: d.id, e164: d.e164, label: d.label,
          }));
        setDids(activeFrontdesk);
        if (activeFrontdesk.length > 0 && !selectedDid) {
          setSelectedDid(activeFrontdesk[0].e164);
        }
      } catch {
        /* offline */
      }
    })();
  }, [selectedDid]);

  useEffect(() => {
    loadThreads();
    // Slow polling fallback in case the SSE connection drops without notice.
    const id = setInterval(loadThreads, 30_000);
    return () => clearInterval(id);
  }, [loadThreads]);

  // SSE: refresh the thread list (and the active thread, if matching) the
  // instant a new inbound SMS lands. No page refresh needed.
  useEffect(() => {
    const es = new EventSource("/api/frontdesk/sms/stream");
    es.addEventListener("inbound", (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { fromE164?: string };
        loadThreads();
        if (data.fromE164 && data.fromE164 === activePeerRef.current) {
          loadMessagesRef.current?.(data.fromE164);
        }
      } catch {
        loadThreads();
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; just suppress noisy console errors.
    };
    return () => es.close();
  }, []);

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

  const deleteMsg = useCallback(
    async (messageId: string) => {
      if (!activePeer) return;
      if (!confirm("Delete this message? This affects the Front Desk view only.")) return;
      try {
        const res = await fetch(
          `/api/frontdesk/sms/threads/${encodeURIComponent(activePeer)}/messages/${encodeURIComponent(messageId)}`,
          { method: "DELETE" }
        );
        if (!res.ok) return;
        await loadMessages(activePeer);
        await loadThreads();
      } catch {
        /* ignore */
      }
    },
    [activePeer, loadMessages, loadThreads]
  );

  // Confirmation state — shared by thread-list trash button and header trash button.
  const [trashTarget, setTrashTarget] = useState<{ peer: string; name: string } | null>(null);

  const trashThread = useCallback((peer: string, name: string) => {
    setTrashTarget({ peer, name });
  }, []);

  const confirmTrashThread = useCallback(async () => {
    if (!trashTarget) return;
    try {
      const res = await fetch(
        `/api/frontdesk/sms/threads/${encodeURIComponent(trashTarget.peer)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        if (trashTarget.peer === activePeer) {
          setActivePeer(null);
          setActivePeerName(null);
          setMessages([]);
        }
        await loadThreads();
      }
    } finally {
      setTrashTarget(null);
    }
  }, [trashTarget, activePeer, loadThreads]);

  const deleteCurrentThread = useCallback(() => {
    if (!activePeer) return;
    setTrashTarget({ peer: activePeer, name: activePeerName ?? activePeer });
  }, [activePeer, activePeerName]);

  const sendNew = async () => {
    if (!activePeer || !draft.trim() || sending) return;
    // Client-side phone validation. activePeer is whatever the user typed in
    // the new-thread compose flow (could be raw, e.g. "555-1234"); normalize
    // before posting and alert on bad input so the user gets feedback instead
    // of a silent no-op.
    const e164 = clientToE164(activePeer);
    if (!e164) {
      window.alert(`"${activePeer}" isn't a valid phone number. Use the back arrow and fix it.`);
      return;
    }
    setSending(true);
    try {
      // Prefer the active thread's existing ourDid; if it's a brand-new
      // thread (no ourDid yet), use the DID currently selected in the toggle.
      const thread = threads.find((t) => t.peerE164 === e164);
      const fromE164 = thread?.ourDid ?? selectedDid ?? undefined;
      const res = await fetch("/api/frontdesk/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: e164, body: draft, fromE164 }),
      });
      if (res.ok) {
        setDraft("");
        // If the user typed a non-canonical form (e.g. "5551234567"), swap
        // activePeer over to the normalized E.164 so subsequent sends/loads use it.
        if (activePeer !== e164) {
          setActivePeer(e164);
          await loadMessages(e164);
        } else {
          await loadMessages(activePeer);
        }
        await loadThreads();
      } else {
        const err = await res.json().catch(() => ({}));
        window.alert(`Couldn't send: ${err?.error ?? `HTTP ${res.status}`}`);
      }
    } catch (err) {
      window.alert(`Couldn't send: ${(err as Error).message}`);
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

  // Open the inline compose-new-thread view (replaces the old window.prompt flow).
  const startNewThread = () => {
    setComposing(true);
    setComposingTo("");
    setDraft("");
    // Focus the To field on the next paint.
    setTimeout(() => composingToRef.current?.focus(), 0);
  };

  // Press Enter on the "To" input → advance to the chat UI even if the number
  // is invalid (per UX request). Validation alert fires later, on send.
  const lockInComposeNumber = () => {
    const raw = composingTo.trim();
    if (!raw) return;
    const e164 = clientToE164(raw);
    setActivePeer(e164 ?? raw);
    setActivePeerName(null);
    setMessages([]);
    setComposing(false);
    setComposingTo("");
    // chatBarRef auto-focuses via the activePeer effect below.
  };

  const cancelCompose = () => {
    setComposing(false);
    setComposingTo("");
    setDraft("");
  };

  // Auto-focus the message field whenever we enter the conversation view.
  useEffect(() => {
    if (!activePeer) return;
    const id = setTimeout(() => chatBarRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [activePeer]);

  // Filter threads by selected DID. Threads with no ourDid yet (pre-DID-tracking
  // threads from before this feature) show under whichever DID is selected so
  // they don't disappear silently.
  const visibleThreads = selectedDid
    ? threads.filter((t) => !t.ourDid || t.ourDid === selectedDid)
    : threads;

  // ── Compose-new-thread view (replaces the old window.prompt) ─────────────
  // Just a phone-number prompt. Press Enter → advance to the conv view, even
  // if the number is malformed. Validation/alert happens at send time.
  if (composing) {
    const e164Preview = clientToE164(composingTo);
    const validPhone = !!e164Preview;
    return (
      <ConvWrap>
        <ConvHead>
          <BackBtn onClick={cancelCompose}>← Cancel</BackBtn>
          <ConvTitle>New SMS</ConvTitle>
        </ConvHead>
        <ToRow>
          <ToLabel>To</ToLabel>
          <ToInput
            ref={composingToRef}
            type="tel"
            inputMode="tel"
            placeholder="+1 555 555 5555"
            value={composingTo}
            onChange={(e) => setComposingTo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lockInComposeNumber();
              }
            }}
          />
          <ToValidity $ok={validPhone}>
            {composingTo.trim() === ""
              ? "press enter when ready"
              : validPhone
                ? `${e164Preview} — press enter`
                : "press enter to use anyway"}
          </ToValidity>
        </ToRow>
        <Messages>
          <Empty>Press Enter to start the chat.</Empty>
        </Messages>
      </ConvWrap>
    );
  }

  if (!activePeer) {
    return (
      <Wrap>
        {dids.length >= 2 && (
          <DidToggleRow>
            {dids.map((d) => (
              <DidToggleBtn
                key={d.id}
                type="button"
                $active={selectedDid === d.e164}
                onClick={() => setSelectedDid(d.e164)}
                title={`Show threads for ${d.label} (${d.e164})`}
              >
                {d.label.replace(/^TGV\s+/, "")}
              </DidToggleBtn>
            ))}
          </DidToggleRow>
        )}
        <NewBtn type="button" onClick={startNewThread}>+ New thread</NewBtn>
        {visibleThreads.length === 0 ? (
          <Empty>
            {threads.length === 0
              ? "No SMS threads yet."
              : `No threads on ${dids.find(d => d.e164 === selectedDid)?.label ?? selectedDid}.`}
          </Empty>
        ) : (
          <ThreadList>
            {visibleThreads.map(t => (
              <ThreadRow key={t.peerE164} $unread={t.unread > 0} onClick={() => openThread(t.peerE164, t.peerName)}>
                <PeerName>
                  {t.peerName ?? t.peerE164}
                  {t.unread > 0 && <UnreadPill>{t.unread}</UnreadPill>}
                </PeerName>
                <Time>{t.lastMessage ? formatRelTime(t.lastMessage.createdAt) : ""}</Time>
                <RowTrashBtn
                  className="row-trash"
                  type="button"
                  title={`Move conversation with ${t.peerName ?? t.peerE164} to trash`}
                  aria-label="Move thread to trash"
                  onClick={(e) => { e.stopPropagation(); trashThread(t.peerE164, t.peerName ?? t.peerE164); }}
                >🗑</RowTrashBtn>
                <Preview>
                  {t.ourDid && dids.length >= 2 && (
                    <DidPill $variant="ours">{shortDid(t.ourDid, dids)}</DidPill>
                  )}
                  {t.lastMessage?.body ?? ""}
                </Preview>
              </ThreadRow>
            ))}
          </ThreadList>
        )}
        <ConfirmModal
          open={trashTarget !== null}
          title="Move to trash?"
          message={`Move the conversation with ${trashTarget?.name ?? ""} to trash?`}
          detail={`Threads in trash auto-delete after 30 days. You can restore until then from System Tools → SMS Trash.`}
          confirmLabel="Move to trash"
          cancelLabel="Keep"
          intent="danger"
          onConfirm={confirmTrashThread}
          onCancel={() => setTrashTarget(null)}
        />
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
        <CallLink
          type="button"
          onClick={deleteCurrentThread}
          title={`Delete conversation with ${activePeer}`}
          style={{ borderColor: `rgba(${rgb.pink}, 0.45)`, color: colors.pink }}
        >
          🗑 Delete
        </CallLink>
      </ConvHead>

      <Messages ref={messagesRef}>
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          messages.map(m => (
            <Fragment key={m.id}>
              <BubbleRow $dir={m.direction}>
                <Bubble $dir={m.direction}>{m.body}</Bubble>
                <DeleteMsgBtn
                  type="button"
                  title="Delete message"
                  aria-label="Delete message"
                  onClick={() => deleteMsg(m.id)}
                >×</DeleteMsgBtn>
              </BubbleRow>
              <BubbleMeta $dir={m.direction}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </BubbleMeta>
            </Fragment>
          ))
        )}
      </Messages>

      <ComposerWrap>
        <ChatBar
          ref={chatBarRef}
          value={draft}
          onChange={setDraft}
          onSend={sendNew}
          sending={sending}
          disabled={sending}
          placeholder="Message…"
          accent={colors.gold}
          sendIcon={<SendIcon size={14} />}
        />
      </ComposerWrap>
      <ConfirmModal
        open={trashTarget !== null}
        title="Move to trash?"
        message={`Move the conversation with ${trashTarget?.name ?? ""} to trash?`}
        detail={`Threads in trash auto-delete after 30 days. You can restore until then from System Tools → SMS Trash.`}
        confirmLabel="Move to trash"
        cancelLabel="Keep"
        intent="danger"
        onConfirm={confirmTrashThread}
        onCancel={() => setTrashTarget(null)}
      />
    </ConvWrap>
  );
}
