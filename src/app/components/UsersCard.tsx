"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styled from "styled-components";
import { colors, rgb } from "../theme";
import ProfileModal, { type Profile, type Memo, type Ping, hexToRgb } from "./ProfileModal";
import { UserAvatar } from "./ChatSettingsModal";
import type { UserPresence } from "./PresenceDots";
import { ArrowRightIcon } from "./icons";
import Tooltip from "./ui/Tooltip";

const TILE_MIN_WIDTH = 200;
const DEFAULT_PAGE_SIZE = 5;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
const PAGE_SIZE_STORAGE_KEY = "tgv_team_page_size";
const MEMO_PAGE_SIZE_STORAGE_KEY = "tgv_team_memo_page_size";
const MEMOS_EXPANDED_KEY = "tgv_team_memos_expanded";

/* ── Styled ────────────────────────────────────────────────── */

const Card = styled.div<{ $embedded?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-width: 0;
  overflow: hidden;
  background: ${(p) => (p.$embedded ? "transparent" : "var(--t-surface)")};
  border: ${(p) => (p.$embedded ? "none" : `1px solid rgba(${rgb.violet}, 0.25)`)};
  border-radius: ${(p) => (p.$embedded ? "0" : "16px")};
  padding: ${(p) => (p.$embedded ? "0" : "20px")};
  box-shadow: ${(p) => (p.$embedded ? "none" : `0 0 24px rgba(${rgb.violet}, 0.06)`)};

  [data-theme="light"] & {
    background: ${(p) => (p.$embedded ? "transparent" : "var(--t-surface)")};
    border-color: ${(p) => (p.$embedded ? "transparent" : `rgba(${rgb.violet}, 0.3)`)};
    box-shadow: ${(p) => (p.$embedded ? "none" : `0 0 16px rgba(${rgb.violet}, 0.04)`)};
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
  min-width: 0;
`;

const TpgRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 6px;

  @media (max-width: 599px) {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
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

  @media (max-width: 599px) {
    justify-content: center;
    flex-wrap: wrap;
  }
`;

const TpgDropWrap = styled.div`
  position: relative;
`;

const TpgDropTrigger = styled.button<{ $open?: boolean }>`
  appearance: none;
  background: rgba(${rgb.violet}, ${(p) => (p.$open ? 0.18 : 0.08)});
  border: 1px solid rgba(${rgb.violet}, ${(p) => (p.$open ? 0.75 : 0.5)});
  border-radius: 9999px;
  color: ${colors.violet};
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 4px 22px 4px 10px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  filter: drop-shadow(0 0 4px rgba(${rgb.violet}, 0.45));
  position: relative;

  &::after {
    content: "";
    position: absolute;
    right: 8px;
    top: 50%;
    width: 0;
    height: 0;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 5px solid ${colors.violet};
    transform: translateY(-50%) ${(p) => (p.$open ? "rotate(180deg)" : "rotate(0deg)")};
    transition: transform 0.15s;
  }

  &:hover {
    background-color: rgba(${rgb.violet}, 0.15);
  }

  [data-theme="light"] & {
    background-color: rgba(${rgb.violet}, 0.06);
  }
`;

const TpgDropMenu = styled.div`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  min-width: 96px;
  background: rgba(${rgb.violet}, 0.08);
  border: 1px solid rgba(${rgb.violet}, 0.5);
  border-radius: 12px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.55), 0 0 16px rgba(${rgb.violet}, 0.35);
  overflow: hidden;
  z-index: 20;
  backdrop-filter: blur(8px);

  [data-theme="light"] & {
    background: rgba(${rgb.violet}, 0.08);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.18), 0 0 12px rgba(${rgb.violet}, 0.25);
  }
`;

const TpgDropItem = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  border: none;
  cursor: pointer;
  background: ${(p) => (p.$active ? `rgba(${rgb.violet}, 0.24)` : "transparent")};
  color: ${(p) => (p.$active ? colors.violet : "var(--t-text)")};
  transition: background 0.12s, color 0.12s;
  text-shadow: ${(p) => (p.$active ? `0 0 6px rgba(${rgb.violet}, 0.6)` : "none")};

  &:hover {
    background: rgba(${rgb.violet}, 0.22);
    color: ${colors.violet};
    text-shadow: 0 0 6px rgba(${rgb.violet}, 0.55);
  }

  & + & {
    border-top: 1px solid rgba(${rgb.violet}, 0.18);
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
  min-width: 0;
  overflow: hidden;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const MemoLabel = styled.p`
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.violet};
  text-shadow: 0 0 6px rgba(${rgb.violet}, 0.5);
`;

const MemoSearch = styled.input`
  width: 100%;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(${rgb.violet}, 0.06);
  border: 1px solid rgba(${rgb.violet}, 0.25);
  color: var(--t-text);
  font-size: 11px;
  outline: none;

  &::placeholder { color: var(--t-textFaint); }
  &:focus {
    border-color: ${colors.violet};
    box-shadow: 0 0 0 2px rgba(${rgb.violet}, 0.18);
  }
`;

const MemoList = styled.div<{ $rows: number }>`
  display: flex;
  flex-direction: column;
  max-height: ${(p) => p.$rows * 34}px;
  overflow-y: auto;
  border-radius: 6px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(${rgb.violet}, 0.3); border-radius: 2px; }
`;

const MemoLine = styled.div<{ $accent: string }>`
  font-size: 10px;
  color: ${(p) => p.$accent};
  padding: 5px 8px;
  border-left: 2px solid ${(p) => p.$accent};
  background: color-mix(in srgb, ${(p) => p.$accent} 5%, transparent);
  margin-bottom: 8px;
  border-radius: 0 4px 4px 0;
  text-shadow: 0 0 4px color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  display: flex;
  align-items: center;
  gap: 6px;

  &:last-child { margin-bottom: 0; }
`;

const MemoText = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const MemoActions = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;

  ${MemoLine}:hover & { opacity: 1; }
`;

const MemoActionBtn = styled.button<{ $accent: string }>`
  width: 20px;
  height: 20px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  color: ${(p) => p.$accent};
  background: color-mix(in srgb, ${(p) => p.$accent} 14%, transparent);
  border: 1px solid color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: color-mix(in srgb, ${(p) => p.$accent} 26%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, ${(p) => p.$accent} 45%, transparent);
  }
`;

const MemoDeleteBtn = styled(MemoActionBtn)`
  &:hover {
    color: ${colors.red};
    background: rgba(${rgb.red}, 0.22);
    border-color: rgba(${rgb.red}, 0.55);
    box-shadow: 0 0 8px rgba(${rgb.red}, 0.45);
  }
`;

const MemoEditField = styled.input<{ $accent: string }>`
  flex: 1;
  min-width: 0;
  background: transparent;
  color: ${(p) => p.$accent};
  font-size: 10px;
  border: none;
  outline: none;
  padding: 0;
`;

const MemoHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const MemoEclRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const MemoEclLabel = styled.span`
  font-size: 0.5rem;
  color: var(--t-textGhost);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
`;

const MemoEclSwitch = styled.span<{ $on: boolean }>`
  position: relative;
  display: inline-block;
  width: 28px;
  height: 14px;
  border-radius: 999px;
  border: 1px solid ${(p) => (p.$on ? `rgba(${rgb.violet}, 0.7)` : "var(--t-borderStrong)")};
  background: ${(p) => (p.$on ? `rgba(${rgb.violet}, 0.2)` : "var(--t-inputBg)")};
  box-shadow: ${(p) => (p.$on ? `0 0 8px rgba(${rgb.violet}, 0.45)` : "none")};
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.18s;

  &::after {
    content: "";
    position: absolute;
    top: 1px;
    left: ${(p) => (p.$on ? "15px" : "1px")};
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${(p) => (p.$on ? colors.violet : "var(--t-textFaint)")};
    box-shadow: ${(p) =>
      p.$on
        ? `0 0 8px rgba(${rgb.violet}, 0.85), 0 0 2px rgba(${rgb.violet}, 1)`
        : "0 1px 2px rgba(0,0,0,0.3)"};
    transition: all 0.18s;
  }
`;

const MemoDate = styled.span`
  opacity: 0.7;
  margin-right: 4px;
  font-variant-numeric: tabular-nums;
`;

const MemoEmpty = styled.div`
  font-size: 10px;
  color: var(--t-textFaint);
  padding: 4px 0;
  font-style: italic;
`;

/* ── Component ─────────────────────────────────────────────── */

export default function UsersCard({
  className = "",
  embedded = false,
  onPageSizeChange,
}: {
  className?: string;
  embedded?: boolean;
  onPageSizeChange?: (size: number) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [presence, setPresence] = useState<UserPresence[]>([]);
  const [memos, setMemos] = useState<Memo[]>([]);
  const [memoQuery, setMemoQuery] = useState("");
  const [pings, setPings] = useState<Ping[]>([]);
  const [unreadPings, setUnreadPings] = useState(0);
  const [openProfile, setOpenProfile] = useState<Profile | null>(null);
  const [currentUser, setCurrentUser] = useState<string>("");
  const [cols, setCols] = useState(1);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [customMode, setCustomMode] = useState(false);
  const [memoPage, setMemoPage] = useState(0);
  const [memoPageSize, setMemoPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [memoCustomMode, setMemoCustomMode] = useState(false);
  const [memosExpanded, setMemosExpanded] = useState(true);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editMemoDraft, setEditMemoDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const [teamDropOpen, setTeamDropOpen] = useState(false);
  const [memoDropOpen, setMemoDropOpen] = useState(false);
  const teamDropRef = useRef<HTMLDivElement>(null);
  const memoDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!teamDropOpen && !memoDropOpen) return;
    const onDown = (e: MouseEvent) => {
      if (teamDropOpen && teamDropRef.current && !teamDropRef.current.contains(e.target as Node)) setTeamDropOpen(false);
      if (memoDropOpen && memoDropRef.current && !memoDropRef.current.contains(e.target as Node)) setMemoDropOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [teamDropOpen, memoDropOpen]);

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

  // Hydrate memo page size from localStorage (client-only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MEMO_PAGE_SIZE_STORAGE_KEY);
    const n = saved ? parseInt(saved, 10) : NaN;
    if (Number.isFinite(n) && n > 0) {
      setMemoPageSize(n);
      setMemoCustomMode(!PAGE_SIZE_OPTIONS.includes(n as (typeof PAGE_SIZE_OPTIONS)[number]));
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MEMO_PAGE_SIZE_STORAGE_KEY, String(memoPageSize));
  }, [memoPageSize]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(MEMOS_EXPANDED_KEY);
    if (saved !== null) setMemosExpanded(saved === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MEMOS_EXPANDED_KEY, memosExpanded ? "1" : "0");
  }, [memosExpanded]);

  const editMemo = async (id: string) => {
    const draft = editMemoDraft.trim();
    if (!draft) { setEditingMemoId(null); return; }
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content: draft }),
    });
    setEditingMemoId(null);
    load();
  };

  const archiveMemo = async (id: string) => {
    await fetch("/api/users/memo", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archive: true }),
    });
    load();
  };

  const deleteMemo = async (id: string) => {
    await fetch(`/api/users/memo?id=${id}`, { method: "DELETE" });
    load();
  };

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

  const filteredMemos = (memoQuery.trim()
    ? memos.filter((m) => {
        const q = memoQuery.toLowerCase();
        const creator = profiles.find((p) => p.username === m.from);
        return (
          m.content.toLowerCase().includes(q) ||
          m.from.toLowerCase().includes(q) ||
          (creator?.displayName.toLowerCase().includes(q) ?? false)
        );
      })
    : memos);

  const memoTotalPages = Math.max(1, Math.ceil(filteredMemos.length / memoPageSize));
  useEffect(() => {
    if (memoPage > memoTotalPages - 1) setMemoPage(Math.max(0, memoTotalPages - 1));
  }, [memoPage, memoTotalPages]);
  const pagedMemos = filteredMemos.slice(memoPage * memoPageSize, (memoPage + 1) * memoPageSize);
  const memoIsDefaultSize = memoPageSize === DEFAULT_PAGE_SIZE && !memoCustomMode;

  return (
    <Card className={className} $embedded={embedded}>
      {(!embedded || unreadPings > 0) && (
        <HeaderRow>
          {!embedded && <Title>Team</Title>}
          {unreadPings > 0 && (
            <PingBadge>
              {unreadPings} ping{unreadPings !== 1 ? "s" : ""}
            </PingBadge>
          )}
        </HeaderRow>
      )}

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
            <TpgDropWrap ref={teamDropRef}>
              <TpgDropTrigger
                type="button"
                $open={teamDropOpen}
                onClick={() => setTeamDropOpen((v) => !v)}
                aria-label="Page size"
                aria-expanded={teamDropOpen}
              >
                {pageSize} / page
              </TpgDropTrigger>
              {teamDropOpen && (
                <TpgDropMenu>
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <TpgDropItem
                      key={n}
                      type="button"
                      $active={pageSize === n && !customMode}
                      onClick={() => {
                        setPageSize(n);
                        setPage(0);
                        setCustomMode(false);
                        setTeamDropOpen(false);
                      }}
                    >
                      {n} / page
                    </TpgDropItem>
                  ))}
                  <TpgDropItem
                    type="button"
                    $active={customMode}
                    onClick={() => {
                      setCustomMode(true);
                      setTeamDropOpen(false);
                    }}
                  >
                    Custom…
                  </TpgDropItem>
                </TpgDropMenu>
              )}
            </TpgDropWrap>
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

      <MemoDivider>
        <MemoHeaderRow>
          <MemoLabel>Recent Memos</MemoLabel>
          <MemoEclRow
            role="button"
            tabIndex={0}
            aria-label={memosExpanded ? "Collapse Recent Memos" : "Expand Recent Memos"}
            onClick={() => setMemosExpanded((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setMemosExpanded((v) => !v); } }}
            style={{ cursor: "pointer" }}
          >
            <MemoEclLabel>{memosExpanded ? "Collapse" : "Expand"}</MemoEclLabel>
            <MemoEclSwitch $on={memosExpanded} aria-hidden="true" />
          </MemoEclRow>
        </MemoHeaderRow>
        {memosExpanded && (<>
        <MemoSearch
          placeholder="Search memos…"
          value={memoQuery}
          onChange={(e) => {
            setMemoQuery(e.target.value);
            setMemoPage(0);
          }}
        />
        {filteredMemos.length === 0 ? (
          <MemoEmpty>{memos.length === 0 ? "No memos yet" : "No memos match"}</MemoEmpty>
        ) : (
          <>
            <MemoList $rows={memoPageSize > 5 ? 5 : memoPageSize}>
              {pagedMemos.map((m) => {
                const creator = profiles.find((p) => p.username === m.from);
                const accent = creator?.accentColor ?? colors.violet;
                const isWriter = currentUser === m.from;
                const isReader = currentUser === m.to;
                const isEditing = editingMemoId === m.id;
                return (
                  <MemoLine key={m.id} $accent={accent} title={`From ${creator?.displayName ?? m.from}`}>
                    {isEditing ? (
                      <MemoEditField
                        $accent={accent}
                        autoFocus
                        value={editMemoDraft}
                        onChange={(e) => setEditMemoDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") { e.preventDefault(); editMemo(m.id); }
                          if (e.key === "Escape") setEditingMemoId(null);
                        }}
                        onBlur={() => editMemo(m.id)}
                      />
                    ) : (
                      <MemoText>
                        <MemoDate>{new Date(m.createdAt).toLocaleDateString()}</MemoDate>
                        {" · "}
                        {m.content}
                      </MemoText>
                    )}
                    <MemoActions>
                      {isWriter && !isEditing && (
                        <>
                          <Tooltip label="Edit" accent={accent}>
                            <MemoActionBtn
                              $accent={accent}
                              onClick={() => { setEditingMemoId(m.id); setEditMemoDraft(m.content); }}
                              aria-label="Edit memo"
                            >
                              ✎
                            </MemoActionBtn>
                          </Tooltip>
                          <Tooltip label="Archive" accent={accent}>
                            <MemoActionBtn
                              $accent={accent}
                              onClick={() => archiveMemo(m.id)}
                              aria-label="Archive memo"
                            >
                              ⬇
                            </MemoActionBtn>
                          </Tooltip>
                          <Tooltip label="Delete" accent={accent}>
                            <MemoDeleteBtn
                              $accent={accent}
                              onClick={() => deleteMemo(m.id)}
                              aria-label="Delete memo"
                            >
                              ✕
                            </MemoDeleteBtn>
                          </Tooltip>
                        </>
                      )}
                      {!isWriter && isReader && (
                        <Tooltip label="Archive" accent={accent}>
                          <MemoActionBtn
                            $accent={accent}
                            onClick={() => archiveMemo(m.id)}
                            aria-label="Archive memo"
                          >
                            ⬇
                          </MemoActionBtn>
                        </Tooltip>
                      )}
                    </MemoActions>
                  </MemoLine>
                );
              })}
            </MemoList>
            <TpgRow>
              <TpgInfo>
                Page {memoPage + 1} of {memoTotalPages} · {filteredMemos.length} memo{filteredMemos.length === 1 ? "" : "s"}
              </TpgInfo>
              <TpgControls>
                {!memoIsDefaultSize && (
                  <ResetBtn
                    type="button"
                    aria-label="Reset memo page size"
                    title="Reset to default"
                    onClick={() => {
                      setMemoPageSize(DEFAULT_PAGE_SIZE);
                      setMemoCustomMode(false);
                      setMemoPage(0);
                    }}
                  >
                    ↺
                  </ResetBtn>
                )}
                {memoCustomMode ? (
                  <TpgCustomInput
                    type="number"
                    min={1}
                    max={500}
                    value={memoPageSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (Number.isFinite(v) && v > 0) {
                        setMemoPageSize(v);
                        setMemoPage(0);
                      }
                    }}
                    onBlur={(e) => {
                      if (!e.target.value) {
                        setMemoPageSize(DEFAULT_PAGE_SIZE);
                        setMemoCustomMode(false);
                      }
                    }}
                  />
                ) : (
                  <TpgDropWrap ref={memoDropRef}>
                    <TpgDropTrigger
                      type="button"
                      $open={memoDropOpen}
                      onClick={() => setMemoDropOpen((v) => !v)}
                      aria-label="Memos per page"
                      aria-expanded={memoDropOpen}
                    >
                      {memoPageSize} / page
                    </TpgDropTrigger>
                    {memoDropOpen && (
                      <TpgDropMenu>
                        {PAGE_SIZE_OPTIONS.map((n) => (
                          <TpgDropItem
                            key={n}
                            type="button"
                            $active={memoPageSize === n && !memoCustomMode}
                            onClick={() => {
                              setMemoPageSize(n);
                              setMemoPage(0);
                              setMemoCustomMode(false);
                              setMemoDropOpen(false);
                            }}
                          >
                            {n} / page
                          </TpgDropItem>
                        ))}
                        <TpgDropItem
                          type="button"
                          $active={memoCustomMode}
                          onClick={() => {
                            setMemoCustomMode(true);
                            setMemoDropOpen(false);
                          }}
                        >
                          Custom…
                        </TpgDropItem>
                      </TpgDropMenu>
                    )}
                  </TpgDropWrap>
                )}
                <TpgBtn
                  disabled={memoPage === 0}
                  onClick={() => setMemoPage((p) => Math.max(0, p - 1))}
                  aria-label="Previous memo page"
                >
                  ‹
                </TpgBtn>
                <TpgBtn
                  disabled={memoPage >= memoTotalPages - 1}
                  onClick={() => setMemoPage((p) => Math.min(memoTotalPages - 1, p + 1))}
                  aria-label="Next memo page"
                >
                  ›
                </TpgBtn>
              </TpgControls>
            </TpgRow>
          </>
        )}
        </>)}
      </MemoDivider>

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
