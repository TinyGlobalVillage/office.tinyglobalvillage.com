"use client";

// SavedCallsModal — admin surface for listening back, editing notes, and
// deleting Front Desk call recordings. Surfaced from the PhoneTab settings
// row (gear icon → "Saved Recordings"). Outbound recording is OPT-IN
// (2026-07-02, supersedes the Item 4 / B2 opt-out default): calls record
// only when the operator checks the box or hits the mid-call REC toggle;
// inbound recordings only exist when the caller pressed 1 at the consent
// IVR. This modal is the one place admins can
// curate what's kept on disk; deletion removes the audio file (and its
// .gpg sibling, see Item 3) and nulls out the CDR's recordingPath.

import { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useEscapeToClose } from "@tgv/module-component-library/components/hooks/useEscapeToClose";
import { colors, rgb } from "@/app/theme";
import {
  ModalBackdrop,
  ModalContainer,
  ModalHeader,
  ModalHeaderLeft,
  ModalTitle,
  ModalBody,
} from "@/app/styled";
import NeonX from "../NeonX";
import { TrashIcon, EditIcon } from "../icons";
import type { CallRecord } from "@/lib/frontdesk/types";
import { formatPhoneDisplay } from "@/lib/frontdesk/phoneFormat";
import { askConfirm } from "../dialogService";

export type SavedCallsModalProps = { onClose: () => void };

const Stack = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
`;

const Empty = styled.div`
  color: var(--t-textFaint); font-size: 0.8125rem; text-align: center;
  padding: 2rem 1rem; font-style: italic;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid rgba(${rgb.gold}, 0.25);
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const Meta = styled.div`
  display: flex; flex-direction: column; gap: 0.25rem; min-width: 0;
`;

const PeerLine = styled.div`
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.8125rem;
  color: ${colors.gold};
  font-weight: 600;
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.45);
  [data-theme="light"] & { text-shadow: none; }
`;

const SubLine = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textFaint);
  font-family: var(--font-geist-mono), monospace;
  letter-spacing: 0.04em;
`;

const Notes = styled.textarea`
  width: 100%;
  min-height: 2.4rem;
  padding: 0.4rem 0.55rem;
  font-size: 0.75rem;
  font-family: inherit;
  background: rgba(0,0,0,0.25);
  color: var(--t-text);
  border: 1px solid rgba(${rgb.gold}, 0.18);
  border-radius: 0.375rem;
  resize: vertical;
  &:focus { outline: none; border-color: rgba(${rgb.gold}, 0.55); }
`;

const Audio = styled.audio`
  width: 100%;
  height: 2rem;
  margin-top: 0.25rem;
`;

const Btns = styled.div`
  display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-end;
`;

const IconBtn = styled.button<{ $danger?: boolean }>`
  display: inline-flex; align-items: center; justify-content: center;
  width: 2rem; height: 2rem;
  background: transparent;
  border: 1px solid ${p => p.$danger ? `rgba(${rgb.pink}, 0.45)` : `rgba(${rgb.gold}, 0.35)`};
  color: ${p => p.$danger ? colors.pink : colors.gold};
  border-radius: 0.375rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  &:hover {
    background: ${p => p.$danger ? `rgba(${rgb.pink}, 0.1)` : `rgba(${rgb.gold}, 0.1)`};
  }
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

export default function SavedCallsModal({ onClose }: SavedCallsModalProps) {
  useEscapeToClose({ open: true, onClose });

  const [calls, setCalls] = useState<CallRecord[] | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/frontdesk/calls/recordings", {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) { setCalls([]); return; }
    const data = (await res.json()) as { calls: CallRecord[] };
    setCalls(data.calls);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleSaveNotes = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/frontdesk/calls/recordings/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notes: draftNotes }),
      });
      setEditingId(null);
      setDraftNotes("");
      await refresh();
    } finally { setBusyId(null); }
  }, [draftNotes, refresh]);

  const handleDelete = useCallback(async (id: string) => {
    if (!(await askConfirm({
      title: "Delete recording?",
      message: "The audio file will be removed from disk; the call log entry stays.",
      confirmLabel: "Delete",
    }))) return;
    setBusyId(id);
    try {
      await fetch(`/api/frontdesk/calls/recordings/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      await refresh();
    } finally { setBusyId(null); }
  }, [refresh]);

  const sorted = useMemo(() => {
    return (calls ?? []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, [calls]);

  return (
    <ModalBackdrop onClick={onClose}>
      <ModalContainer $accent="gold" $maxWidth="42rem" onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalHeaderLeft>
            <ModalTitle>Saved Recordings</ModalTitle>
          </ModalHeaderLeft>
          <NeonX onClick={onClose} />
        </ModalHeader>
        <ModalBody>
          <Stack>
            {calls === null && <Empty>Loading…</Empty>}
            {calls && sorted.length === 0 && <Empty>No saved recordings.</Empty>}
            {sorted.map(call => {
              const peer = call.direction === "inbound" ? call.fromE164 : call.toE164;
              const isEditing = editingId === call.id;
              // Mid-call toggling produces one file per recorded stretch.
              const partCount = call.recordingPaths?.length
                ? call.recordingPaths.length
                : (call.recordingPath ? 1 : 0);
              return (
                <Row key={call.id}>
                  <Meta>
                    <PeerLine>
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
                          onChange={e => setDraftNotes(e.target.value)}
                          placeholder="Notes for this call…"
                        />
                        <SubLine>
                          <button
                            disabled={busyId === call.id}
                            onClick={() => handleSaveNotes(call.id)}
                            style={{ marginRight: "0.5rem" }}
                          >Save</button>
                          <button onClick={() => { setEditingId(null); setDraftNotes(""); }}>Cancel</button>
                        </SubLine>
                      </>
                    ) : (
                      call.notes && <SubLine>📝 {call.notes}</SubLine>
                    )}
                  </Meta>
                  <Btns>
                    <IconBtn
                      title="Edit notes"
                      onClick={() => { setEditingId(call.id); setDraftNotes(call.notes ?? ""); }}
                    >
                      <EditIcon />
                    </IconBtn>
                    <IconBtn
                      $danger
                      title="Delete recording"
                      disabled={busyId === call.id}
                      onClick={() => handleDelete(call.id)}
                    >
                      <TrashIcon />
                    </IconBtn>
                  </Btns>
                </Row>
              );
            })}
          </Stack>
        </ModalBody>
      </ModalContainer>
    </ModalBackdrop>
  );
}
