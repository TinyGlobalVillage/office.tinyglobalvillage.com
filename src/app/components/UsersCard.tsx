"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import ProfileModal, { type Profile, type Memo, type Ping, hexToRgb } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import type { UserPresence } from "./PresenceDots";
import { ArrowRightIcon } from "./icons";

const TILE_MIN_WIDTH = 200;
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const PAGE_SIZE_STORAGE_KEY = "tgv_team_page_size";

/* ── Styled ────────────────────────────────────────────────── */

const Card = styled.div`
  background: var(--t-surface);
  border: 1px solid rgba(${rgb.violet}, 0.25);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
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

const UserList = styled.div<{ $cols: number }>`
  display: grid;
  grid-template-columns: repeat(${(p) => p.$cols}, minmax(0, 1fr));
  gap: 8px;
`;

const TpgRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 6px;
`;

const TpgInfo = styled.span`
  font-size: 11px;
  font-family: var(--font-geist-mono), monospace;
  font-variant-numeric: tabular-nums;
  color: ${colors.violet};
  text-shadow: 0 0 5px rgba(${rgb.violet}, 0.45);
`;

const TpgControls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TpgSelect = styled.select`
  appearance: none;
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  border-radius: 9999px;
  color: ${colors.violet};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 4px 24px 4px 10px;
  cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, ${colors.violet} 50%), linear-gradient(135deg, ${colors.violet} 50%, transparent 50%);
  background-position: calc(100% - 12px) 50%, calc(100% - 7px) 50%;
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  filter: drop-shadow(0 0 4px rgba(${rgb.violet}, 0.45));

  &:hover {
    background-color: rgba(${rgb.violet}, 0.15);
  }

  [data-theme="light"] & {
    background-color: rgba(${rgb.violet}, 0.06);
  }
`;

const TpgCustomInput = styled.input`
  width: 56px;
  padding: 4px 8px;
  border-radius: 9999px;
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  color: ${colors.violet};
  font-size: 11px;
  font-weight: 700;
  text-align: center;
  outline: none;
  font-variant-numeric: tabular-nums;

  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const ResetBtn = styled.button`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  background: rgba(${rgb.cyan}, 0.1);
  border: 1px solid rgba(${rgb.cyan}, 0.45);
  color: ${colors.cyan};
  filter: drop-shadow(0 0 3px rgba(${rgb.cyan}, 0.45));

  &:hover {
    background: rgba(${rgb.cyan}, 0.2);
  }
`;

const TpgBtn = styled.button`
  width: 28px;
  height: 28px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: ${colors.violet};
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  transition: all 0.15s;

  [data-theme="light"] & {
    background: rgba(${rgb.violet}, 0.06);
    border-color: rgba(${rgb.violet}, 0.45);
  }

  &:not(:disabled):hover {
    color: ${colors.violet};
    border-color: ${colors.violet};
    background: rgba(${rgb.violet}, 0.15);
    box-shadow: 0 0 10px rgba(${rgb.violet}, 0.7);
    text-shadow: 0 0 6px rgba(${rgb.violet}, 0.8);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
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

const DisplayName = styled.span<{ $accent: string }>`
  font-size: 14px;
  font-weight: 600;
  color: ${({ $accent }) => $accent};
  text-shadow: ${({ $accent }) => `0 0 6px rgba(${hexToRgb($accent)}, 0.45)`};
  line-height: 1.2;
`;

const SubText = styled.span<{ $accent: string }>`
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: ${({ $accent }) => `rgba(${hexToRgb($accent)}, 0.75)`};
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${colors.violet};
  flex-shrink: 0;
  filter: drop-shadow(0 0 4px rgba(${rgb.violet}, 0.55));
  transition: transform 0.15s, filter 0.15s;

  ${UserBtn}:hover & {
    filter: drop-shadow(0 0 10px rgba(${rgb.violet}, 0.85));
    transform: translateX(2px);
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
  color: ${colors.violet};
  text-shadow: 0 0 6px rgba(${rgb.violet}, 0.5);
  margin-bottom: 6px;
`;

const MemoLine = styled.div`
  font-size: 10px;
  color: ${colors.violet};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 0;
`;

const MemoDate = styled.span`
  color: ${colors.violet};
  opacity: 0.7;
  margin-right: 4px;
`;

/* ── Component ─────────────────────────────────────────────── */

export default function UsersCard({
  className = "",
  onPageSizeChange,
}: {
  className?: string;
  onPageSizeChange?: (size: number) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [pings, setPings] = useState<Ping[]>([]);
  const [unreadPings, setUnreadPings] = useState(0);
  const [openProfile, setOpenProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [cols, setCols] = useState(1);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [customMode, setCustomMode] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Hydrate page size from localStorage (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const n = saved ? parseInt(saved, 10) : NaN;
    if (Number.isFinite(n) && n > 0) {
      setPageSize(n);
      setCustomMode(!PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
    onPageSizeChange?.(pageSize);
  }, [pageSize, onPageSizeChange]);

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

  // Responsive column count: container width / TILE_MIN_WIDTH.
  // On narrow containers falls back to 1 col (mobile default).
  useEffect(() => {
    const el = listRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      const next = Math.max(1, Math.floor(w / TILE_MIN_WIDTH));
      setCols((prev) => (prev !== next ? next : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Page size is user-controlled (TPG). Columns stay responsive via ResizeObserver.
  const totalPages = Math.max(1, Math.ceil(profiles.length / pageSize));
  useEffect(() => {
    if (page > totalPages - 1) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);
  const pageProfiles = profiles.slice(page * pageSize, (page + 1) * pageSize);

  const isDefaultSize = pageSize === DEFAULT_PAGE_SIZE && !customMode;
  const totalResults = profiles.length;

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

      <UserList ref={listRef} $cols={cols}>
        {pageProfiles.map((p) => {
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
                <DisplayName $accent={accent}>{p.displayName}</DisplayName>
                <SubText $accent={accent}>
                  {p.title || p.email}
                  {pres?.lastSeen ? ` - last seen ${pres.lastSeen}` : ""}
                </SubText>
              </InfoCol>

              {myUnreadPings.length > 0 && (
                <UnreadBadge $accent={accent}>
                  {myUnreadPings.length}
                </UnreadBadge>
              )}

              <ArrowHint>
                <ArrowRightIcon size={28} />
              </ArrowHint>
            </UserBtn>
          );
        })}
      </UserList>

      <TpgRow>
        <TpgInfo>
          Page {page + 1} of {totalPages} · {totalResults} result{totalResults === 1 ? "" : "s"}
        </TpgInfo>
        <TpgControls>
          {!isDefaultSize && (
            <ResetBtn
              type="button"
              aria-label="Reset page size"
              title="Reset to default"
              onClick={() => {
                setPageSize(DEFAULT_PAGE_SIZE);
                setCustomMode(false);
                setPage(0);
              }}
            >
              ↺
            </ResetBtn>
          )}
          {customMode ? (
            <TpgCustomInput
              type="number"
              min={1}
              max={500}
              value={pageSize}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (Number.isFinite(v) && v > 0) {
                  setPageSize(v);
                  setPage(0);
                }
              }}
              onBlur={(e) => {
                if (!e.target.value) {
                  setPageSize(DEFAULT_PAGE_SIZE);
                  setCustomMode(false);
                }
              }}
              aria-label="Custom page size"
            />
          ) : (
            <TpgSelect
              value={pageSize}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "custom") {
                  setCustomMode(true);
                  return;
                }
                const n = parseInt(v, 10);
                if (Number.isFinite(n) && n > 0) {
                  setPageSize(n);
                  setPage(0);
                }
              }}
              aria-label="Page size"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
              <option value="custom">Custom…</option>
            </TpgSelect>
          )}
          <TpgBtn
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            aria-label="Previous page"
          >
            ‹
          </TpgBtn>
          <TpgBtn
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            aria-label="Next page"
          >
            ›
          </TpgBtn>
        </TpgControls>
      </TpgRow>

      {memos.length > 0 && (
        <MemoDivider>
          <MemoLabel>Recent Memos</MemoLabel>
          {memos.slice(0, 2).map((m) => (
            <MemoLine key={m.id}>
              <MemoDate>
                {new Date(m.createdAt).toLocaleDateString()}
              </MemoDate>
              {" · "}
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
