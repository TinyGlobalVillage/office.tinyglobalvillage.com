"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import styled, { css, keyframes } from "styled-components";
import { colors, rgb } from "../../theme";
import type { CallRecord, Did } from "@/lib/frontdesk/types";
import NeonLineDDM from "./NeonLineDDM";
import { TrashIcon, PhoneIcon, RecordIcon } from "../icons";
import { FRONTDESK_DATA_CHANGED_EVENT } from "./FrontDeskShiftBar";
import { useSoftphone } from "@/lib/frontdesk/useSoftphone";
import { getCurrentCallId } from "@/lib/frontdesk/softphone";
import { consumePendingDial } from "@/lib/frontdesk/dialBus";
import { playDtmf } from "@/lib/frontdesk/ringTones";
import {
  formatPhoneInput,
  formatPhoneDisplay,
  nextRawFromDisplayEdit,
  stripPhoneFormatting,
} from "@/lib/frontdesk/phoneFormat";
import { askConfirm } from "../dialogService";

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

// ── In-call screens: the keypad transforms into a ringing view, then a live view ──
const ringShake = keyframes`
  0%, 55%, 100% { transform: rotate(0deg); }
  5%  { transform: rotate(-16deg); }
  15% { transform: rotate(13deg); }
  25% { transform: rotate(-10deg); }
  35% { transform: rotate(7deg); }
  45% { transform: rotate(-3deg); }
`;
const ringPulse = keyframes`
  0%   { transform: scale(0.75); opacity: 0.7; }
  100% { transform: scale(1.8);  opacity: 0; }
`;

const CallScreen = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.25rem 1rem 1.5rem;
  text-align: center;
  border: 1px solid rgba(${rgb.gold}, 0.22);
  border-radius: 0.875rem;
  background: rgba(${rgb.gold}, 0.04);
`;

const RingBadge = styled.div<{ $live: boolean }>`
  position: relative;
  width: 84px;
  height: 84px;
  margin-bottom: 0.375rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: ${(p) => (p.$live ? colors.green : colors.gold)};
  border: 1px solid rgba(${(p) => (p.$live ? rgb.green : rgb.gold)}, 0.45);
  background: rgba(${(p) => (p.$live ? rgb.green : rgb.gold)}, 0.1);

  & > svg {
    ${(p) => (p.$live ? "" : css`animation: ${ringShake} 1.4s ease-in-out infinite;`)}
  }

  &::before,
  &::after {
    content: "";
    position: absolute;
    inset: -1px;
    border-radius: 999px;
    border: 1px solid rgba(${(p) => (p.$live ? rgb.green : rgb.gold)}, 0.5);
    ${(p) => (p.$live ? "opacity: 0;" : css`animation: ${ringPulse} 1.8s ease-out infinite;`)}
  }
  &::after { animation-delay: 0.9s; }
`;

const CallStage = styled.div`
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--t-textFaint);
`;

const CallWho = styled.div`
  font-size: 1.3125rem;
  font-weight: 700;
  color: var(--t-text);
  font-family: var(--font-geist-mono), monospace;
  word-break: break-all;
`;

const CallHint = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
`;

const KeypadToggle = styled.button`
  background: transparent;
  border: 1px solid rgba(${rgb.gold}, 0.3);
  color: ${colors.gold};
  border-radius: 0.5rem;
  padding: 0.3rem 0.8rem;
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  &:hover { background: rgba(${rgb.gold}, 0.12); }
`;

const recBlink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
`;

const RecBtn = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.16)` : "transparent")};
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.55)` : `rgba(${rgb.gold}, 0.3)`)};
  color: ${(p) => (p.$on ? colors.pink : colors.gold)};
  border-radius: 0.5rem;
  padding: 0.3rem 0.8rem;
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  &:hover { background: ${(p) => (p.$on ? `rgba(${rgb.pink}, 0.26)` : `rgba(${rgb.gold}, 0.12)`)}; }
  &:disabled { opacity: 0.5; cursor: wait; }
  svg { ${(p) => (p.$on ? css`animation: ${recBlink} 1.2s ease-in-out infinite;` : "opacity: 0.7;")} }
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
  const [me, setMe] = useState<{ username: string; displayName: string } | null>(null);
  const [profiles, setProfiles] = useState<Array<{
    username: string;
    displayName: string;
    accentColor?: string;
  }>>([]);
  // Outbound recording is OPT-IN (operator decision 2026-07-02, supersedes
  // the Item 4 / B2 opt-out default): the per-call checkbox defaults OFF and
  // the operator can also start recording mid-call via the REC toggle.
  // The flag rides as `X-Record: true|false` into the FreeSWITCH dialplan
  // and recorded-at-any-point is mirrored into CDR consentAcknowledged.
  const [recordCall, setRecordCall] = useState(false);
  // Mid-call recording toggle. Each ON→OFF stretch is its own segment file
  // (uuid_record via /api/frontdesk/calls/record); segments + toggle events
  // ride into the CDR at hangup. Refs mirror state so the terminated-effect
  // closure reads current values.
  const [recActive, setRecActive] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const recActiveRef = useRef(false);
  const recRef = useRef<{
    segments: string[];
    events: Array<{ at: string; action: "start" | "stop" }>;
    activeFile: string | null;
    callId: string | null;
    /** Caller number of an inbound leg — needed to attach segments to its webhook-owned CDR. */
    inboundFrom: string | null;
    /** Set on the first manual toggle — the auto status-GET must not clobber it. */
    userTouched: boolean;
  }>({ segments: [], events: [], activeFile: null, callId: null, inboundFrom: null, userTouched: false });
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
      const [didsRes, callsRes, meRes, profilesRes] = await Promise.all([
        fetch("/api/frontdesk/dids"),
        fetch("/api/frontdesk/calls/history?limit=50"),
        fetch("/api/users/me"),
        fetch("/api/users/profile"),
      ]);
      if (didsRes.ok) setDids((await didsRes.json()).dids ?? []);
      if (callsRes.ok) setCalls((await callsRes.json()).calls ?? []);
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
    // Listen for shift/DID/profile changes from the lifted ShiftBar so the
    // calls log + outbound DID picker stay in sync without a full re-mount.
    const onChanged = () => void loadAll();
    window.addEventListener(FRONTDESK_DATA_CHANGED_EVENT, onChanged);
    return () => {
      clearInterval(id);
      window.removeEventListener(FRONTDESK_DATA_CHANGED_EVENT, onChanged);
    };
  }, [loadAll]);

  // Cross-tab dial intents. Tabs mount conditionally, so an intent fired
  // from Contacts/SMS lands before this listener exists — the dialBus
  // buffers it for the mount-time consume; the live event covers the
  // already-mounted case (and clears the buffer so it can't double-fire).
  const pendingAutoDialRef = useRef<string | null>(null);
  useEffect(() => {
    const applyIntent = (intent: { to?: string; autoDial?: boolean } | null | undefined) => {
      if (!intent?.to) return;
      const raw = stripPhoneFormatting(intent.to);
      setInput(raw);
      pendingAutoDialRef.current = intent.autoDial ? raw : null;
    };
    applyIntent(consumePendingDial());
    const handler = (e: Event) => {
      consumePendingDial();
      applyIntent((e as CustomEvent).detail as { to?: string; autoDial?: boolean } | undefined);
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
    recordCall: boolean;
  } | null>(null);
  const prevCallStateRef = useRef(softphone.callState);

  useEffect(() => {
    const prev = prevCallStateRef.current;
    const curr = softphone.callState;
    prevCallStateRef.current = curr;

    if (curr === "established" && activeCallRef.current && !activeCallRef.current.answeredAt) {
      activeCallRef.current.answeredAt = new Date().toISOString();
    }
    if (curr === "established" && prev !== "established") {
      // Fresh live call — ask FreeSWITCH whether the dialplan started a
      // recording (X-Record outbound / consent IVR inbound) and learn its
      // file path so the CDR can link it at hangup.
      recRef.current = {
        segments: [],
        events: [],
        activeFile: null,
        callId: getCurrentCallId(),
        inboundFrom: softphone.callDirection === "inbound" ? (softphone.incoming?.from ?? null) : null,
        userTouched: false,
      };
      recActiveRef.current = false;
      setRecActive(false);
      const cid = recRef.current.callId;
      if (cid) {
        fetch(`/api/frontdesk/calls/record?callId=${encodeURIComponent(cid)}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            // Drop the response if the call changed OR the user already
            // toggled manually — their POST result owns the state now.
            if (!j || recRef.current.callId !== cid || recRef.current.userTouched) return;
            if (j.active) {
              recRef.current.activeFile = j.recordingFile ?? null;
              recRef.current.events.push({ at: new Date().toISOString(), action: "start" });
              recActiveRef.current = true;
              setRecActive(true);
            }
          })
          .catch(() => { /* status stays off; toggle still works */ });
      }
    }
    if (curr === "terminated") {
      setPeerName(null);
      setShowInCallKeypad(false);
    }
    if (curr === "terminated" && prev !== "terminated" && !activeCallRef.current) {
      // Inbound leg — the Telnyx webhook owns this CDR and never learns
      // recording paths; attach what the browser observed at answer/toggle.
      const rec = recRef.current;
      if (recActiveRef.current && rec.activeFile) {
        rec.segments.push(rec.activeFile);
        rec.events.push({ at: new Date().toISOString(), action: "stop" });
      }
      recActiveRef.current = false;
      setRecActive(false);
      if (rec.segments.length > 0 && rec.inboundFrom) {
        fetch("/api/frontdesk/calls/record", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "attach", fromE164: rec.inboundFrom, paths: rec.segments }),
        }).then(() => loadAll()).catch(() => { /* best-effort */ });
      }
    }
    if (curr === "terminated" && prev !== "terminated" && activeCallRef.current) {
      const call = activeCallRef.current;
      activeCallRef.current = null;
      const outcome = call.answeredAt ? "answered" : "missed";
      // Fold the still-running segment (hangup ends it FS-side) into the list.
      const rec = recRef.current;
      if (recActiveRef.current && rec.activeFile) {
        rec.segments.push(rec.activeFile);
        rec.events.push({ at: new Date().toISOString(), action: "stop" });
      }
      recActiveRef.current = false;
      setRecActive(false);
      const recorded = rec.segments.length > 0;
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
          // Outbound consent = a recording was active at ANY point in the
          // call (pre-call checkbox or mid-call toggle). Inbound consent
          // comes from the dialplan IVR result (press 1) and is patched in
          // by the FreeSWITCH webhook path, not from here.
          consentAcknowledged: call.direction === "outbound" ? recorded : false,
          recordingPath: rec.segments[0] ?? null,
          recordingPaths: rec.segments,
          recordingEvents: rec.events,
        }),
      }).then(() => loadAll()).catch(() => { /* offline — skip */ });
    }
  }, [softphone.callState, softphone.callDirection, softphone.incoming, loadAll]);

  const toggleRecording = async () => {
    const cid = recRef.current.callId ?? getCurrentCallId();
    if (!cid || recBusy) return;
    recRef.current.userTouched = true;
    setRecBusy(true);
    setError(null);
    try {
      const action = recActiveRef.current ? "stop" : "start";
      const res = await fetch("/api/frontdesk/calls/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: cid, action }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? `Recording ${action} failed`);
      const at = new Date().toISOString();
      if (action === "start") {
        recRef.current.activeFile = typeof j.path === "string" && j.path ? j.path : null;
        recRef.current.events.push({ at, action: "start" });
        recActiveRef.current = true;
        setRecActive(true);
      } else {
        if (typeof j.path === "string" && j.path) recRef.current.segments.push(j.path);
        recRef.current.activeFile = null;
        recRef.current.events.push({ at, action: "stop" });
        recActiveRef.current = false;
        setRecActive(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRecBusy(false);
    }
  };

  // In-call view: contact name for "Live call with …" + optional DTMF keypad.
  const [peerName, setPeerName] = useState<string | null>(null);
  const [showInCallKeypad, setShowInCallKeypad] = useState(false);

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
        recordCall,
      };
      // Clear any previous call's recording bookkeeping — a call that never
      // establishes must not inherit stale segments into its CDR.
      recRef.current = { segments: [], events: [], activeFile: null, callId: null, inboundFrom: null, userTouched: false };
      recActiveRef.current = false;
      setRecActive(false);
      // Resolve a contact name for the in-call view (best-effort, non-blocking).
      setPeerName(null);
      const last10 = normalized.replace(/\D/g, "").slice(-10);
      fetch(`/api/frontdesk/contacts?search=${encodeURIComponent(last10)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          const hit = (j?.contacts ?? []).find(
            (c: { phone: string | null }) => (c.phone ?? "").replace(/\D/g, "").endsWith(last10),
          );
          if (hit?.name) setPeerName(hit.name);
        })
        .catch(() => { /* name stays null → show the number */ });
      await softphone.dial(normalized.replace(/^\+/, ""), selectedDid.e164, recordCall);
      setInput("");
    } catch (err) {
      activeCallRef.current = null;
      setError((err as Error).message);
    }
  };

  const hangup = () => softphone.hangup();

  // Fire a buffered auto-dial once the softphone is actually ready — on a
  // fresh tab mount the DID list and SIP registration arrive a beat after
  // the prefill, so dialing inline at consume time would fail.
  useEffect(() => {
    const want = pendingAutoDialRef.current;
    if (!want) return;
    if (onCall || softphone.status !== "registered" || !selectedDid) return;
    if (stripPhoneFormatting(input) !== want) return;
    pendingAutoDialRef.current = null;
    void dial();
  }, [input, softphone.status, selectedDid, onCall]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Wrap>
      <SectionHead>Outbound Line</SectionHead>
      {activeDids.length === 0 ? (
        <Empty>No DID assigned. Admin can provision one in the Admin modal.</Empty>
      ) : activeDids.length === 1 ? (
        <LineCard>
          <LineLabel>{activeDids[0].label}</LineLabel>
          <LineNum>{formatPhoneDisplay(activeDids[0].e164) || activeDids[0].e164}</LineNum>
        </LineCard>
      ) : (
        <NeonLineDDM
          value={selectedDid?.id ?? null}
          onChange={(id) => setFromDidId(id)}
          disabled={onCall}
          title="Outbound caller-ID"
          options={activeDids.map(d => ({
            id: d.id,
            label: d.label,
            sublabel: formatPhoneDisplay(d.e164) || d.e164,
          }))}
        />
      )}

      {!onCall ? (
      <>
      <Display
        value={formatPhoneInput(input)}
        onChange={(e) => setInput(nextRawFromDisplayEdit(input, e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (onCall) hangup();
            else dial();
          }
        }}
        placeholder="(555) 555-5555 or +1 (555) 555-5555"
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

      <label style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        fontSize: "0.6875rem", color: "var(--t-textFaint)",
        textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600,
        cursor: onCall ? "default" : "pointer", opacity: onCall ? 0.5 : 1,
      }}>
        <input
          type="checkbox"
          checked={recordCall}
          disabled={onCall}
          onChange={(e) => setRecordCall(e.target.checked)}
        />
        Record this call (off by default — can be switched on anytime during the call)
      </label>

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
      </>
      ) : (
        /* The keypad transforms: ringing view while establishing, live view once answered. */
        <CallScreen>
          <RingBadge $live={softphone.callState === "established"}>
            <PhoneIcon size={34} />
          </RingBadge>
          <CallStage>
            {softphone.callState === "established" ? "Live call with" : "Calling"}
          </CallStage>
          <CallWho>
            {peerName
              ?? (activeCallRef.current?.toE164 ? formatPhoneDisplay(activeCallRef.current.toE164) : "unknown")}
          </CallWho>
          {softphone.callState !== "established" ? (
            <CallHint>ringing…</CallHint>
          ) : (
            <>
              <RecBtn
                type="button"
                $on={recActive}
                disabled={recBusy}
                onClick={toggleRecording}
                title={recActive
                  ? "Recording — click to stop (this segment is kept)"
                  : "Not recording — click to record from this point"}
              >
                <RecordIcon size={12} />
                {recActive ? "Recording" : "Record"}
              </RecBtn>
              <KeypadToggle type="button" onClick={() => setShowInCallKeypad((v) => !v)}>
                {showInCallKeypad ? "Hide keypad" : "Keypad"}
              </KeypadToggle>
              {showInCallKeypad && (
                <KeypadGrid style={{ width: "100%", marginTop: "0.375rem" }}>
                  {KEYPAD.map((k) => (
                    <Key key={k.digit} onClick={() => pressKey(k.digit)} type="button">
                      <span className="digit">{k.digit}</span>
                      <span className="letters">{k.letters || " "}</span>
                    </Key>
                  ))}
                </KeypadGrid>
              )}
            </>
          )}
          <ActionRow style={{ width: "100%", marginTop: "0.625rem" }}>
            <CallBtn $variant="hangup" onClick={hangup} type="button">
              {softphone.callState === "establishing" ? "Cancel" : "Hang up"}
            </CallBtn>
          </ActionRow>
        </CallScreen>
      )}
      {error && <Empty style={{ color: colors.pink }}>{error}</Empty>}
      {softphone.lastError && <Empty style={{ color: colors.pink }}>SIP: {softphone.lastError}</Empty>}

      <CallsHeader>
        <SectionHead>Recent calls</SectionHead>
        {isExec && calls.length > 0 && (
          <ClearAllBtn
            type="button"
            onClick={async () => {
              if (!(await askConfirm({
                title: "Clear all recent calls?",
                message: "This cannot be undone.",
                confirmLabel: "Clear all",
              }))) return;
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
                const peer = stripPhoneFormatting(formatPeer(c)).replace(/^\+/, "");
                setInput(peer);
                setError(null);
              }}
            >
              <Arrow $dir={c.direction}>{c.direction === "inbound" ? "↙" : "↗"}</Arrow>
              <Peer>
                {formatPhoneDisplay(formatPeer(c)) || formatPeer(c)}
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

    </Wrap>
  );
}
