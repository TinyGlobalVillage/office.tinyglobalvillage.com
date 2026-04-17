"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import ProfileModal, { type Profile, type Memo, type Ping, hexToRgb } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import type { UserPresence } from "./PresenceDots";

/* ── Styled ────────────────────────────────────────────────── */

const Card = styled.div`
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.violet}, 0.25);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 0 24px rgba(${rgb.violet}, 0.06);

  [data-theme="light"] & {
    background: var(--t-surface);
    border-color: rgba(${rgb.violet}, 0.3);
    box-shadow: 0 0 16px rgba(${rgb.violet}, 0.04);
  }
`;

const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Title = styled.h3`
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: ${colors.violet};
`;

const PingBadge = styled.span`
  font-size: 9px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(${rgb.violet}, 0.18);
  border: 1px solid rgba(${rgb.violet}, 0.45);
  color: ${colors.violet};
`;

const UserList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const UserBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 12px;
  padding: 8px;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border: none;
  cursor: pointer;

  [data-theme="light"] & {
    background: rgba(0, 0, 0, 0.02);
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const StatusDot = styled.span<{ $online: boolean }>`
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  border: 2px solid var(--t-bg);
  background: ${({ $online }) => ($online ? "#4ade80" : "#374151")};
  box-shadow: ${({ $online }) => ($online ? "0 0 5px #4ade80" : "none")};
`;

const InfoCol = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const DisplayName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--t-text);
  line-height: 1.2;
`;

const SubText = styled.span`
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--t-textGhost);
`;

const UnreadBadge = styled.span<{ $accent: string }>`
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 9999px;
  background: ${({ $accent }) => `rgba(${hexToRgb($accent)}, 0.2)`};
  border: ${({ $accent }) => `1px solid ${$accent}66`};
  color: ${({ $accent }) => $accent};
`;

const ArrowHint = styled.span`
  font-size: 10px;
  color: var(--t-textGhost);
  flex-shrink: 0;
  transition: color 0.15s;

  ${UserBtn}:hover & {
    color: var(--t-textMuted);
  }
`;

const MemoDivider = styled.div`
  border-top: 1px solid var(--t-border);
  padding-top: 8px;
`;

const MemoLabel = styled.p`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--t-textGhost);
  margin-bottom: 6px;
`;

const MemoLine = styled.div`
  font-size: 10px;
  color: var(--t-textMuted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 0;
`;

const MemoDate = styled.span`
  color: var(--t-textGhost);
`;

/* ── Component ─────────────────────────────────────────────── */

export default function UsersCard({ className = "" }: { className?: string }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [unreadPings, setUnreadPings] = useState(0);
  const [openProfile, setOpenProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");

  const load = async () => {
    const [profRes, presRes, memoRes, pingRes, meRes] = await Promise.all([
      fetch("/api/users/profile").then((r) => r.json()).catch(() => ({ profiles: [] })),
      fetch("/api/presence").then((r) => r.json()).catch(() => []),
      fetch("/api/users/memo").then((r) => r.json()).catch(() => ({ memos: [] })),
      fetch("/api/users/ping").then((r) => r.json()).catch(() => ({ pings: [], unread: 0 })),
      fetch("/api/users/me").then((r) => r.json()).catch(() => null),
    ]);
    setProfiles(profRes.profiles ?? []);
    setPresence(Array.isArray(presRes) ? presRes : []);
    setMemos(memoRes.memos ?? []);
    setPings(pingRes.pings ?? []);
    setUnreadPings(pingRes.unread ?? 0);
    setCurrentUser(meRes?.username ?? "admin");
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (openProfile) {
      const updated = profiles.find((p) => p.username === openProfile.username);
      if (updated) setOpenProfile(updated);
    }
  }, [profiles]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className={className}>
      <HeaderRow>
        <Title>Team</Title>
        {unreadPings > 0 && (
          <PingBadge>
            {unreadPings} ping{unreadPings !== 1 ? "s" : ""}
          </PingBadge>
        )}
      </HeaderRow>

      <UserList>
        {profiles.map((p) => {
          const pres = presence.find((u) => u.sysUser === p.username);
          const online = pres?.online ?? false;
          const accent = p.accentColor;
          const myUnreadPings =
            p.username === currentUser ? pings.filter((pg) => !pg.read) : [];

          return (
            <UserBtn
              key={p.username}
              onClick={() => setOpenProfile(p)}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `rgba(${hexToRgb(accent)},0.08)`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "rgba(255,255,255,0.03)")
              }
            >
              <AvatarWrap>
                <UserAvatar profile={p} size={36} />
                <StatusDot $online={online} />
              </AvatarWrap>

              <InfoCol>
                <DisplayName>{p.displayName}</DisplayName>
                <SubText>{p.title || p.email}</SubText>
              </InfoCol>

              {myUnreadPings.length > 0 && (
                <UnreadBadge $accent={accent}>
                  {myUnreadPings.length}
                </UnreadBadge>
              )}

              <ArrowHint>&rarr;</ArrowHint>
            </UserBtn>
          );
        })}
      </UserList>

      {memos.length > 0 && (
        <MemoDivider>
          <MemoLabel>Recent Memos</MemoLabel>
          {memos.slice(0, 2).map((m) => (
            <MemoLine key={m.id}>
              <MemoDate>
                {new Date(m.createdAt).toLocaleDateString()}
              </MemoDate>
              {" \u00b7 "}
              {m.content}
            </MemoLine>
          ))}
        </MemoDivider>
      )}

      {openProfile &&
        createPortal(
          <ProfileModal
            profile={openProfile}
            profiles={profiles}
            memos={memos}
            pings={pings}
            currentUser={currentUser}
            onClose={() => setOpenProfile(null)}
            onRefresh={load}
          />,
          document.body
        )}
    </Card>
  );
}
