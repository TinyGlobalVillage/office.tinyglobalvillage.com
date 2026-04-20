"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import styled from "styled-components";
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

// Load LiveKit components client-side only (WebRTC)
const LiveKitRoom = dynamic(() => import("@livekit/components-react").then(m => m.LiveKitRoom), { ssr: false });
const VideoConference = dynamic(() => import("@livekit/components-react").then(m => m.VideoConference), { ssr: false });

import "@livekit/components-styles";
import { DrawerSessionsIcon } from "./icons";
import NeonX from "./NeonX";
import { useKnobVisibility } from "../lib/drawerKnobs";

// ── Constants ────────────────────────────────────────────────────────────────

const PINK     = colors.pink;
const PINK_RGB = rgb.pink;
const DEFAULT_W       = 580;
const MIN_W           = 380;
const MAX_W           = 900;
const TAB_STORAGE_KEY = "tgv-drawer-tab-sessions-y";
const DRAWER_EVENT    = "tgv-right-drawer";
const WIDTH_KEY       = "tgv-sessions-drawer-width";
const DRAWER_ID       = "sessions";

// Alphabetical stack: Alerts=20%, Chats=40%, Inbox=60%, Sessions=80%
function getDefaultTabY() {
  if (typeof window === "undefined") return 720;
  return Math.round(window.innerHeight * 0.8);
}

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

  [data-theme="light"] & {
    border-right-color: rgba(${PINK_RGB}, 0.1);
  }
`;

const Header = styled(DrawerHeader)`
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid rgba(${PINK_RGB}, 0.12);
`;

const TitleText = styled(DrawerTitle).attrs({ $accent: "pink" })`
  flex: 1;
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

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  [data-theme="light"] & { text-shadow: none; }

  svg { width: 14px; height: 14px; }

  @media (max-width: 768px) {
    width: 2.75rem;
    height: 2.75rem;
    font-size: 1.1875rem;
    border-radius: 0.625rem;
  }
`;

const HeaderLeaveBtn = styled(ControlBtn)`
  background: rgba(248, 113, 113, 0.14);
  border-color: rgba(248, 113, 113, 0.45);
  color: #f87171;
  text-shadow: 0 0 6px rgba(248, 113, 113, 0.7);

  &:hover:not(:disabled) {
    background: rgba(248, 113, 113, 0.28);
    box-shadow: 0 0 10px rgba(248, 113, 113, 0.5);
  }
`;

const Resize = styled(DrawerResizeHandle).attrs({ $accent: "pink" })``;

const Body = styled.div`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const LobbyWrap = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  padding: 2rem;
`;

const LobbyTitle = styled.h2`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${PINK};
  text-shadow: 0 0 12px rgba(${PINK_RGB}, 0.6);
  text-align: center;
  margin: 0;

  [data-theme="light"] & { text-shadow: none; }
`;

const LobbyDesc = styled.p`
  font-size: 0.8125rem;
  color: var(--t-textMuted);
  text-align: center;
  margin: 0;
  max-width: 300px;
  line-height: 1.5;
`;

const RoomInput = styled.input`
  width: 100%;
  max-width: 280px;
  padding: 0.625rem 0.875rem;
  border-radius: 8px;
  border: 1px solid rgba(${PINK_RGB}, 0.3);
  background: rgba(${PINK_RGB}, 0.05);
  color: var(--t-text);
  font-size: 0.8125rem;
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;
  text-align: center;

  &:focus {
    border-color: rgba(${PINK_RGB}, 0.6);
    box-shadow: 0 0 0 2px rgba(${PINK_RGB}, 0.15);
  }
`;

const JoinBtn = styled.button<{ $loading?: boolean }>`
  padding: 0.75rem 2rem;
  border-radius: 10px;
  border: 1px solid rgba(${PINK_RGB}, 0.4);
  background: rgba(${PINK_RGB}, 0.12);
  color: ${PINK};
  font-size: 0.875rem;
  font-weight: 600;
  cursor: ${p => p.$loading ? "not-allowed" : "pointer"};
  opacity: ${p => p.$loading ? 0.6 : 1};
  transition: background 0.15s, box-shadow 0.15s;
  text-shadow: 0 0 8px rgba(${PINK_RGB}, 0.5);

  &:hover:not(:disabled) {
    background: rgba(${PINK_RGB}, 0.22);
    box-shadow: 0 0 16px rgba(${PINK_RGB}, 0.35);
  }

  [data-theme="light"] & { text-shadow: none; }
`;

const ErrorMsg = styled.p`
  font-size: 0.75rem;
  color: #f87171;
  text-align: center;
  margin: 0;
`;

const RoomWrap = styled.div`
  flex: 1;
  overflow: hidden;
  position: relative;

  /* Override LiveKit default styles for dark theme */
  --lk-bg: var(--t-bg);
  --lk-fg: var(--t-text);
`;

const LeaveBtn = styled.button`
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 10;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid rgba(248,113,113,0.4);
  background: rgba(248,113,113,0.12);
  color: #f87171;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;

  &:hover {
    background: rgba(248,113,113,0.25);
    box-shadow: 0 0 12px rgba(248,113,113,0.3);
  }
`;

// ── Component ────────────────────────────────────────────────────────────────

export default function SessionsDrawer() {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(DEFAULT_W);
  const [tabY, setTabY] = useState<number>(720);

  const [roomName, setRoomName] = useState("tgv-office-team");
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Reset to even-spaced viewport default after mount (ignores localStorage on refresh)
  useEffect(() => {
    setTabY(getDefaultTabY());
  }, []);

  // Cross-drawer mutual-exclusive: close when another drawer opens, and hide
  // our tab while another drawer is open (their panel would cover/overlap us).
  const [otherDrawerOpen, setOtherDrawerOpen] = useState(false);
  const { hideKnob } = useKnobVisibility();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === DRAWER_ID) {
        setOtherDrawerOpen(false);
      } else if (detail === "close") {
        setOtherDrawerOpen(false);
      } else {
        if (open) setOpen(false);
        setOtherDrawerOpen(true);
      }
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

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const handleOpen = () => {
    window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: DRAWER_ID }));
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(DRAWER_EVENT, { detail: "close" }));
  };

  // Resize drag
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

  // Tab drag — also interprets a no-drag release as a click to toggle open/close.
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
        setOpen((p) => {
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

  const joinRoom = async () => {
    if (!roomName.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/livekit/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Error ${res.status}` }));
        setError(err.error ?? "Failed to join room");
        return;
      }
      const data = await res.json();
      setToken(data.token);
      setLivekitUrl(data.url);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setJoining(false);
    }
  };

  const leaveRoom = () => {
    setToken(null);
    setLivekitUrl(null);
    setConnected(false);
  };

  return (
    <>
      {/* Tab pill */}
      {!otherDrawerOpen && !hideKnob && (
        <SideTab
          onMouseDown={onTabMouseDown}
          title={open ? "Close sessions" : "Open sessions"}
          $openOffset={open ? width : 0}
          style={{
            top: tabY,
            backgroundColor: open
              ? `rgba(${rgb.pink}, 0.25)`
              : `rgba(${rgb.pink}, 0.12)`,
          }}
        >
          <DrawerSessionsIcon size={16} />
          <DrawerTabLabel>Sessions</DrawerTabLabel>
        </SideTab>
      )}

      {/* Backdrop */}
      {open && <Backdrop onClick={handleClose} />}

      {/* Panel */}
      {open && (
        <Panel style={{ width }}>
          <Resize onMouseDown={onResizeStart} />

          <Header>
            <TitleText>
              {connected ? `🟢 ${roomName}` : "Team Sessions"}
            </TitleText>
            {connected && (
              <HeaderLeaveBtn onClick={leaveRoom} title="Leave room">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                </svg>
              </HeaderLeaveBtn>
            )}
            <ControlBtn
              onClick={() => {
                const w = window.screen.width * 0.8;
                const h = window.screen.height * 0.85;
                const left = (window.screen.width - w) / 2;
                const top  = (window.screen.height - h) / 2;
                window.open("/dashboard/sessions?popout=1", "tgv-sessions-drawer", `width=${w},height=${h},left=${left},top=${top}`);
              }}
              title="Open in new window"
            >
              ⧉
            </ControlBtn>
            <NeonX accent="pink" onClick={handleClose} title="Close (Esc)" />
          </Header>

          <Body>
            {!connected ? (
              <LobbyWrap>
                <svg width="48" height="48" viewBox="0 0 24 24" fill={`rgba(${PINK_RGB}, 0.5)`}>
                  <path d="M17 10.5V7a5 5 0 0 0-10 0v3.5A2.5 2.5 0 0 0 4.5 13v5A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5A2.5 2.5 0 0 0 17 10.5zM9 7a3 3 0 0 1 6 0v3.5H9V7z"/>
                </svg>
                <LobbyTitle>Team Meeting Room</LobbyTitle>
                <LobbyDesc>
                  Start or join a team video session. All participants in the same room name can see and hear each other.
                </LobbyDesc>
                <RoomInput
                  value={roomName}
                  onChange={e => setRoomName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") joinRoom(); }}
                  placeholder="Room name"
                />
                {error && <ErrorMsg>✕ {error}</ErrorMsg>}
                <JoinBtn onClick={joinRoom} disabled={joining || !roomName.trim()} $loading={joining}>
                  {joining ? "Joining…" : "Join Room"}
                </JoinBtn>
              </LobbyWrap>
            ) : (
              <RoomWrap>
                {token && livekitUrl && (
                  <LiveKitRoom
                    serverUrl={livekitUrl}
                    token={token}
                    connect={true}
                    video={true}
                    audio={true}
                    onDisconnected={leaveRoom}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <VideoConference />
                  </LiveKitRoom>
                )}
              </RoomWrap>
            )}
          </Body>
        </Panel>
      )}
    </>
  );
}
