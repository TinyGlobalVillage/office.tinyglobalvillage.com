"use client";

// Voicemails tab — inbox for caller-left messages (drawer tab next to
// Alerts/Tickets, operator request 2026-07-03). Lists every recording the
// voicemail IVR saved (newest first) with inline playback and delete.
// Greeting management stays in System Tools → Voicemail.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { TrashIcon } from "../icons";
import { askConfirm } from "../dialogService";
import { formatPhoneDisplay } from "@/lib/frontdesk/phoneFormat";

type VmMessage = {
  id: string;
  filename: string;
  encrypted: boolean;
  recordedAt: string;
  uuid: string | null;
  bytes: number;
  callerE164: string | null;
};

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-gutter: stable both-edges;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
`;

const SectionHead = styled.div`
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.45);
  [data-theme="light"] & { text-shadow: none; }
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.7rem 0.875rem;
  border: 1px solid rgba(${rgb.gold}, 0.22);
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const Caller = styled.div`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.45);
  [data-theme="light"] & { text-shadow: none; }
`;

const Meta = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
  letter-spacing: 0.04em;
`;

const Audio = styled.audio`
  width: 100%;
  height: 2rem;
  margin-top: 0.35rem;
`;

const DeleteBtn = styled.button`
  align-self: start;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid rgba(${rgb.pink}, 0.45);
  color: ${colors.pink};
  border-radius: 0.375rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.pink}, 0.1); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 2rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

const HeadRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
`;

const HeadBtns = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const SmallBtn = styled.button<{ $danger?: boolean }>`
  background: transparent;
  border: 1px solid ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.4)` : `rgba(${rgb.gold}, 0.35)`)};
  color: ${(p) => (p.$danger ? colors.pink : colors.gold)};
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
  &:hover:not(:disabled) { background: ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.14)` : `rgba(${rgb.gold}, 0.12)`)}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const SelBox = styled.input`
  align-self: start;
  margin-top: 0.2rem;
  accent-color: ${colors.pink};
  cursor: pointer;
`;

function fmtWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return iso; }
}

/** 8 kHz mono s16 → ~16000 bytes/sec (only for plaintext WAVs). */
function fmtDuration(m: VmMessage): string {
  if (m.encrypted) return "";
  const sec = Math.max(0, Math.round((m.bytes - 44) / 16000));
  return ` · ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export default function VoicemailsTab() {
  const [messages, setMessages] = useState<VmMessage[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Batch delete (operator ask 2026-07-03) — one confirm for many rows.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/voicemail/messages", { cache: "no-store" });
      if (!res.ok) { setMessages([]); return; }
      const j = await res.json();
      setMessages(j.messages ?? []);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const remove = async (m: VmMessage) => {
    const who = m.callerE164 ? formatPhoneDisplay(m.callerE164) || m.callerE164 : "this caller";
    if (!(await askConfirm({
      title: "Delete voicemail?",
      message: `Delete the voicemail from ${who}?`,
      detail: "The audio file is removed from disk. This cannot be undone.",
      confirmLabel: "Delete",
    }))) return;
    setBusyId(m.id);
    try {
      await fetch(`/api/frontdesk/voicemail/messages/${encodeURIComponent(m.id)}`, { method: "DELETE" });
      await load();
    } finally { setBusyId(null); }
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const batchDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!(await askConfirm({
      title: "Delete voicemails?",
      message: `Delete ${ids.length} voicemail${ids.length === 1 ? "" : "s"}?`,
      detail: "The audio files are removed from disk. This cannot be undone.",
      confirmLabel: `Delete ${ids.length}`,
    }))) return;
    setBusyId("batch");
    try {
      for (const id of ids) {
        await fetch(`/api/frontdesk/voicemail/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      setSelected(new Set());
      setSelectMode(false);
      await load();
    } finally { setBusyId(null); }
  };

  return (
    <Wrap>
      <HeadRow>
        <SectionHead>Voicemails</SectionHead>
        {(messages?.length ?? 0) > 0 && (
          <HeadBtns>
            {selectMode ? (
              <>
                <SmallBtn onClick={() => setSelected(new Set((messages ?? []).map((m) => m.id)))}>All</SmallBtn>
                <SmallBtn onClick={() => { setSelectMode(false); setSelected(new Set()); }}>Cancel</SmallBtn>
                <SmallBtn $danger disabled={selected.size === 0 || busyId === "batch"} onClick={batchDelete}>
                  Delete ({selected.size})
                </SmallBtn>
              </>
            ) : (
              <SmallBtn onClick={() => setSelectMode(true)}>Select</SmallBtn>
            )}
          </HeadBtns>
        )}
      </HeadRow>
      {messages === null && <Empty>Loading…</Empty>}
      {messages && messages.length === 0 && <Empty>No voicemails.</Empty>}
      {(messages ?? []).map((m) => (
        <Row
          key={m.id}
          onClick={selectMode ? () => toggleSel(m.id) : undefined}
          style={selectMode ? { cursor: "pointer" } : undefined}
        >
          <div style={{ minWidth: 0, display: "flex", gap: "0.6rem" }}>
            {selectMode && (
              <SelBox type="checkbox" checked={selected.has(m.id)} readOnly />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <Caller>
                {m.callerE164 ? (formatPhoneDisplay(m.callerE164) || m.callerE164) : "Unknown caller"}
              </Caller>
              <Meta>{fmtWhen(m.recordedAt)}{fmtDuration(m)}</Meta>
              {!selectMode && (
                <Audio controls preload="none" src={`/api/frontdesk/voicemail/messages/${encodeURIComponent(m.id)}/audio`} />
              )}
            </div>
          </div>
          {!selectMode && (
            <DeleteBtn
              title="Delete voicemail"
              disabled={busyId === m.id}
              onClick={() => remove(m)}
            >
              <TrashIcon size={12} />
            </DeleteBtn>
          )}
        </Row>
      ))}
    </Wrap>
  );
}
