"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../../theme";
import type { CallRecord, Contact } from "@/lib/frontdesk/types";
import { PhoneIcon } from "../icons";
import { useSoftphone } from "@/lib/frontdesk/useSoftphone";

// ── Styled ───────────────────────────────────────────────────────

const ringPulse = keyframes`
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(${rgb.gold}, 0.55); }
  50%      { transform: scale(1.04); box-shadow: 0 0 0 24px rgba(${rgb.gold}, 0); }
`;

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
`;

const Panel = styled.div`
  width: 100%;
  max-width: 26rem;
  border: 1px solid rgba(${rgb.gold}, 0.55);
  border-radius: 1rem;
  padding: 2rem 1.5rem 1.5rem;
  background: linear-gradient(180deg, rgba(${rgb.gold}, 0.1), rgba(0, 0, 0, 0.7));
  box-shadow: 0 0 40px rgba(${rgb.gold}, 0.35);
  color: var(--t-textBase);
  text-align: center;
`;

const Label = styled.div`
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: ${colors.gold};
  opacity: 0.8;
  margin-bottom: 0.35rem;
`;

const NameLine = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: ${colors.gold};
  text-shadow: 0 0 10px rgba(${rgb.gold}, 0.6);
  margin-bottom: 0.25rem;
  [data-theme="light"] & { text-shadow: none; }
`;

const NumberLine = styled.div`
  font-family: var(--font-geist-mono), monospace;
  font-size: 1rem;
  color: var(--t-textGhost);
  letter-spacing: 0.04em;
  margin-bottom: 0.75rem;
`;

const MetaLine = styled.div`
  font-size: 0.75rem;
  color: var(--t-textFaint);
  margin-bottom: 1.75rem;
`;

const RingDot = styled.div`
  width: 5.5rem;
  height: 5.5rem;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  background: rgba(${rgb.gold}, 0.18);
  border: 2px solid rgba(${rgb.gold}, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${colors.gold};
  animation: ${ringPulse} 1.4s ease-in-out infinite;
  svg { width: 44px; height: 44px; }
`;

const CountdownBar = styled.div<{ $pct: number }>`
  height: 3px;
  width: 100%;
  background: rgba(${rgb.gold}, 0.15);
  border-radius: 2px;
  margin-bottom: 1rem;
  overflow: hidden;
  &::after {
    content: "";
    display: block;
    height: 100%;
    width: ${(p) => Math.max(0, Math.min(100, p.$pct))}%;
    background: ${colors.gold};
    transition: width 0.5s linear;
  }
`;

const ButtonRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 0.5rem;
`;

const ActionBtn = styled.button<{ $variant: "accept" | "decline" | "team" }>`
  padding: 0.75rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 0.625rem;
  cursor: pointer;
  border: 1px solid ${(p) =>
    p.$variant === "accept" ? `rgba(${rgb.green}, 0.6)` :
    p.$variant === "decline" ? `rgba(${rgb.pink}, 0.6)` :
    `rgba(${rgb.gold}, 0.55)`};
  background: ${(p) =>
    p.$variant === "accept" ? `rgba(${rgb.green}, 0.2)` :
    p.$variant === "decline" ? `rgba(${rgb.pink}, 0.2)` :
    `rgba(${rgb.gold}, 0.12)`};
  color: ${(p) =>
    p.$variant === "accept" ? colors.green :
    p.$variant === "decline" ? colors.pink :
    colors.gold};
  text-shadow: 0 0 6px ${(p) =>
    p.$variant === "accept" ? `rgba(${rgb.green}, 0.55)` :
    p.$variant === "decline" ? `rgba(${rgb.pink}, 0.55)` :
    `rgba(${rgb.gold}, 0.4)`};
  transition: filter 0.12s, box-shadow 0.12s;

  &:hover:not(:disabled) {
    filter: brightness(1.15);
    box-shadow: 0 0 10px ${(p) =>
      p.$variant === "accept" ? `rgba(${rgb.green}, 0.5)` :
      p.$variant === "decline" ? `rgba(${rgb.pink}, 0.5)` :
      `rgba(${rgb.gold}, 0.45)`};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  [data-theme="light"] & { text-shadow: none; }
`;

// ── Component ────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 2500;
const DIRECT_RING_WINDOW_SEC = 30;

type IncomingState = { call: CallRecord; contact: Contact | null } | null;

export default function IncomingCallOverlay() {
  const softphone = useSoftphone();
  const [apiState, setApiState] = useState<IncomingState>(null);
  const [busy, setBusy] = useState(false);
  const lastRingKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/frontdesk/calls/incoming");
      if (!res.ok) return;
      const j = await res.json();
      setApiState(j.call ? { call: j.call, contact: j.contact ?? null } : null);
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const sipRing = softphone.incoming && softphone.callState !== "established" && softphone.callState !== "terminated";
  const showSip = Boolean(sipRing);
  const showApi = !showSip && Boolean(apiState);
  const ringing = showSip || showApi;
  const ringKey = showSip ? `sip:${softphone.incoming!.from}` : showApi ? `api:${apiState!.call.id}` : null;

  useEffect(() => {
    if (ringing && ringKey !== lastRingKeyRef.current) {
      lastRingKeyRef.current = ringKey;
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/sounds/phone-ring.mp3");
          audioRef.current.loop = true;
          audioRef.current.volume = 0.6;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch { /* ignore */ }
    }
    if (!ringing && audioRef.current) {
      audioRef.current.pause();
      lastRingKeyRef.current = null;
    }
  }, [ringing, ringKey]);

  const actApi = useCallback(async (action: "accept" | "decline" | "passToTeam") => {
    if (!apiState || busy) return;
    setBusy(true);
    try {
      const endpoint = action === "accept"
        ? "/api/frontdesk/calls/answer"
        : "/api/frontdesk/calls/reject";
      const body = action === "accept"
        ? { callId: apiState.call.id }
        : { callId: apiState.call.id, action: action === "passToTeam" ? "passToTeam" : action };
      await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (action !== "passToTeam") setApiState(null);
      poll();
    } finally {
      setBusy(false);
    }
  }, [apiState, busy, poll]);

  if (showSip) {
    const peerLabel = softphone.incoming!.displayName;
    const peerNum = softphone.incoming!.from;
    return (
      <Backdrop>
        <Panel>
          <Label>Incoming call</Label>
          <RingDot><PhoneIcon size={44} /></RingDot>
          <NameLine>{peerLabel}</NameLine>
          <NumberLine>{peerNum}</NumberLine>
          <MetaLine>Ringing (SIP direct)</MetaLine>
          <CountdownBar $pct={100} />
          <ButtonRow>
            <ActionBtn $variant="decline" onClick={() => softphone.hangup()}>Decline</ActionBtn>
            <ActionBtn $variant="team" disabled>Team</ActionBtn>
            <ActionBtn $variant="accept" onClick={() => softphone.accept()}>Accept</ActionBtn>
          </ButtonRow>
        </Panel>
      </Backdrop>
    );
  }

  if (!showApi) return null;

  const { call, contact } = apiState!;
  const peerLabel = contact?.name ?? "Unknown caller";
  const startedAtMs = call.ringStartedAt ? new Date(call.ringStartedAt).getTime() : Date.now();
  const elapsedSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const countdownPct = call.ringTarget === "*"
    ? 100
    : Math.max(0, 100 - (elapsedSec / DIRECT_RING_WINDOW_SEC) * 100);
  const stageText = call.ringTarget === "*"
    ? "Ringing all available users"
    : `Ringing you (${Math.max(0, DIRECT_RING_WINDOW_SEC - elapsedSec)}s until team)`;

  return (
    <Backdrop>
      <Panel>
        <Label>Incoming call</Label>
        <RingDot><PhoneIcon size={44} /></RingDot>
        <NameLine>{peerLabel}</NameLine>
        <NumberLine>{call.fromE164}</NumberLine>
        <MetaLine>{stageText}</MetaLine>
        <CountdownBar $pct={countdownPct} />
        <ButtonRow>
          <ActionBtn $variant="decline" onClick={() => actApi("decline")} disabled={busy}>
            Decline
          </ActionBtn>
          <ActionBtn $variant="team" onClick={() => actApi("passToTeam")} disabled={busy || call.ringTarget === "*"}>
            Team
          </ActionBtn>
          <ActionBtn $variant="accept" onClick={() => actApi("accept")} disabled={busy}>
            Accept
          </ActionBtn>
        </ButtonRow>
      </Panel>
    </Backdrop>
  );
}
