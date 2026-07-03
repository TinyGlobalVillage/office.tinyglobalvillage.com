"use client";

// Recordings tab — call recordings as a drawer tab (operator layout
// 2026-07-03; sits alongside Alerts/Tickets/Voicemails). Same data as the
// gear → Saved Recordings modal: CDR rows with recordings, multi-part
// players for toggled calls, editable notes, styled delete.

import { useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import { TrashIcon, EditIcon } from "../icons";
import { askConfirm } from "../dialogService";
import { formatPhoneDisplay } from "@/lib/frontdesk/phoneFormat";
import type { CallRecord } from "@/lib/frontdesk/types";

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

const PeerLine = styled.div`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.45);
  [data-theme="light"] & { text-shadow: none; }
`;

const SubLine = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
  letter-spacing: 0.04em;
`;

const Audio = styled.audio`
  width: 100%;
  height: 2rem;
  margin-top: 0.25rem;
`;

const Notes = styled.textarea`
  width: 100%;
  min-height: 2.4rem;
  margin-top: 0.35rem;
  padding: 0.4rem 0.55rem;
  font-size: 0.75rem;
  font-family: inherit;
  background: rgba(0, 0, 0, 0.25);
  color: var(--t-text);
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.375rem;
  resize: vertical;
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.55); }
`;

const Btns = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  align-items: flex-end;
`;

const IconBtn = styled.button<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: transparent;
  border: 1px solid ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.45)` : `rgba(${rgb.gold}, 0.35)`)};
  color: ${(p) => (p.$danger ? colors.pink : colors.gold)};
  border-radius: 0.375rem;
  cursor: pointer;
  &:hover { background: ${(p) => (p.$danger ? `rgba(${rgb.pink}, 0.1)` : `rgba(${rgb.gold}, 0.1)`)}; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const SmallBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.35);
  color: ${colors.gold};
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
  &:hover:not(:disabled) { background: rgba(${rgb.gold}, 0.12); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Empty = styled.div`
  text-align: center;
  padding: 2rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

function fmtDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function fmtDuration(sec: number): string {
  if (!sec) return "0:00";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function RecordingsTab() {
  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/calls/recordings", { cache: "no-store" });
      if (!res.ok) { setCalls([]); return; }
      setCalls(((await res.json()) as { calls: CallRecord[] }).calls ?? []);
    } catch { setCalls([]); }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const saveNotes = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/frontdesk/calls/recordings/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: draftNotes }),
      });
      setEditingId(null);
      setDraftNotes("");
      await refresh();
    } finally { setBusyId(null); }
  };

  const remove = async (call: CallRecord) => {
    if (!(await askConfirm({
      title: "Delete recording?",
      message: "The audio file will be removed from disk; the call log entry stays.",
      confirmLabel: "Delete",
    }))) return;
    setBusyId(call.id);
    try {
      await fetch(`/api/frontdesk/calls/recordings/${call.id}`, { method: "DELETE" });
      await refresh();
    } finally { setBusyId(null); }
  };

  const sorted = (calls ?? []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const batchDelete = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!(await askConfirm({
      title: "Delete recordings?",
      message: `Delete ${ids.length} recording${ids.length === 1 ? "" : "s"}?`,
      detail: "Audio files are removed from disk; the call log entries stay.",
      confirmLabel: `Delete ${ids.length}`,
    }))) return;
    setBusyId("batch");
    try {
      for (const id of ids) {
        await fetch(`/api/frontdesk/calls/recordings/${id}`, { method: "DELETE" });
      }
      setSelected(new Set());
      setSelectMode(false);
      await refresh();
    } finally { setBusyId(null); }
  };

  return (
    <Wrap>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <SectionHead>Recordings</SectionHead>
        {sorted.length > 0 && (
          <div style={{ display: "flex", gap: "0.4rem" }}>
            {selectMode ? (
              <>
                <SmallBtn onClick={() => setSelected(new Set(sorted.map((c) => c.id)))}>All</SmallBtn>
                <SmallBtn onClick={() => { setSelectMode(false); setSelected(new Set()); }}>Cancel</SmallBtn>
                <SmallBtn disabled={selected.size === 0 || busyId === "batch"} onClick={batchDelete} style={{ borderColor: `rgba(${rgb.pink}, 0.4)`, color: colors.pink }}>
                  Delete ({selected.size})
                </SmallBtn>
              </>
            ) : (
              <SmallBtn onClick={() => setSelectMode(true)}>Select</SmallBtn>
            )}
          </div>
        )}
      </div>
      {calls === null && <Empty>Loading…</Empty>}
      {calls && sorted.length === 0 && <Empty>No saved recordings.</Empty>}
      {sorted.map((call) => {
        const peer = call.direction === "inbound" ? call.fromE164 : call.toE164;
        const partCount = call.recordingPaths?.length
          ? call.recordingPaths.length
          : (call.recordingPath ? 1 : 0);
        const isEditing = editingId === call.id;
        return (
          <Row
            key={call.id}
            onClick={selectMode ? () => toggleSel(call.id) : undefined}
            style={selectMode ? { cursor: "pointer" } : undefined}
          >
            <div style={{ minWidth: 0 }}>
              <PeerLine>
                {selectMode && (
                  <input type="checkbox" checked={selected.has(call.id)} readOnly style={{ accentColor: colors.pink, marginRight: "0.5rem" }} />
                )}
                {call.direction === "inbound" ? "←" : "→"} {formatPhoneDisplay(peer) || peer}
              </PeerLine>
              <SubLine>
                {fmtDateTime(call.startedAt)} · {fmtDuration(call.durationSec)} · {call.outcome}
                {call.consentAcknowledged ? " · consent ✓" : " · no consent"}
                {partCount > 1 ? ` · ${partCount} parts` : ""}
              </SubLine>
              {Array.from({ length: partCount }, (_, i) => (
                <div key={i}>
                  {partCount > 1 && <SubLine>Part {i + 1}</SubLine>}
                  <Audio
                    controls
                    preload="none"
                    src={`/api/frontdesk/calls/recordings/${call.id}/audio${i > 0 ? `?part=${i}` : ""}`}
                  />
                </div>
              ))}
              {isEditing ? (
                <>
                  <Notes
                    autoFocus
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                    placeholder="Notes for this call…"
                  />
                  <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.35rem" }}>
                    <SmallBtn disabled={busyId === call.id} onClick={() => saveNotes(call.id)}>Save</SmallBtn>
                    <SmallBtn onClick={() => { setEditingId(null); setDraftNotes(""); }}>Cancel</SmallBtn>
                  </div>
                </>
              ) : (
                call.notes && <SubLine>{call.notes}</SubLine>
              )}
            </div>
            <Btns>
              <IconBtn
                title="Edit notes"
                onClick={() => { setEditingId(call.id); setDraftNotes(call.notes ?? ""); }}
              >
                <EditIcon size={12} />
              </IconBtn>
              <IconBtn
                $danger
                title="Delete recording"
                disabled={busyId === call.id}
                onClick={() => remove(call)}
              >
                <TrashIcon size={12} />
              </IconBtn>
            </Btns>
          </Row>
        );
      })}
    </Wrap>
  );
}
