"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styled from "styled-components";
import { colors, rgb } from "../../theme";
import type { CallRecord, Did, ShiftAssignment } from "@/lib/frontdesk/types";
import ShiftWorkerModal from "./ShiftWorkerModal";
import DidManagerModal from "./DidManagerModal";
import SystemToolsModal from "./SystemToolsModal";
import NeonLineDDM from "./NeonLineDDM";
import { EditIcon, TrashIcon, SettingsIcon } from "../icons";
import { useSoftphone } from "@/lib/frontdesk/useSoftphone";
import { playDtmf } from "@/lib/frontdesk/ringTones";

// ── Styled ───────────────────────────────────────────────────────

const Wrap = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
`;

const SectionHead = styled.div`
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.45);
  margin: 0;
  [data-theme="light"] & { text-shadow: none; }
`;

const LineCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.625rem 0.875rem;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.06);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.5);
  [data-theme="light"] & { text-shadow: none; }
`;

const LineLabel = styled.span`
  font-weight: 700;
`;

const LineNum = styled.span`
  letter-spacing: 0.04em;
`;

const LineSelect = styled.select`
  width: 100%;
  padding: 0.55rem 0.75rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${colors.gold};
  text-shadow: 0 0 4px rgba(${rgb.gold}, 0.5);
  background: rgba(${rgb.gold}, 0.06);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.5rem;
  outline: none;
  cursor: pointer;
  appearance: none;
  background-image: linear-gradient(45deg, transparent 50%, ${colors.gold} 50%),
                    linear-gradient(135deg, ${colors.gold} 50%, transparent 50%);
  background-position: calc(100% - 14px) 50%, calc(100% - 9px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  padding-right: 2rem;

  &:focus {
    border-color: rgba(${rgb.gold}, 0.65);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.3);
  }

  option {
    background: #1a1408;
    color: ${colors.gold};
  }

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.6);
    color: #a87a00;
    text-shadow: none;
    option { background: #fff; color: #a87a00; }
  }
`;

const Display = styled.input`
  width: 100%;
  padding: 0.75rem 1rem;
  font-family: var(--font-geist-mono), monospace;
  font-size: 1.375rem;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.08em;
  color: ${colors.gold};
  text-shadow: 0 0 6px rgba(${rgb.gold}, 0.5);
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(${rgb.gold}, 0.35);
  border-radius: 0.625rem;
  outline: none;

  &:focus {
    border-color: rgba(${rgb.gold}, 0.65);
    box-shadow: 0 0 10px rgba(${rgb.gold}, 0.3);
  }

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.7);
    color: #a87a00;
    text-shadow: none;
  }
`;

const KeypadGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
`;

const Key = styled.button`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0.875rem 0;
  background: rgba(${rgb.gold}, 0.08);
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.625rem;
  color: ${colors.gold};
  font-family: var(--font-geist-mono), monospace;
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.12s, transform 0.08s;

  &:hover {
    background: rgba(${rgb.gold}, 0.18);
    box-shadow: 0 0 8px rgba(${rgb.gold}, 0.35);
  }
  &:active { transform: translateY(1px); }

  .digit {
    font-size: 1.375rem;
    font-weight: 700;
    text-shadow: 0 0 6px rgba(${rgb.gold}, 0.55);
  }
  .letters {
    font-size: 0.625rem;
    letter-spacing: 0.12em;
    opacity: 0.7;
    margin-top: 2px;
  }

  [data-theme="light"] & {
    color: #a87a00;
    .digit { text-shadow: none; }
  }
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const CallBtn = styled.button<{ $variant: "call" | "hangup" }>`
  flex: 1;
  padding: 0.75rem 1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.625rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$variant === "call" ? `rgba(${rgb.green}, 0.55)` : `rgba(${rgb.pink}, 0.55)`)};
  background: ${(p) => (p.$variant === "call" ? `rgba(${rgb.green}, 0.18)` : `rgba(${rgb.pink}, 0.18)`)};
  color: ${(p) => (p.$variant === "call" ? colors.green : colors.pink)};
  text-shadow: 0 0 6px ${(p) => (p.$variant === "call" ? `rgba(${rgb.green}, 0.55)` : `rgba(${rgb.pink}, 0.55)`)};
  transition: background 0.12s, box-shadow 0.12s;

  &:hover:not(:disabled) {
    background: ${(p) => (p.$variant === "call" ? `rgba(${rgb.green}, 0.32)` : `rgba(${rgb.pink}, 0.32)`)};
    box-shadow: 0 0 10px ${(p) => (p.$variant === "call" ? `rgba(${rgb.green}, 0.5)` : `rgba(${rgb.pink}, 0.5)`)};
  }
  &:disabled { opacity: 0.4; cursor: not-allowed; }

  [data-theme="light"] & { text-shadow: none; }
`;

const EraseBtn = styled.button`
  padding: 0 0.75rem;
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  border-radius: 0.625rem;
  color: ${colors.gold};
  font-size: 1.125rem;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.14); }
`;

const Log = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const LogRow = styled.li<{ $tint?: string | null }>`
  display: grid;
  grid-template-columns: 1.25rem 1fr auto auto;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  background: ${(p) => (p.$tint ? `${p.$tint}1a` : "rgba(255, 255, 255, 0.02)")};
  border-left: 3px solid ${(p) => (p.$tint ? p.$tint : "transparent")};
  cursor: pointer;
  transition: background 0.12s;
  &:hover {
    background: ${(p) => (p.$tint ? `${p.$tint}2e` : `rgba(${rgb.gold}, 0.14)`)};
    box-shadow: inset 0 0 0 1px ${(p) => (p.$tint ? `${p.$tint}77` : `rgba(${rgb.gold}, 0.25)`)};
  }
  .row-trash { opacity: 0; transition: opacity 0.12s; }
  &:hover .row-trash { opacity: 1; }
`;

const AnsweredBy = styled.span<{ $color: string }>`
  display: inline-flex;
  align-items: center;
  margin-left: 0.4rem;
  padding: 0.05rem 0.4rem;
  border-radius: 0.3rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: ${(p) => `${p.$color}33`};
  color: ${(p) => p.$color};
  border: 1px solid ${(p) => `${p.$color}77`};
  white-space: nowrap;
`;

const RowTrash = styled.button`
  background: transparent;
  border: none;
  padding: 0.15rem;
  color: ${colors.pink};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;
  &:hover {
    background: rgba(${rgb.pink}, 0.18);
    box-shadow: 0 0 6px rgba(${rgb.pink}, 0.45);
  }
`;

const CallsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ClearAllBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(${rgb.pink}, 0.4);
  color: ${colors.pink};
  padding: 0.2rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-radius: 0.35rem;
  cursor: pointer;
  &:hover {
    background: rgba(${rgb.pink}, 0.14);
    box-shadow: 0 0 6px rgba(${rgb.pink}, 0.4);
  }
`;

const Arrow = styled.span<{ $dir: "inbound" | "outbound" }>`
  font-family: var(--font-geist-mono), monospace;
  font-weight: 800;
  font-size: 0.875rem;
  color: ${(p) => (p.$dir === "inbound" ? colors.green : colors.gold)};
`;

const Peer = styled.span`
  color: var(--t-textBase);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Meta = styled.span`
  color: var(--t-textGhost);
  font-family: var(--font-geist-mono), monospace;
  font-size: 0.6875rem;
`;

const Empty = styled.div`
  text-align: center;
  padding: 1.5rem 0;
  color: var(--t-textGhost);
  font-size: 0.8125rem;
`;

const ShiftBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.45rem 0.6rem;
  border-radius: 0.5rem;
  background: rgba(${rgb.gold}, 0.05);
  border: 1px solid rgba(${rgb.gold}, 0.2);
  font-size: 0.8125rem;
`;

const ShiftLabel = styled.span`
  color: var(--t-textFaint);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.6875rem;
  font-weight: 700;
`;

const ShiftName = styled.span`
  color: ${colors.gold};
  font-weight: 600;
  margin-left: 0.35rem;
`;

const AdminRow = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const AdminBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.55rem;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.4);
  border-radius: 0.35rem;
  color: ${colors.gold};
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.14); }
  svg { width: 10px; height: 10px; }
`;

// ── Helpers ──────────────────────────────────────────────────────

const KEYPAD: Array<{ digit: string; letters: string }> = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
];

function formatDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPeer(call: CallRecord): string {
  return call.direction === "inbound" ? call.fromE164 : call.toE164;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Normalize what the user typed into E.164. Rules:
 *   - Strip anything that isn't a digit or leading '+'.
 *   - 10 digits → assume US, prefix +1.
 *   - 11 digits starting with 1 → prefix +.
 *   - Already starts with + → keep as-is (strip non-digits after +).
 *   - Everything else → return null (invalid).
 */
function normalizeDial(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("+")) {
    const digits = trimmed.slice(1).replace(/\D/g, "");
    return digits ? `+${digits}` : null;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 4 && digits.startsWith("10")) return digits; // internal ext 10xx
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  return null;
}

// ── Component ────────────────────────────────────────────────────

const EXEC_USERNAMES = new Set(["admin", "marmar"]);

export default function PhoneTab() {
  const [input, setInput] = useState("");
  const [dids, setDids] = useState<Did[]>([]);
  const [fromDidId, setFromDidId] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [shift, setShift] = useState<ShiftAssignment | null>(null);
  const [me, setMe] = useState<{ username: string; displayName: string } | null>(null);
  const [profiles, setProfiles] = useState<Array<{
    username: string;
    displayName: string;
    accentColor?: string;
  }>>([]);
  const [modal, setModal] = useState<"tools" | "shift" | "dids" | null>(null);
  const isExec = me ? EXEC_USERNAMES.has(me.username) : false;

  const softphone = useSoftphone();
  const onCall = softphone.callState === "establishing" || softphone.callState === "established";

  const activeDids = useMemo(
    () => dids.filter(d => !d.releasedAt),
    [dids],
  );

  const defaultDid = useMemo(
    () => activeDids.find(d => d.assignment.kind === "frontdesk") ?? activeDids[0] ?? null,
    [activeDids],
  );

  const selectedDid = useMemo(
    () => activeDids.find(d => d.id === fromDidId) ?? defaultDid,
    [activeDids, fromDidId, defaultDid],
  );

  const loadAll = useCallback(async () => {
    try {
      const [didsRes, callsRes, shiftRes, meRes, profilesRes] = await Promise.all([
        fetch("/api/frontdesk/dids"),
        fetch("/api/frontdesk/calls/history?limit=50"),
        fetch("/api/frontdesk/shift"),
        fetch("/api/users/me"),
        fetch("/api/users/profile"),
      ]);
      if (didsRes.ok) setDids((await didsRes.json()).dids ?? []);
      if (callsRes.ok) setCalls((await callsRes.json()).calls ?? []);
      if (shiftRes.ok) setShift((await shiftRes.json()).shift ?? null);
      if (meRes.ok) {
        const j = await meRes.json();
        setMe({ username: j.username, displayName: j.displayName });
      }
      if (profilesRes.ok) {
        const j = await profilesRes.json();
        setProfiles(j.profiles ?? []);
      }
    } catch {
      // Offline — leave state as-is.
    }
  }, []);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 15_000);
    return () => clearInterval(id);
  }, [loadAll]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { to?: string; autoDial?: boolean } | undefined;
      if (!detail?.to) return;
      setInput(detail.to);
    };
    window.addEventListener("frontdesk-dial-prefill", handler);
    return () => window.removeEventListener("frontdesk-dial-prefill", handler);
  }, []);

  const pressKey = (digit: string) => {
    playDtmf(digit);
    if (onCall && softphone.callState === "established") {
      softphone.dtmf(digit);
    } else {
      setInput(prev => (prev + digit).slice(0, 24));
    }
  };
  const backspace = () => setInput(prev => prev.slice(0, -1));

  // Track the currently-dialing call so we can log it when it ends.
  const activeCallRef = useRef<{
    toE164: string;
    fromE164: string;
    direction: "inbound" | "outbound";
    startedAt: string;
    answeredAt: string | null;
  } | null>(null);
  const prevCallStateRef = useRef(softphone.callState);

  useEffect(() => {
    const prev = prevCallStateRef.current;
    const curr = softphone.callState;
    prevCallStateRef.current = curr;

    if (curr === "established" && activeCallRef.current && !activeCallRef.current.answeredAt) {
      activeCallRef.current.answeredAt = new Date().toISOString();
    }
    if (curr === "terminated" && prev !== "terminated" && activeCallRef.current) {
      const call = activeCallRef.current;
      activeCallRef.current = null;
      const outcome = call.answeredAt ? "answered" : "missed";
      fetch("/api/frontdesk/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: call.direction,
          fromE164: call.fromE164,
          toE164: call.toE164,
          startedAt: call.startedAt,
          answeredAt: call.answeredAt,
          endedAt: new Date().toISOString(),
          outcome,
        }),
      }).then(() => loadAll()).catch(() => { /* offline — skip */ });
    }
  }, [softphone.callState, loadAll]);

  const dial = async () => {
    if (onCall) return;
    setError(null);
    if (softphone.status !== "registered") {
      setError(`Softphone ${softphone.status} — cannot dial`);
      return;
    }
    const normalized = normalizeDial(input);
    if (!normalized) {
      setError("Enter a valid phone number (10-digit US or full E.164)");
      return;
    }
    if (!selectedDid) {
      setError("No outbound line selected");
      return;
    }
    try {
      activeCallRef.current = {
        toE164: normalized,
        fromE164: selectedDid.e164,
        direction: "outbound",
        startedAt: new Date().toISOString(),
        answeredAt: null,
      };
      await softphone.dial(normalized.replace(/^\+/, ""), selectedDid.e164);
      setInput("");
    } catch (err) {
      activeCallRef.current = null;
      setError((err as Error).message);
    }
  };

  const hangup = () => softphone.hangup();

  return (
    <Wrap>
      <ShiftBar>
        <div>
          <ShiftLabel>On shift</ShiftLabel>
          <ShiftName>{shift?.username ?? "— (ring all online)"}</ShiftName>
        </div>
        {isExec && (
          <AdminRow>
            <AdminBtn type="button" onClick={() => setModal("tools")} title="System tools">
              <SettingsIcon size={10} /> Tools
            </AdminBtn>
            <AdminBtn type="button" onClick={() => setModal("shift")}>
              <EditIcon size={10} /> Shift
            </AdminBtn>
            <AdminBtn type="button" onClick={() => setModal("dids")}>
              <EditIcon size={10} /> DIDs
            </AdminBtn>
          </AdminRow>
        )}
      </ShiftBar>

      <SectionHead>Outbound Line</SectionHead>
      {activeDids.length === 0 ? (
        <Empty>No DID assigned. Admin can provision one in the Admin modal.</Empty>
      ) : activeDids.length === 1 ? (
        <LineCard>
          <LineLabel>{activeDids[0].label}</LineLabel>
          <LineNum>{activeDids[0].e164}</LineNum>
        </LineCard>
      ) : (
        <NeonLineDDM
          value={selectedDid?.id ?? null}
          onChange={(id) => setFromDidId(id)}
          disabled={onCall}
          title="Outbound caller-ID"
          options={activeDids.map(d => ({ id: d.id, label: d.label, sublabel: d.e164 }))}
        />
      )}

      <Display
        value={input}
        onChange={(e) => setInput(e.target.value.replace(/[^\d+*#]/g, "").slice(0, 24))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (onCall) hangup();
            else dial();
          }
        }}
        placeholder="5551234567 or +15551234567"
        inputMode="tel"
      />

      <KeypadGrid>
        {KEYPAD.map((k) => (
          <Key key={k.digit} onClick={() => pressKey(k.digit)} type="button">
            <span className="digit">{k.digit}</span>
            <span className="letters">{k.letters || "\u00A0"}</span>
          </Key>
        ))}
      </KeypadGrid>

      <ActionRow>
        <EraseBtn onClick={backspace} type="button" title="Backspace" disabled={onCall}>⌫</EraseBtn>
        {onCall ? (
          <CallBtn $variant="hangup" onClick={hangup} type="button">
            {softphone.callState === "establishing" ? "Cancel" : "Hang up"}
          </CallBtn>
        ) : (
          <CallBtn
            $variant="call"
            onClick={dial}
            type="button"
            disabled={!input.trim() || !selectedDid || softphone.status !== "registered"}
          >
            {softphone.status === "registered" ? "Call" : `SIP: ${softphone.status}`}
          </CallBtn>
        )}
      </ActionRow>
      {error && <Empty style={{ color: colors.pink }}>{error}</Empty>}
      {softphone.lastError && <Empty style={{ color: colors.pink }}>SIP: {softphone.lastError}</Empty>}

      <CallsHeader>
        <SectionHead>Recent calls</SectionHead>
        {isExec && calls.length > 0 && (
          <ClearAllBtn
            type="button"
            onClick={async () => {
              if (!confirm("Clear all recent calls? This cannot be undone.")) return;
              await fetch("/api/frontdesk/calls/history", { method: "DELETE" });
              loadAll();
            }}
          >
            Clear all
          </ClearAllBtn>
        )}
      </CallsHeader>
      {calls.length === 0 ? (
        <Empty>No calls yet.</Empty>
      ) : (
        <Log>
          {calls.slice(0, 25).map(c => {
            const handler = c.answeredBy
              ? profiles.find(p => p.username === c.answeredBy)
              : null;
            const tint = isExec && handler?.accentColor ? handler.accentColor : null;
            return (
            <LogRow
              key={c.id}
              $tint={tint}
              title={`${c.outcome} — click to dial`}
              onClick={() => {
                const peer = formatPeer(c).replace(/^\+/, "");
                setInput(peer);
                setError(null);
              }}
            >
              <Arrow $dir={c.direction}>{c.direction === "inbound" ? "↙" : "↗"}</Arrow>
              <Peer>
                {formatPeer(c)}
                <Meta style={{ marginLeft: "0.5rem" }}>{formatTimestamp(c.startedAt)}</Meta>
                {isExec && handler && (
                  <AnsweredBy $color={handler.accentColor ?? "#f7b700"}>
                    {handler.displayName}
                  </AnsweredBy>
                )}
              </Peer>
              <Meta>{formatDuration(c.durationSec)}</Meta>
              {isExec ? (
                <RowTrash
                  className="row-trash"
                  type="button"
                  title="Delete from history"
                  onClick={async (e) => {
                    e.stopPropagation();
                    await fetch(`/api/frontdesk/calls/history?id=${encodeURIComponent(c.id)}`, {
                      method: "DELETE",
                    });
                    loadAll();
                  }}
                >
                  <TrashIcon size={12} />
                </RowTrash>
              ) : (
                <span />
              )}
            </LogRow>
            );
          })}
        </Log>
      )}

      {modal === "tools" && (
        <SystemToolsModal
          onClose={() => { setModal(null); loadAll(); }}
          onShiftSaved={(s) => setShift(s)}
          onDidsChanged={() => loadAll()}
        />
      )}
      {modal === "shift" && (
        <ShiftWorkerModal
          onClose={() => setModal(null)}
          onSaved={(s) => setShift(s)}
        />
      )}
      {modal === "dids" && (
        <DidManagerModal
          onClose={() => { setModal(null); loadAll(); }}
        />
      )}
    </Wrap>
  );
}
