"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import styled, { css } from "styled-components";
import { colors, rgb } from "../theme";
import {
  DrawerBackdrop,
  DrawerPanel,
  DrawerHeader,
  DrawerTab,
  DrawerTabLabel,
  DrawerResizeHandle,
  DrawerTitle,
  PanelIconBtn,
} from "../styled";

import { DrawerSessionsIcon, SearchIcon, EditIcon } from "./icons";
import NeonX from "./NeonX";
import { useKnobVisibility } from "../lib/drawerKnobs";
import { CallSurface, CallButton } from "./call";
import type { RingChannel } from "./call";
import SessionSettingsModal from "./SessionSettingsModal";

// ── Types ────────────────────────────────────────────────────────────────────

type SessionKind = "lounge" | "study" | "pair" | "user";

type Session = {
  id: string;
  kind: SessionKind;
  name: string;
  createdBy: string | null;
  createdAt: string;
  cap: number | null;
  memberIds: string[];
  admins: string[];
  banned: string[];
  invisible: string[];
  updatedAt: string;
};

type Selection = { type: "none" } | { type: "room"; sessionId: string };

type MobileView = "list" | "room";

// ── Constants ────────────────────────────────────────────────────────────────

const PINK     = colors.pink;
const PINK_RGB = rgb.pink;
const DEFAULT_W       = 760;
const MIN_W           = 480;
const MAX_W           = 1200;
const DRAWER_EVENT    = "tgv-right-drawer";
const DRAWER_ID       = "sessions";
const MOBILE_BREAK    = 768;
const POLL_MS         = 8000;

function getDefaultTabY() {
  if (typeof window === "undefined") return 720;
  return Math.round(window.innerHeight * 0.8);
}

// Category order + display metadata
const CATEGORY_META: Record<SessionKind, { label: string; accent: string; order: number }> = {
  lounge: { label: "Lounge",          accent: `${PINK}`,          order: 0 },
  study:  { label: "Study",           accent: colors.cyan,        order: 1 },
  pair:   { label: "Pair programming", accent: colors.green,      order: 2 },
  user:   { label: "Custom",           accent: colors.violet,     order: 3 },
};

// ── Styled ───────────────────────────────────────────────────────────────────

const SideTab = styled(DrawerTab).attrs({ $side: "left", $accent: "pink" })<{ $openOffset?: number }>`
  left: ${(p) => p.$openOffset ?? 0}px;
  z-index: 63;
  border-left: none;
  transition: left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.2s;
`;

const Backdrop = styled(DrawerBackdrop)`
  z-index: 59;
  backdrop-filter: blur(1px);
`;

const Panel = styled(DrawerPanel)`
  left: 0;
  z-index: 64;
  max-width: 85vw;
  border-right: 1px solid rgba(${PINK_RGB}, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  [data-theme="light"] & { border-right-color: rgba(${PINK_RGB}, 0.1); }

  @media (max-width: ${MOBILE_BREAK}px) {
    width: 100vw !important;
    max-width: 100vw;
  }
`;

const Header = styled(DrawerHeader)`
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.12);
`;

const TitleText = styled(DrawerTitle).attrs({ $accent: "pink" })`
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ControlBtn = styled(PanelIconBtn)`
  width: 2.125rem;
  height: 2.125rem;
  border-radius: 0.5rem;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1;
  background: rgba(${PINK_RGB}, 0.14);
  border: 1px solid rgba(${PINK_RGB}, 0.45);
  color: ${PINK};
  text-shadow: 0 0 6px rgba(${PINK_RGB}, 0.7);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;

  &:hover:not(:disabled) {
    background: rgba(${PINK_RGB}, 0.28);
    box-shadow: 0 0 10px rgba(${PINK_RGB}, 0.5);
  }

  &:active:not(:disabled) { transform: translateY(1px); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }

  @media (max-width: ${MOBILE_BREAK}px) {
    width: 2.75rem; height: 2.75rem; font-size: 1.1875rem; border-radius: 0.625rem;
  }
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "pink" })``;

const Body = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: row;
  min-height: 0;

  @media (max-width: ${MOBILE_BREAK}px) {
    flex-direction: column;
  }
`;

const SidebarCol = styled.aside<{ $mobileHidden?: boolean }>`
  width: 16rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(${PINK_RGB}, 0.12);
  min-height: 0;

  @media (max-width: ${MOBILE_BREAK}px) {
    width: 100%;
    border-right: none;
    border-bottom: 1px solid rgba(${PINK_RGB}, 0.12);
    display: ${p => p.$mobileHidden ? "none" : "flex"};
    flex: 1;
  }
`;

const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.08);
`;

const SearchWrap = styled.label`
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  border-radius: 8px;
  border: 1px solid rgba(217, 119, 87, 0.3);
  background: rgba(217, 119, 87, 0.05);
  color: ${colors.orange};

  & > svg { flex-shrink: 0; opacity: 0.85; }
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--t-text);
  font-size: 0.8125rem;

  &::placeholder { color: rgba(217, 119, 87, 0.6); }
`;

const SidebarList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.375rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CategoryHead = styled.div<{ $accent: string }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.375rem 0.5rem 0.25rem;
  font-size: 0.625rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${p => p.$accent};
  opacity: 0.75;

  span.count {
    font-weight: 600;
    opacity: 0.7;
  }
`;

const RowWrap = styled.div<{ $active?: boolean; $accent: string }>`
  position: relative;
  border-radius: 0.5rem;
  ${p => p.$active && css`
    outline: 1px solid ${p.$accent};
    outline-offset: -1px;
    box-shadow: 0 0 0 2px rgba(${PINK_RGB}, 0.12);
  `}
`;

const SessionRow = styled.button<{ $active?: boolean; $accent: string }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.5625rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => p.$active ? p.$accent : "rgba(255,255,255,0.06)"};
  background: ${p => p.$active
    ? `rgba(${PINK_RGB}, 0.12)`
    : "transparent"};
  color: var(--t-text);
  cursor: pointer;
  text-align: left;
  font-size: 0.8125rem;
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    background: rgba(${PINK_RGB}, 0.08);
    border-color: rgba(${PINK_RGB}, 0.3);
  }

  [data-theme="light"] & {
    border-color: ${p => p.$active ? p.$accent : "rgba(0,0,0,0.06)"};
  }
`;

const RowIconSlot = styled.span<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 0.375rem;
  background: rgba(${PINK_RGB}, 0.1);
  color: ${p => p.$accent};
  flex-shrink: 0;

  svg { width: 12px; height: 12px; }
`;

const RowBody = styled.span`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  min-width: 0;
`;

const RowName = styled.span`
  font-weight: 600;
  color: var(--t-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RowSub = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
`;

const OccupancyPill = styled.span<{ $accent: string; $full?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.125rem 0.375rem;
  border-radius: 999px;
  background: rgba(${PINK_RGB}, 0.1);
  color: ${p => p.$full ? colors.red : p.$accent};
  border: 1px solid ${p => p.$full ? `rgba(${rgb.red}, 0.4)` : "rgba(255,255,255,0.08)"};
  white-space: nowrap;
`;

const DaBTile = styled.div<{ $editing: boolean }>`
  margin-top: 0.25rem;
  padding: ${p => p.$editing ? "0.625rem" : "0.5rem"};
  border-radius: 0.5rem;
  border: 1.5px dashed rgba(${PINK_RGB}, 0.55);
  background: rgba(${PINK_RGB}, 0.06);
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  cursor: ${p => p.$editing ? "default" : "pointer"};
  transition: background 0.15s, border-color 0.15s;

  &:hover {
    border-color: rgba(${PINK_RGB}, 0.85);
    background: rgba(${PINK_RGB}, 0.12);
  }
`;

const DaBLabel = styled.span`
  display: block;
  text-align: center;
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${PINK};
  opacity: 0.7;
`;

const DaBInput = styled.input`
  width: 100%;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  border: 1px solid rgba(${PINK_RGB}, 0.4);
  background: rgba(${PINK_RGB}, 0.05);
  color: var(--t-text);
  font-size: 0.8125rem;
  outline: none;

  &:focus { border-color: rgba(${PINK_RGB}, 0.75); }
`;

const DaBBtnRow = styled.div`
  display: flex;
  gap: 0.375rem;
  justify-content: flex-end;
`;

const DaBBtn = styled.button<{ $primary?: boolean }>`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.3125rem 0.625rem;
  border-radius: 0.375rem;
  cursor: pointer;
  border: 1px solid ${p => p.$primary ? `rgba(${PINK_RGB}, 0.5)` : "rgba(255,255,255,0.12)"};
  background: ${p => p.$primary ? `rgba(${PINK_RGB}, 0.15)` : "transparent"};
  color: ${p => p.$primary ? PINK : "var(--t-textMuted)"};

  &:hover:not(:disabled) {
    background: ${p => p.$primary ? `rgba(${PINK_RGB}, 0.25)` : "rgba(255,255,255,0.06)"};
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const RoomCol = styled.section<{ $mobileHidden?: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;

  @media (max-width: ${MOBILE_BREAK}px) {
    display: ${p => p.$mobileHidden ? "none" : "flex"};
  }
`;

const RoomHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.12);
`;

const RoomTitle = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
`;

const RoomName = styled.span`
  font-size: 0.9375rem;
  font-weight: 700;
  color: ${PINK};
  text-shadow: 0 0 8px rgba(${PINK_RGB}, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  [data-theme="light"] & { text-shadow: none; }
`;

const RoomSub = styled.span`
  font-size: 0.6875rem;
  color: var(--t-textMuted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const RoomActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const MobileBackBtn = styled.button`
  display: none;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  background: rgba(${PINK_RGB}, 0.08);
  color: ${PINK};
  cursor: pointer;

  @media (max-width: ${MOBILE_BREAK}px) { display: inline-flex; }
`;

const RoomBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;

  --lk-bg: var(--t-bg);
  --lk-fg: var(--t-text);
`;

const EmptyRoomPad = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 2rem;
  text-align: center;
  color: var(--t-textMuted);

  svg { opacity: 0.6; }
`;

const EmptyLine = styled.p`
  font-size: 0.875rem;
  margin: 0;
  max-width: 20rem;
`;

const ErrorPad = styled.div`
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: #f87171;
  text-align: center;
  border-top: 1px solid rgba(${rgb.red}, 0.2);
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function SessionsDrawer() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [tabY, setTabY] = useState<number>(720);
  const [otherDrawerOpen, setOtherDrawerOpen] = useState(false);
  const { hideKnob } = useKnobVisibility();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({ type: "none" });
  const [mobileView, setMobileView] = useState<MobileView>("list");
  const [observerMode, setObserverMode] = useState(false);
  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [search, setSearch] = useState("");
  const [daBMode, setDaBMode] = useState<"rest" | "editing">("rest");
  const [daBName, setDaBName] = useState("");
  const [settingsFor, setSettingsFor] = useState<string | null>(null);

  useEffect(() => { setTabY(getDefaultTabY()); }, []);

  // ── Sessions fetch ────────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { cache: "no-store" });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { sessions: Session[] };
      setSessions(data.sessions ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load sessions");
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    loadSessions();
    const id = window.setInterval(loadSessions, POLL_MS);
    return () => window.clearInterval(id);
  }, [open, loadSessions]);

  // ── Drawer mutex + open/close ─────────────────────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === DRAWER_ID) { setOtherDrawerOpen(false); return; }
      if (detail === "close")   { setOtherDrawerOpen(false); return; }
      if (open) setOpen(false);
      setOtherDrawerOpen(true);
    };
    window.addEventListener(DRAWER_EVENT, handler);
    return () => window.removeEventListener(DRAWER_EVENT, handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === DRAWER_ID) {
        setOpen(true);
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
      }
    };
    window.addEventListener("tgv-drawer-open", handler);
    return () => window.removeEventListener("tgv-drawer-open", handler);
  }, []);

  // ── Accept-ring handoff from IncomingCallToast ────────────────────────────

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { channel: RingChannel; mode: "active" | "observer" }
        | undefined;
      if (!detail) return;
      if (detail.channel.type !== "session") return;
      setSelection({ type: "room", sessionId: detail.channel.id });
      setObserverMode(detail.mode === "observer");
      setMobileView("room");
    };
    window.addEventListener("tgv-call-accept", handler);
    return () => window.removeEventListener("tgv-call-accept", handler);
  }, []);

  // ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleClose = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" }));
  };

  // ── Presence heartbeat ────────────────────────────────────────────────────
  //
  // Each tab gets its own `deviceId` (mounted once, kept in a ref). The server
  // stores one presence row per (user, device) so two tabs from the same user
  // occupy two seats. If a tab is closed without firing `present: false`, the
  // TTL sweep in lib/sessions.ts drops the row within ~30s.

  const activeId = selection.type === "room" ? selection.sessionId : null;
  const presenceId = useRef<string | null>(null);
  const deviceId = useRef<string>("");
  if (!deviceId.current) {
    deviceId.current =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  useEffect(() => {
    const device = deviceId.current;
    if (!activeId) {
      // Leaving: tell server this device is gone. Use sendBeacon when available
      // so the request survives tab close / navigation.
      const last = presenceId.current;
      presenceId.current = null;
      if (last) {
        const url = `/api/sessions/${encodeURIComponent(last)}/presence`;
        const payload = JSON.stringify({ present: false, deviceId: device });
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
          try {
            navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
          } catch {
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
          }
        } else {
          fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }).catch(() => {});
        }
      }
      return;
    }
    presenceId.current = activeId;
    const beat = () => {
      fetch(`/api/sessions/${encodeURIComponent(activeId)}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ present: true, deviceId: device }),
      }).catch(() => {});
    };
    beat();
    const hb = window.setInterval(beat, 15_000);

    // On tab close / refresh, best-effort tell the server we're leaving so
    // other devices see the seat free immediately instead of waiting on TTL.
    const leaveOnUnload = () => {
      const url = `/api/sessions/${encodeURIComponent(activeId)}/presence`;
      const payload = JSON.stringify({ present: false, deviceId: device });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        try { navigator.sendBeacon(url, new Blob([payload], { type: "application/json" })); }
        catch { /* ignore */ }
      }
    };
    window.addEventListener("pagehide", leaveOnUnload);
    window.addEventListener("beforeunload", leaveOnUnload);

    return () => {
      window.clearInterval(hb);
      window.removeEventListener("pagehide", leaveOnUnload);
      window.removeEventListener("beforeunload", leaveOnUnload);
    };
  }, [activeId]);

  // ── Resize drag ───────────────────────────────────────────────────────────

  const resizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    resizing.current = true;
    startX.current = e.clientX;
    startW.current = width;
    const onMove = (ev: MouseEvent) => {
      if (!resizing.current) return;
      const delta = startX.current - ev.clientX;
      setWidth(Math.min(MAX_W, Math.max(MIN_W, startW.current + delta)));
    };
    const onUp = () => {
      resizing.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width]);

  // Tab drag / toggle
  const tabDragging = useRef(false);
  const didDrag = useRef(false);
  const tabStartY = useRef(0);
  const tabStartPos = useRef(0);

  const onTabMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    tabDragging.current = true;
    didDrag.current = false;
    tabStartY.current = e.clientY;
    tabStartPos.current = tabY;
    const onMove = (ev: MouseEvent) => {
      if (!tabDragging.current) return;
      const delta = ev.clientY - tabStartY.current;
      if (Math.abs(delta) > 4) didDrag.current = true;
      if (didDrag.current) {
        const newY = Math.max(80, Math.min(window.innerHeight - 120, tabStartPos.current + delta));
        setTabY(newY);
      }
    };
    const onUp = () => {
      tabDragging.current = false;
      if (!didDrag.current) {
        setOpen(p => {
          const next = !p;
          window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: next ? DRAWER_ID : "close" }));
          return next;
        });
      }
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [tabY]);

  // ── List grouping ─────────────────────────────────────────────────────────

  const grouped = useMemo(() => {
    const filtered = search.trim()
      ? sessions.filter(s => s.name.toLowerCase().includes(search.trim().toLowerCase()))
      : sessions;
    const buckets: Record<SessionKind, Session[]> = {
      lounge: [], study: [], pair: [], user: [],
    };
    for (const s of filtered) buckets[s.kind].push(s);
    // Stable sort per bucket
    buckets.lounge.sort((a, b) => a.name.localeCompare(b.name));
    buckets.study.sort((a, b) => a.name.localeCompare(b.name));
    buckets.pair.sort((a, b) => a.name.localeCompare(b.name));
    buckets.user.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return buckets;
  }, [sessions, search]);

  const activeSession = useMemo(() => {
    if (!activeId) return null;
    return sessions.find(s => s.id === activeId) ?? null;
  }, [activeId, sessions]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleSelect = (s: Session) => {
    setSelection({ type: "room", sessionId: s.id });
    setObserverMode(false);
    setMicOff(false);
    setCamOff(false);
    setMobileView("room");
  };

  const handleLeaveRoom = useCallback(() => {
    setSelection({ type: "none" });
    setObserverMode(false);
    setMobileView("list");
  }, []);

  const handleCreateSession = async () => {
    const name = daBName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { session: Session };
      setSessions(prev => [...prev, data.session]);
      setDaBMode("rest");
      setDaBName("");
      setSelection({ type: "room", sessionId: data.session.id });
      setMobileView("room");
    } catch { /* swallow; list will refetch */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const liveKitRoom = activeId ? `session:${activeId}` : null;
  const connected = activeId != null;

  const renderCategory = (kind: SessionKind) => {
    const rows = grouped[kind];
    if (rows.length === 0) return null;
    const meta = CATEGORY_META[kind];
    return (
      <div key={kind}>
        <CategoryHead $accent={meta.accent}>
          <span>{meta.label}</span>
          <span className="count">{rows.length}</span>
        </CategoryHead>
        {rows.map(s => {
          const isActive = selection.type === "room" && selection.sessionId === s.id;
          const visibleMembers = s.memberIds.length;
          const capText = s.cap != null ? `${visibleMembers}/${s.cap}` : `${visibleMembers}`;
          const full = s.cap != null && visibleMembers >= s.cap;
          return (
            <RowWrap key={s.id} $active={isActive} $accent={meta.accent}>
              <SessionRow
                $active={isActive}
                $accent={meta.accent}
                onClick={() => handleSelect(s)}
                title={`${s.name} — ${capText} occupant${visibleMembers === 1 ? "" : "s"}`}
              >
                <RowIconSlot $accent={meta.accent}>
                  <DrawerSessionsIcon size={12} />
                </RowIconSlot>
                <RowBody>
                  <RowName>{s.name}</RowName>
                  <RowSub>{meta.label}</RowSub>
                </RowBody>
                <OccupancyPill $accent={meta.accent} $full={full}>{capText}</OccupancyPill>
              </SessionRow>
            </RowWrap>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {!otherDrawerOpen && !hideKnob && (
        <SideTab
          onMouseDown={onTabMouseDown}
          title={open ? "Close sessions" : "Open sessions"}
          $openOffset={open ? width : 0}
          style={{
            top: tabY,
            backgroundColor: open
              ? `rgba(${PINK_RGB}, 0.25)`
              : `rgba(${PINK_RGB}, 0.12)`,
          }}
        >
          <DrawerSessionsIcon size={16} />
          <DrawerTabLabel>Sessions</DrawerTabLabel>
        </SideTab>
      )}

      {open && <Backdrop onClick={handleClose} />}

      {open && (
        <Panel style={{ width }}>
          <Resize onMouseDown={onResizeStart} />

          <Header>
            <TitleText>
              {connected && activeSession ? `🟢 ${activeSession.name}` : "Sessions"}
            </TitleText>
            <ControlBtn
              onClick={() => {
                const w = window.screen.width * 0.8;
                const h = window.screen.height * 0.85;
                const left = (window.screen.width - w) / 2;
                const top  = (window.screen.height - h) / 2;
                window.open("/dashboard/sessions?popout=1", "tgv-sessions-drawer",
                  `width=${w},height=${h},left=${left},top=${top}`);
              }}
              title="Open in new window"
            >⧉</ControlBtn>
            <NeonX accent="pink" onClick={handleClose} title="Close (Esc)" />
          </Header>

          <Body>
            <SidebarCol $mobileHidden={mobileView === "room" && connected}>
              <SidebarHeader>
                <SearchWrap>
                  <SearchIcon size={12} />
                  <SearchInput
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search sessions"
                  />
                </SearchWrap>
              </SidebarHeader>

              <SidebarList>
                {renderCategory("lounge")}
                {renderCategory("study")}
                {renderCategory("pair")}
                {renderCategory("user")}

                <DaBTile
                  $editing={daBMode === "editing"}
                  onClick={() => { if (daBMode === "rest") setDaBMode("editing"); }}
                >
                  {daBMode === "rest" ? (
                    <DaBLabel>+ Add new session</DaBLabel>
                  ) : (
                    <>
                      <DaBInput
                        autoFocus
                        value={daBName}
                        onChange={e => setDaBName(e.target.value)}
                        placeholder="Session name"
                        onKeyDown={e => {
                          if (e.key === "Enter") handleCreateSession();
                          if (e.key === "Escape") { setDaBMode("rest"); setDaBName(""); }
                        }}
                      />
                      <DaBBtnRow>
                        <DaBBtn onClick={() => { setDaBMode("rest"); setDaBName(""); }}>
                          Cancel
                        </DaBBtn>
                        <DaBBtn
                          $primary
                          onClick={handleCreateSession}
                          disabled={!daBName.trim()}
                        >Create</DaBBtn>
                      </DaBBtnRow>
                    </>
                  )}
                </DaBTile>
              </SidebarList>

              {loadError && <ErrorPad>✕ {loadError}</ErrorPad>}
            </SidebarCol>

            <RoomCol $mobileHidden={mobileView === "list"}>
              {activeSession && liveKitRoom ? (
                <>
                  <RoomHeader>
                    <MobileBackBtn
                      onClick={() => setMobileView("list")}
                      title="Back to sessions list"
                    >‹</MobileBackBtn>
                    <RoomTitle>
                      <RoomName>{activeSession.name}</RoomName>
                      <RoomSub>
                        {CATEGORY_META[activeSession.kind].label} ·{" "}
                        {activeSession.memberIds.length}
                        {activeSession.cap != null ? `/${activeSession.cap}` : ""} occupants
                      </RoomSub>
                    </RoomTitle>
                    <RoomActions>
                      <CallButton
                        variant="mute-mic"
                        accent="pink"
                        active={micOff}
                        onClick={() => setMicOff(v => !v)}
                        title={micOff ? "Unmute mic" : "Mute mic"}
                      />
                      <CallButton
                        variant="mute-cam"
                        accent="pink"
                        active={camOff}
                        onClick={() => setCamOff(v => !v)}
                        title={camOff ? "Turn camera on" : "Turn camera off"}
                      />
                      <CallButton
                        variant="video"
                        accent={observerMode ? "violet" : "pink"}
                        active={observerMode}
                        onClick={() => setObserverMode(v => !v)}
                        title={observerMode ? "Leave observer mode" : "Join as observer"}
                      />
                      <ControlBtn
                        onClick={() => setSettingsFor(activeSession.id)}
                        title="Session settings"
                      >
                        <EditIcon />
                      </ControlBtn>
                      <CallButton
                        variant="leave"
                        accent="red"
                        onClick={handleLeaveRoom}
                        title="Leave room"
                      />
                    </RoomActions>
                  </RoomHeader>
                  <RoomBody>
                    <CallSurface
                      room={liveKitRoom}
                      layout="full"
                      mode={observerMode ? "observer" : "active"}
                      onLeave={handleLeaveRoom}
                    />
                  </RoomBody>
                </>
              ) : (
                <EmptyRoomPad>
                  <svg width="48" height="48" viewBox="0 0 24 24"
                       fill={`rgba(${PINK_RGB}, 0.45)`}>
                    <path d="M17 10.5V7a5 5 0 0 0-10 0v3.5A2.5 2.5 0 0 0 4.5 13v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 17 10.5zM9 7a3 3 0 0 1 6 0v3.5H9V7z"/>
                  </svg>
                  <EmptyLine>Pick a session to join, or add a custom room from the list.</EmptyLine>
                </EmptyRoomPad>
              )}
            </RoomCol>
          </Body>
        </Panel>
      )}

      {settingsFor && (
        <SessionSettingsModal
          sessionId={settingsFor}
          onClose={() => setSettingsFor(null)}
          onSessionChanged={(next) => {
            if (next == null) {
              setSessions(prev => prev.filter(s => s.id !== settingsFor));
              if (activeId === settingsFor) handleLeaveRoom();
            } else {
              setSessions(prev => {
                const idx = prev.findIndex(s => s.id === next.id);
                if (idx < 0) return [...prev, next];
                const copy = [...prev];
                copy[idx] = next;
                return copy;
              });
            }
          }}
        />
      )}
    </>
  );
}
