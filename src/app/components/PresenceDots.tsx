"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";

export type UserPresence = {
  sysUser: string;
  displayName: string;
  online: boolean;
  sessions: number;
  lastSeen: string | null;
  via: "ssh" | "web" | "ssh+web" | null;
  onlineSinceMs: number | null;
};

const USER_COLOR: Record<string, string> = {
  admin: "#ff4ecb",
  marmar: "#00bfff",
};

/* ── Animations ────────────────────────────────────────────── */

const pulseGreen = keyframes`
  0%, 100% { box-shadow: 0 0 5px currentColor; }
  50%      { box-shadow: 0 0 2px currentColor; }
`;

/* ── Styled ────────────────────────────────────────────────── */

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const DotGroup = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: default;
  user-select: none;

  &:hover > [data-tooltip] {
    opacity: 1;
  }
`;

const Dot = styled.span<{ $color: string; $online: boolean }>`
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  flex-shrink: 0;
  background: ${({ $color }) => $color};
  box-shadow: ${({ $online, $color }) => ($online ? `0 0 5px ${$color}` : "none")};
  color: ${({ $color }) => $color};
  animation: ${({ $online }) => ($online ? pulseGreen : "none")} 2.5s ease-in-out infinite;
`;

const NameLabel = styled.span<{ $online: boolean }>`
  font-size: 12px;
  display: none;
  color: ${({ $online }) =>
    $online ? "var(--t-textMuted)" : "var(--t-textGhost)"};

  @media (min-width: 640px) {
    display: inline;
  }
`;

const Tooltip = styled.div<{ $dotColor: string }>`
  position: absolute;
  bottom: 100%;
  right: 0;
  margin-bottom: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 50;
  background: rgba(10, 10, 15, 0.96);
  border: 1px solid ${({ $dotColor }) => $dotColor}44;

  [data-theme="light"] & {
    background: rgba(255, 255, 255, 0.96);
    border-color: ${({ $dotColor }) => $dotColor}44;
  }
`;

const TooltipName = styled.span<{ $color: string }>`
  font-weight: 700;
  color: ${({ $color }) => $color};
`;

const TooltipLabel = styled.span`
  color: var(--t-textMuted);
  margin-left: 6px;
`;

/* ── Component ─────────────────────────────────────────────── */

export default function PresenceDots() {
  const [presence, setPresence] = useState<UserPresence[]>([]);

  const poll = async () => {
    try {
      const res = await fetch("/api/presence");
      if (res.ok) setPresence(await res.json());
    } catch {
      /* stale data stays */
    }
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  if (presence.length === 0) return null;

  return (
    <Wrapper>
      {presence.map((u) => (
        <PresenceDotItem key={u.sysUser} user={u} color={USER_COLOR[u.sysUser] ?? "#fff"} />
      ))}
    </Wrapper>
  );
}

function PresenceDotItem({ user, color }: { user: UserPresence; color: string }) {
  const dotColor = user.online ? color : "#4b5563";
  const label = user.online
    ? user.via === "ssh+web"
      ? `${user.sessions} ssh + browser`
      : user.via === "ssh"
      ? `${user.sessions} ssh session${user.sessions !== 1 ? "s" : ""}`
      : "browser"
    : user.lastSeen
    ? `Last seen ${user.lastSeen}`
    : "Offline";

  return (
    <DotGroup>
      <Dot $color={dotColor} $online={user.online} />
      <NameLabel $online={user.online}>{user.displayName}</NameLabel>

      <Tooltip data-tooltip $dotColor={dotColor}>
        <TooltipName $color={dotColor}>{user.displayName}</TooltipName>
        <TooltipLabel>{label}</TooltipLabel>
      </Tooltip>
    </DotGroup>
  );
}
