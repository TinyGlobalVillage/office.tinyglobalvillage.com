"use client";

import { useEffect, useState } from "react";
import styled, { keyframes } from "styled-components";
import { colors, rgb } from "../theme";
import type { UserPresence } from "./PresenceDots";

const USER_COLOR: Record<string, string> = {
  admin: "#ff4ecb",
  marmar: "#00bfff",
};

/* ── Animations ────────────────────────────────────────────── */

const pulseAnim = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
`;

const pulseGreen = keyframes`
  0%, 100% { box-shadow: 0 0 5px #4ade80; }
  50%      { box-shadow: 0 0 2px #4ade80; }
`;

/* ── Styled ────────────────────────────────────────────────── */

const Card = styled.div`
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.pink}, 0.25);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 0 24px rgba(${rgb.pink}, 0.08),
              0 0 60px rgba(${rgb.pink}, 0.04);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.pink}, 0.35);
    box-shadow: 0 0 16px rgba(${rgb.pink}, 0.06);
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.pink};
`;

const CountLabel = styled.span`
  font-size: 12px;
  color: var(--t-textGhost);
`;

const SkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const SkeletonBar = styled.div`
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  animation: ${pulseAnim} 2s ease-in-out infinite;

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.04);
  }
`;

const UsersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const Avatar = styled.div<{ $dotColor: string; $online: boolean; $color: string }>`
  width: 36px;
  height: 36px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
  background: linear-gradient(135deg, ${({ $dotColor }) => $dotColor}33, ${({ $dotColor }) => $dotColor}11);
  border: 1.5px solid ${({ $dotColor }) => $dotColor}66;
  color: ${({ $online, $color }) => ($online ? $color : "#4b5563")};
`;

const InfoCol = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const Name = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--t-text);
`;

const Detail = styled.span`
  font-size: 12px;
  color: var(--t-textGhost);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusWrap = styled.div`
  flex-shrink: 0;
`;

const OnlineLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
  color: #4ade80;
`;

const GreenDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: #4ade80;
  box-shadow: 0 0 5px #4ade80;
  animation: ${pulseGreen} 2s ease-in-out infinite;
`;

const OfflineLabel = styled.span`
  font-size: 12px;
  color: var(--t-textGhost);
`;

/* ── Component ─────────────────────────────────────────────── */

export default function PresenceCard({ className = "" }: { className?: string }) {
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(true);

  const poll = async () => {
    try {
      const res = await fetch("/api/presence");
      if (res.ok) setPresence(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, []);

  const onlineCount = presence.filter((u) => u.online).length;

  return (
    <Card className={className}>
      <Header>
        <Title>Who&apos;s Online</Title>
        {!loading && (
          <CountLabel>{onlineCount}/{presence.length} active</CountLabel>
        )}
      </Header>

      {loading ? (
        <SkeletonList>
          {[0, 1].map((i) => (
            <SkeletonBar key={i} />
          ))}
        </SkeletonList>
      ) : (
        <UsersList>
          {presence.map((u) => (
            <UserRow key={u.sysUser} user={u} color={USER_COLOR[u.sysUser] ?? "#fff"} />
          ))}
        </UsersList>
      )}
    </Card>
  );
}

function UserRow({ user, color }: { user: UserPresence; color: string }) {
  const dotColor = user.online ? color : "#374151";
  return (
    <Row>
      <Avatar $dotColor={dotColor} $online={user.online} $color={color}>
        {user.displayName[0]}
      </Avatar>
      <InfoCol>
        <Name>{user.displayName}</Name>
        <Detail>
          {user.online
            ? user.via === "ssh+web"
              ? `${user.sessions} ssh session${user.sessions !== 1 ? "s" : ""} + browser`
              : user.via === "ssh"
              ? `${user.sessions} ssh session${user.sessions !== 1 ? "s" : ""}`
              : "browser"
            : user.lastSeen
            ? `Last seen ${user.lastSeen}`
            : "Offline"}
        </Detail>
      </InfoCol>
      <StatusWrap>
        {user.online ? (
          <OnlineLabel>
            <GreenDot />
            Online
          </OnlineLabel>
        ) : (
          <OfflineLabel>Offline</OfflineLabel>
        )}
      </StatusWrap>
    </Row>
  );
}
