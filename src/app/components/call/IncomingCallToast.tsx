"use client";

import styled, { keyframes } from "styled-components";
import { rgb } from "../../theme";
import useIncomingCall, { type RingChannel } from "./useIncomingCall";

export type IncomingCallToastProps = {
  onJoinActive?: (channel: RingChannel) => void;
  onJoinObserver?: (channel: RingChannel) => void;
};

const pulseIn = keyframes`
  from { transform: translateY(-8px); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
`;

const ringGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(${rgb.pink}, 0.45); }
  50%      { box-shadow: 0 0 0 8px rgba(${rgb.pink}, 0); }
`;

const Host = styled.div`
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 120;
  pointer-events: none;
`;

const Card = styled.div`
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  min-width: 18rem;
  max-width: 22rem;
  padding: 0.75rem 0.875rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(${rgb.pink}, 0.45);
  background: linear-gradient(180deg, rgba(20,15,35,0.98), rgba(8,6,16,0.98));
  box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 0 20px rgba(${rgb.pink}, 0.25);
  color: var(--t-text);
  animation: ${pulseIn} 0.18s ease-out;

  [data-theme="light"] & {
    background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,243,240,0.98));
  }
`;

const HeadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const AvatarDot = styled.div<{ $src?: string | null }>`
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: ${p => p.$src ? `center / cover no-repeat url(${p.$src})` : `rgba(${rgb.pink}, 0.25)`};
  border: 1px solid rgba(${rgb.pink}, 0.5);
  animation: ${ringGlow} 1.2s ease-in-out infinite;
  flex-shrink: 0;
`;

const HeadText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
`;

const Caller = styled.div`
  font-size: 0.875rem;
  font-weight: 700;
  color: ${`#${"ff4ecb"}`};
  text-shadow: 0 0 8px rgba(${rgb.pink}, 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  [data-theme="light"] & { text-shadow: none; }
`;

const Context = styled.div`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const ActionBtn = styled.button<{ $variant: "reject" | "neutral" }>`
  flex: 1;
  padding: 0.4375rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, box-shadow 0.15s;

  ${p => p.$variant === "reject" ? `
    background: rgba(${rgb.red}, 0.14);
    border-color: rgba(${rgb.red}, 0.45);
    color: #f87171;
    &:hover { background: rgba(${rgb.red}, 0.28); box-shadow: 0 0 10px rgba(${rgb.red}, 0.4); }
  ` : `
    background: rgba(${rgb.green}, 0.14);
    border-color: rgba(${rgb.green}, 0.45);
    color: #4ade80;
    &:hover { background: rgba(${rgb.green}, 0.28); box-shadow: 0 0 10px rgba(${rgb.green}, 0.4); }
  `}
`;

function channelLabel(c: RingChannel): string {
  if (c.type === "dm") return `DM · ${c.name}`;
  if (c.type === "group") return `GROUP · ${c.name}`;
  return `SESSION · ${c.name}`;
}

export default function IncomingCallToast({ onJoinActive, onJoinObserver }: IncomingCallToastProps) {
  const { ring, reject, acceptSwitch, acceptNotify } = useIncomingCall({
    onJoinActive,
    onJoinObserver,
  });

  if (!ring) return null;

  return (
    <Host>
      <Card role="dialog" aria-live="assertive" aria-label={`Incoming call from ${ring.from.name}`}>
        <HeadRow>
          <AvatarDot $src={ring.from.avatar ?? null} />
          <HeadText>
            <Caller>{ring.from.name}</Caller>
            <Context>{channelLabel(ring.channel)}</Context>
          </HeadText>
        </HeadRow>
        <ActionRow>
          <ActionBtn $variant="reject" onClick={reject} title="Reject">Reject</ActionBtn>
          <ActionBtn $variant="neutral" onClick={acceptSwitch} title="Accept and switch">Switch</ActionBtn>
          <ActionBtn $variant="neutral" onClick={acceptNotify} title="Join in observer mode + post 'be right there'">Notify</ActionBtn>
        </ActionRow>
      </Card>
    </Host>
  );
}
